import type { BroadcastMessage, BroadcastType, LunchColleague, LunchInviteStatus, LunchInviteSummary, PointReminderSummary } from '../types/app';
import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from './auth-session';
import { supabase } from './supabase';

export interface ServiceResult<T> { data: T | null; error: string | null; }

const friendly = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir esta operação.';

export const BROADCAST_PRESETS: readonly { id: string; label: string; message_type: BroadcastType; title: string; message: string }[] = [
  {
    id: 'maintenance',
    label: 'Manutenção programada',
    message_type: 'maintenance',
    title: 'Manutenção programada',
    message: 'O Olha o Ponto passará por uma manutenção programada. Durante esse período, alguns recursos podem ficar temporariamente indisponíveis. Obrigado pela compreensão.',
  },
  {
    id: 'update',
    label: 'Atualização do aplicativo',
    message_type: 'update',
    title: 'Atualização disponível',
    message: 'Há uma atualização do Olha o Ponto com melhorias para você. Quando solicitado, atualize o aplicativo pela versão compartilhada pelo administrador.',
  },
  {
    id: 'announcement',
    label: 'Aviso importante',
    message_type: 'announcement',
    title: 'Aviso importante',
    message: 'Temos um aviso importante para compartilhar. Consulte a mensagem abaixo e, se precisar, fale com o administrador do sistema.',
  },
];

export async function loadHomeCommunications(userId: string): Promise<ServiceResult<{ broadcasts: BroadcastMessage[]; invites: LunchInviteSummary[]; pointReminders: PointReminderSummary[] }>> {
  try {
    const [messageResult, receiptResult, inviteResult, reminderResult] = await Promise.all([
      supabase.from('app_broadcast_messages').select('id,title,message,message_type,active,expires_at,created_by,created_at,updated_at').eq('active', true).order('created_at', { ascending: false }).limit(50),
      supabase.from('app_broadcast_receipts').select('message_id').eq('user_id', userId).limit(200),
      supabase.rpc('list_my_lunch_invites'),
      supabase.rpc('list_my_point_reminders'),
    ]);
    const error = messageResult.error || receiptResult.error || inviteResult.error || reminderResult.error;
    if (error) return { data: null, error: friendly(error) };
    const readIds = new Set((receiptResult.data ?? []).map((row) => row.message_id));
    const now = Date.now();
    const broadcasts = ((messageResult.data ?? []) as BroadcastMessage[]).filter((item) =>
      !readIds.has(item.id) && (!item.expires_at || new Date(item.expires_at).getTime() > now),
    );
    return { data: { broadcasts, invites: (inviteResult.data ?? []) as LunchInviteSummary[], pointReminders: (reminderResult.data ?? []) as PointReminderSummary[] }, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function acknowledgeBroadcast(messageId: string, userId: string): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase.from('app_broadcast_receipts').insert({ message_id: messageId, user_id: userId });
    if (error && error.code !== '23505') return { data: null, error: friendly(error) };
    return { data: null, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function loadActiveColleagues(): Promise<ServiceResult<LunchColleague[]>> {
  try {
    const { data, error } = await supabase.rpc('list_active_colleagues');
    return { data: data as LunchColleague[] | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function sendLunchInvite(input: { recipient_id: string; lunch_at: string; return_at: string; message: string }): Promise<ServiceResult<{ id: string }>> {
  const auth = await getAuthenticatedSession();
  if (!auth.session) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  if (new Date(input.return_at).getTime() <= new Date(input.lunch_at).getTime()) return { data: null, error: 'O retorno precisa ocorrer depois do horário de saída para almoço.' };
  try {
    const { data, error } = await supabase.from('lunch_invites').insert({
      sender_id: auth.session.user.id,
      recipient_id: input.recipient_id,
      lunch_at: new Date(input.lunch_at).toISOString(),
      return_at: new Date(input.return_at).toISOString(),
      message: input.message.trim().slice(0, 500),
    }).select('id').single();
    return { data: data as { id: string } | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function replyToLunchInvite(inviteId: string, status: Exclude<LunchInviteStatus, 'pending'>, responseMessage: string): Promise<ServiceResult<void>> {
  try {
    const { data, error } = await supabase.from('lunch_invites').update({
      status,
      response_message: responseMessage.trim().slice(0, 500),
      responded_at: new Date().toISOString(),
    }).eq('id', inviteId).select('id').maybeSingle();
    if (error) return { data: null, error: friendly(error) };
    if (!data) return { data: null, error: 'Este convite já foi respondido ou não está disponível.' };
    return { data: null, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function sendPointReminder(input: { recipient_id: string; message: string }): Promise<ServiceResult<{ id: string }>> {
  const auth = await getAuthenticatedSession();
  if (!auth.session) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  try {
    const { data, error } = await supabase.from('point_reminders').insert({
      sender_id: auth.session.user.id,
      recipient_id: input.recipient_id,
      message: input.message.trim().slice(0, 500),
    }).select('id').single();
    return { data: data as { id: string } | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function acknowledgePointReminder(reminderId: string): Promise<ServiceResult<void>> {
  try {
    const { data, error } = await supabase.from('point_reminders').update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() }).eq('id', reminderId).eq('status', 'pending').select('id').maybeSingle();
    if (error) return { data: null, error: friendly(error) };
    if (!data) return { data: null, error: 'Este lembrete já foi confirmado ou não está disponível.' };
    return { data: null, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function loadAdminBroadcasts(): Promise<ServiceResult<BroadcastMessage[]>> {
  try {
    const { data, error } = await supabase.from('app_broadcast_messages').select('*').order('created_at', { ascending: false }).limit(100);
    return { data: data as BroadcastMessage[] | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function saveAdminBroadcast(input: { id?: string; title: string; message: string; message_type: BroadcastType; active?: boolean }): Promise<ServiceResult<BroadcastMessage>> {
  const auth = await getAuthenticatedSession();
  if (!auth.session) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  const values = {
    title: input.title.trim().slice(0, 100),
    message: input.message.trim().slice(0, 2000),
    message_type: input.message_type,
    updated_at: new Date().toISOString(),
  };
  if (!values.title || !values.message) return { data: null, error: 'Preencha o título e a mensagem.' };
  try {
    const result = input.id
      ? await supabase.from('app_broadcast_messages').update({ ...values, ...(input.active === undefined ? {} : { active: input.active }) }).eq('id', input.id).select('*').single()
      : await supabase.from('app_broadcast_messages').insert({ ...values, active: input.active ?? true, created_by: auth.session.user.id }).select('*').single();
    const { data, error } = result;
    return { data: data as BroadcastMessage | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function setAdminBroadcastActive(id: string, active: boolean): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase.from('app_broadcast_messages').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
    return { data: null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function deleteAdminBroadcast(id: string): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase.from('app_broadcast_messages').delete().eq('id', id);
    return { data: null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}
