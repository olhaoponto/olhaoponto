import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayStatus, DayStatusRecord } from '../types/app';
import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from './auth-session';
import { supabase } from './supabase';
import { pruneDayStatuses, rowsChanged } from '@/utils/local-history-cache';
import { recordCacheFirst } from '@/utils/perf-metrics';
import { serveCached } from '@/utils/cache-first';
import { keepCachedOnError, mergeDayStatuses } from '@/utils/day-cache-merge';

export interface DayStatusResult<T> { data: T | null; error: string | null; }
export interface DayStatusLoadOptions { onCached?: (rows: DayStatusRecord[]) => void; }
const allowed: DayStatus[] = ['working', 'rest', 'absence', 'medical_leave'];
const cacheKey = (userId: string) => `olhaponto:${userId}:day-statuses`;
const memoryCache = new Map<string, DayStatusRecord[]>();
const cacheLocks = new Map<string, Promise<void>>();

function friendly(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Não foi possível sincronizar a situação do dia.';
  return /auth session missing|authsessionmissingerror|session missing/i.test(message) ? SESSION_REQUIRED_MESSAGE : message;
}

export function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const withCacheLock = async <T>(key: string, task: () => Promise<T>): Promise<T> => {
  const previous = cacheLocks.get(key) ?? Promise.resolve();
  let resolve!: () => void;
  const turn = new Promise<void>((done) => { resolve = done; });
  cacheLocks.set(key, turn);
  await previous.catch(() => undefined);
  try { return await task(); } finally { resolve(); if (cacheLocks.get(key) === turn) cacheLocks.delete(key); }
};

export function invalidateDayStatusCache(uid?: string): void {
  if (uid) memoryCache.delete(cacheKey(uid));
  else memoryCache.clear();
}

export async function invalidateDayStatusDate(data: string, uid?: string): Promise<void> {
  try {
    const userId = uid ?? await authenticatedUserId();
    const key = cacheKey(userId);
    await withCacheLock(key, async () => {
      const cached = await readCache(key);
      await writeCache(key, cached.filter((row) => row.data !== data || row._pending));
    });
  } catch { /* a limpeza local é best effort */ }
}

async function readCache(key: string): Promise<DayStatusRecord[]> {
  const cached = memoryCache.get(key);
  if (cached) return cached;
  let rows: DayStatusRecord[] = [];
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
    if (Array.isArray(parsed)) {
      rows = parsed.filter((row): row is DayStatusRecord => Boolean(
        row && typeof row === 'object' && typeof row.data === 'string' && isValidCivilDate(row.data)
          && allowed.includes(row.status),
      )).map((row) => ({ ...row, _pending: row._pending === true }));
    }
  } catch { rows = []; }
  const normalized = pruneDayStatuses(rows, today());
  memoryCache.set(key, normalized);
  if (rowsChanged(rows, normalized)) await AsyncStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

async function writeCache(key: string, rows: DayStatusRecord[]): Promise<void> {
  const normalized = pruneDayStatuses(rows, today());
  const previous = memoryCache.get(key);
  if (previous && !rowsChanged(previous, normalized)) return;
  if (!previous) {
    const raw = await AsyncStorage.getItem(key).catch(() => null);
    try {
      if (raw && !rowsChanged(JSON.parse(raw) as DayStatusRecord[], normalized)) {
        memoryCache.set(key, normalized);
        return;
      }
    } catch { /* regrava conteúdo inválido */ }
  }
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
  memoryCache.set(key, normalized);
}

async function userId(): Promise<string> {
  const result = await getAuthenticatedSession();
  if (!result.session) throw new Error(result.error || SESSION_REQUIRED_MESSAGE);
  return result.session.user.id;
}

async function authenticatedUserId(): Promise<string> {
  return userId();
}

export async function loadDayStatuses(startDate: string, endDate: string, options?: DayStatusLoadOptions): Promise<DayStatusResult<DayStatusRecord[]>> {
  if (!isValidCivilDate(startDate) || !isValidCivilDate(endDate) || startDate > endDate) return { data: null, error: 'O período informado para os status do dia é inválido.' };
  try {
    const uid = await userId();
    const key = cacheKey(uid);
    const cached = await withCacheLock(key, () => readCache(key));
    const localRange = cached.filter((row) => row.data >= startDate && row.data <= endDate);
    if (options?.onCached) { recordCacheFirst(); serveCached(localRange, options.onCached); }
    const response = await (supabase as any).from('day_statuses').select('user_id,data,status,atualizado_em').eq('user_id', uid).gte('data', startDate).lte('data', endDate).order('data').limit(120);
    if (response.error) return { data: keepCachedOnError(localRange), error: friendly(response.error) };
    const rows = await withCacheLock(key, async () => {
      const latest = await readCache(key);
      const result = mergeDayStatuses(latest, (response.data ?? []) as DayStatusRecord[], startDate, endDate);
      await writeCache(key, result);
      return result.filter((row) => row.data >= startDate && row.data <= endDate);
    });
    return { data: rows, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function saveDayStatus(data: string, status: DayStatus): Promise<DayStatusResult<DayStatusRecord>> {
  if (!isValidCivilDate(data)) return { data: null, error: 'A data do status não é válida.' };
  if (!allowed.includes(status)) return { data: null, error: 'A situação escolhida não é válida.' };
  try {
    const uid = await userId();
    const key = cacheKey(uid);
    const updatedAt = new Date().toISOString();
    const pending: DayStatusRecord = { user_id: uid, data, status, atualizado_em: updatedAt, _pending: true };
    await withCacheLock(key, async () => {
      const cached = await readCache(key);
      await writeCache(key, [...cached.filter((row) => row.data !== data), pending]);
    });
    const response = await (supabase as any).from('day_statuses').upsert({ user_id: uid, data, status, atualizado_em: updatedAt }, { onConflict: 'user_id,data' }).select('user_id,data,status,atualizado_em').single();
    if (response.error) return { data: pending, error: friendly(response.error) };
    const saved = response.data as DayStatusRecord;
    await withCacheLock(key, async () => {
      const cached = await readCache(key);
      await writeCache(key, [...cached.filter((row) => row.data !== data), saved]);
    });
    return { data: saved, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function syncPendingDayStatuses(): Promise<DayStatusResult<{ synced: number; failed: number }>> {
  try {
    const uid = await userId();
    const key = cacheKey(uid);
    const pending = await withCacheLock(key, async () => (await readCache(key)).filter((row) => row._pending));
    const failedRows: DayStatusRecord[] = [];
    let synced = 0;
    let firstError: string | null = null;
    for (const row of pending) {
      const response = await (supabase as any).from('day_statuses').upsert({ user_id: uid, data: row.data, status: row.status, atualizado_em: row.atualizado_em }, { onConflict: 'user_id,data' }).select('user_id,data,status,atualizado_em').single();
      if (response.error) { failedRows.push(row); firstError ||= friendly(response.error); continue; }
      const saved = response.data as DayStatusRecord;
      await withCacheLock(key, async () => {
        const cached = await readCache(key);
        await writeCache(key, [...cached.filter((item) => item.data !== row.data), saved]);
      });
      synced++;
    }
    await withCacheLock(key, async () => {
      const cached = await readCache(key);
      const failedByDate = new Map(failedRows.map((row) => [row.data, row]));
      await writeCache(key, cached.map((row) => failedByDate.get(row.data) ?? row));
    });
    return { data: { synced, failed: failedRows.length }, error: firstError };
  } catch (error) { return { data: null, error: friendly(error) }; }
}
