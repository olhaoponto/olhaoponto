import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayOccurrence, OccurrenceReason } from '../types/app';
import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from './auth-session';
import { supabase } from './supabase';
import { keepCachedOnError, mergeDayOccurrence, mergeDayOccurrences } from '@/utils/day-cache-merge';

export interface DayOccurrenceResult<T> { data: T | null; error: string | null; }
const reasons: OccurrenceReason[] = ['Pessoal', 'Saúde', 'Trabalho externo', 'Outro'];
const cacheKey = (uid: string) => `olhaponto:${uid}:day-occurrences`;
const friendly = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Não foi possível sincronizar a intercorrência.';
  if (/day_occurrences|PGRST205|does not exist|schema cache/i.test(message)) return 'Intercorrência guardada neste aparelho. A tabela ainda não está disponível no servidor; será sincronizada quando ela existir.';
  return /auth session missing|authsessionmissingerror|session missing/i.test(message) ? SESSION_REQUIRED_MESSAGE : message;
};
async function uid() { const auth = await getAuthenticatedSession(); if (!auth.session) throw new Error(auth.error || SESSION_REQUIRED_MESSAGE); return auth.session.user.id; }
async function read(key: string): Promise<DayOccurrence[]> { try { const value = JSON.parse((await AsyncStorage.getItem(key)) || '[]'); return Array.isArray(value) ? value.filter((x) => x && typeof x.work_date === 'string') : []; } catch { return []; } }
async function write(key: string, rows: DayOccurrence[]) { await AsyncStorage.setItem(key, JSON.stringify(rows)); }
export function isOccurrenceReason(value: string): value is OccurrenceReason { return reasons.includes(value as OccurrenceReason); }
export async function loadDayOccurrence(workDate: string): Promise<DayOccurrenceResult<DayOccurrence>> {
  try { const user_id = await uid(); const key = cacheKey(user_id); const cached = await read(key); const local = cached.find((x) => x.work_date === workDate) ?? null;
    const response = await (supabase as any).from('day_occurrences').select('id,user_id,work_date,motivo,occurred_at,observacao,debito_minutos,created_at').eq('user_id', user_id).eq('work_date', workDate).maybeSingle();
    if (response.error) return { data: keepCachedOnError([local])[0] ?? null, error: friendly(response.error) };
    const remote = response.data as DayOccurrence | null;
    if (!remote && local?._pending) {
      const pendingResponse = await (supabase as any).from('day_occurrences').upsert({ user_id, work_date: local.work_date, motivo: local.motivo, occurred_at: local.occurred_at, observacao: local.observacao, debito_minutos: local.debito_minutos }, { onConflict: 'user_id,work_date' }).select('id,user_id,work_date,motivo,occurred_at,observacao,debito_minutos,created_at').single();
      if (!pendingResponse.error) { const saved = pendingResponse.data as DayOccurrence; await write(key, [...cached.filter((x) => x.work_date !== workDate), saved]); return { data: saved, error: null }; }
    }
    const merged = mergeDayOccurrence(cached, workDate, remote); await write(key, merged.rows); return { data: merged.data, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function loadDayOccurrences(): Promise<DayOccurrenceResult<DayOccurrence[]>> {
  try {
    const user_id = await uid(); const key = cacheKey(user_id); const cached = await read(key);
    const response = await (supabase as any).from('day_occurrences').select('id,user_id,work_date,motivo,occurred_at,observacao,debito_minutos,created_at').eq('user_id', user_id).order('work_date', { ascending: false }).limit(3660);
    if (response.error) return { data: keepCachedOnError(cached), error: friendly(response.error) };
    const rows = mergeDayOccurrences(cached, (response.data ?? []) as DayOccurrence[]); await write(key, rows); return { data: rows, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}
export async function saveDayOccurrence(input: { work_date: string; motivo: OccurrenceReason; occurred_at: string; observacao?: string; debito_minutos: number }): Promise<DayOccurrenceResult<DayOccurrence>> {
  if (!isOccurrenceReason(input.motivo)) return { data: null, error: 'Motivo de intercorrência inválido.' };
  try { const user_id = await uid(); const key = cacheKey(user_id); const local: DayOccurrence = { id: `local-${user_id}-${input.work_date}`, user_id, ...input, observacao: input.observacao?.trim() || null, _pending: true, created_at: new Date().toISOString() }; await write(key, [...(await read(key)).filter((x) => x.work_date !== input.work_date), local]);
    const response = await (supabase as any).from('day_occurrences').upsert({ user_id, work_date: input.work_date, motivo: input.motivo, occurred_at: input.occurred_at, observacao: input.observacao?.trim() || null, debito_minutos: input.debito_minutos }, { onConflict: 'user_id,work_date' }).select('id,user_id,work_date,motivo,occurred_at,observacao,debito_minutos,created_at').single();
    if (response.error) return { data: local, error: friendly(response.error) }; const saved = response.data as DayOccurrence; await write(key, [...(await read(key)).filter((x) => x.work_date !== input.work_date), saved]); return { data: saved, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}
export async function deleteDayOccurrence(workDate: string): Promise<DayOccurrenceResult<boolean>> { try { const user_id = await uid(); const key = cacheKey(user_id); await write(key, (await read(key)).filter((x) => x.work_date !== workDate)); const response = await (supabase as any).from('day_occurrences').delete().eq('user_id', user_id).eq('work_date', workDate); return response.error ? { data: true, error: friendly(response.error) } : { data: true, error: null }; } catch (error) { return { data: null, error: friendly(error) }; } }
export async function isDayOccurrenceActive(userId: string, workDate: string): Promise<boolean> { return (await read(cacheKey(userId))).some((x) => x.work_date === workDate); }
