import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayStatus, DayStatusRecord } from '../types/app';
import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from './auth-session';
import { supabase } from './supabase';

export interface DayStatusResult<T> { data: T | null; error: string | null; }
const allowed: DayStatus[] = ['working', 'rest', 'absence', 'medical_leave'];
const cacheKey = (userId: string) => `olhaponto:${userId}:day-statuses`;

function friendly(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Não foi possível sincronizar a situação do dia.';
  return /auth session missing|authsessionmissingerror|session missing/i.test(message) ? SESSION_REQUIRED_MESSAGE : message;
}

export function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function userId(): Promise<string> {
  const result = await getAuthenticatedSession();
  if (!result.session) throw new Error(result.error || SESSION_REQUIRED_MESSAGE);
  return result.session.user.id;
}

async function readCache(key: string): Promise<DayStatusRecord[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is DayStatusRecord => Boolean(row && typeof row === 'object' && typeof row.data === 'string' && isValidCivilDate(row.data) && allowed.includes(row.status)))
      .map((row) => ({ ...row, _pending: row._pending === true }));
  } catch { return []; }
}

async function writeCache(key: string, rows: DayStatusRecord[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(rows));
}

export async function loadDayStatuses(startDate: string, endDate: string): Promise<DayStatusResult<DayStatusRecord[]>> {
  if (!isValidCivilDate(startDate) || !isValidCivilDate(endDate) || startDate > endDate) return { data: null, error: 'O período informado para os status do dia é inválido.' };
  try {
    const uid = await userId();
    const key = cacheKey(uid);
    const cached = await readCache(key);
    const localRange = cached.filter((row) => row.data >= startDate && row.data <= endDate);
    const response = await (supabase as any).from('day_statuses').select('user_id,data,status,atualizado_em').eq('user_id', uid).gte('data', startDate).lte('data', endDate).order('data').limit(31);
    if (response.error) return { data: localRange, error: friendly(response.error) };
    const merged = new Map<string, DayStatusRecord>();
    for (const row of (response.data ?? []) as DayStatusRecord[]) merged.set(row.data, row);
    for (const row of localRange) if (row._pending) merged.set(row.data, row);
    const rows = [...merged.values()].sort((a, b) => a.data.localeCompare(b.data));
    await writeCache(key, [...cached.filter((row) => row.data < startDate || row.data > endDate), ...rows]);
    return { data: rows, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function saveDayStatus(data: string, status: DayStatus): Promise<DayStatusResult<DayStatusRecord>> {
  if (!isValidCivilDate(data)) return { data: null, error: 'A data do status não é válida.' };
  if (!allowed.includes(status)) return { data: null, error: 'A situação escolhida não é válida.' };
  try {
    const uid = await userId();
    const key = cacheKey(uid);
    const cached = await readCache(key);
    const updatedAt = new Date().toISOString();
    const pending: DayStatusRecord = { user_id: uid, data, status, atualizado_em: updatedAt, _pending: true };
    await writeCache(key, [...cached.filter((row) => row.data !== data), pending]);
    const response = await (supabase as any).from('day_statuses').upsert({ user_id: uid, data, status, atualizado_em: updatedAt }, { onConflict: 'user_id,data' }).select('user_id,data,status,atualizado_em').single();
    if (response.error) return { data: pending, error: friendly(response.error) };
    const saved = response.data as DayStatusRecord;
    await writeCache(key, [...(await readCache(key)).filter((row) => row.data !== data), saved]);
    return { data: saved, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function syncPendingDayStatuses(): Promise<DayStatusResult<{ synced: number; failed: number }>> {
  try {
    const uid = await userId();
    const key = cacheKey(uid);
    const cached = await readCache(key);
    const pending = cached.filter((row) => row._pending);
    const remaining: DayStatusRecord[] = [];
    let synced = 0;
    let firstError: string | null = null;
    for (const row of pending) {
      const response = await (supabase as any).from('day_statuses').upsert({ user_id: uid, data: row.data, status: row.status, atualizado_em: row.atualizado_em }, { onConflict: 'user_id,data' }).select('user_id,data,status,atualizado_em').single();
      if (response.error) { remaining.push(row); firstError ||= friendly(response.error); continue; }
      const saved = response.data as DayStatusRecord;
      const index = cached.findIndex((item) => item.data === row.data);
      if (index >= 0) cached[index] = saved;
      synced++;
    }
    for (const row of remaining) {
      const index = cached.findIndex((item) => item.data === row.data);
      if (index >= 0) cached[index] = row;
    }
    await writeCache(key, cached);
    return { data: { synced, failed: remaining.length }, error: firstError };
  } catch (error) { return { data: null, error: friendly(error) }; }
}
