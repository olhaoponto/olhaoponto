import type { BalanceAdjustment } from '../types/app';
import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from './auth-session';
import { supabase } from './supabase';

export interface ServiceResult<T> { data: T | null; error: string | null; }

function friendly(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Não foi possível carregar o banco de horas.';
  if (/balance_adjustments|PGRST205|schema cache/i.test(message) && /does not exist|not found|schema cache|relation/i.test(message)) {
    return 'O histórico de saldo externo ainda não está disponível no Supabase. A migração desta funcionalidade está no repositório e precisa ser aplicada pelo responsável.';
  }
  return /auth session missing|authsessionmissingerror|session missing/i.test(message) ? SESSION_REQUIRED_MESSAGE : message;
}

export async function loadBalanceAdjustments(): Promise<ServiceResult<BalanceAdjustment[]>> {
  const auth = await getAuthenticatedSession();
  const userId = auth.session?.user.id;
  if (!userId) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  try {
    const { data, error } = await supabase
      .from('balance_adjustments')
      .select('id,user_id,saldo_minutos,motivo,criado_em')
      .eq('user_id', userId)
      .order('criado_em', { ascending: false });
    return error
      ? { data: null, error: friendly(error) }
      : { data: (data ?? []) as BalanceAdjustment[], error: null };
  } catch (error) {
    return { data: null, error: friendly(error) };
  }
}

export async function addBalanceAdjustment(
  saldoMinutos: number,
  motivo: string,
): Promise<ServiceResult<BalanceAdjustment>> {
  const auth = await getAuthenticatedSession();
  const userId = auth.session?.user.id;
  if (!userId) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  if (!Number.isInteger(saldoMinutos) || saldoMinutos === 0 || Math.abs(saldoMinutos) > 60_000) {
    return { data: null, error: 'Informe uma quantidade válida de horas e minutos.' };
  }
  const trimmedReason = motivo.trim();
  if (trimmedReason.length < 3 || trimmedReason.length > 240) {
    return { data: null, error: 'Descreva o motivo com 3 a 240 caracteres.' };
  }
  try {
    const { data, error } = await supabase
      .from('balance_adjustments')
      .insert({ user_id: userId, saldo_minutos: saldoMinutos, motivo: trimmedReason })
      .select('id,user_id,saldo_minutos,motivo,criado_em')
      .single();
    return error
      ? { data: null, error: friendly(error) }
      : { data: data as BalanceAdjustment, error: null };
  } catch (error) {
    return { data: null, error: friendly(error) };
  }
}
