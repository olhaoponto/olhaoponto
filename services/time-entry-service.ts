import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatInTimeZone } from 'date-fns-tz';
import type { PunchType, TimeEntry } from '../types/app';
import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from './auth-session';
import { supabase } from './supabase';
import { awardPieceForEntry } from './journey-service';
import { useAppStore } from '@/store/app-store';
import { pruneTimeEntries, rowsChanged } from '@/utils/local-history-cache';
import { recordCacheFirst } from '@/utils/perf-metrics';
import { serveCached } from '@/utils/cache-first';

export interface ServiceResult<T> { data: T | null; error: string | null; }
export interface CacheLoadOptions<T> { onCached?: (rows: T[]) => void; }
export type TimeEntryInput = Pick<TimeEntry, 'tipo'> & Partial<Pick<TimeEntry, 'registrado_em' | 'horario_informado_manual' | 'editado' | 'justificativa'>> & { user_id?: never; data?: never };
const friendly = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
  return /auth session missing|authsessionmissingerror|session missing/i.test(message) ? SESSION_REQUIRED_MESSAGE : message;
};
const cacheKey = (id: string) => `olhaponto:${id}:time-entries`;
const pendingKey = (id: string) => `olhaponto:${id}:pending-time-entries`;
const zone = 'America/Bahia';
const civilDate = (value: string | Date) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : formatInTimeZone(value, zone, 'yyyy-MM-dd');
const memoryCache = new Map<string, TimeEntry[]>();
const cacheLocks = new Map<string, Promise<void>>();
const today = () => civilDate(new Date());
const withCacheLock = async <T>(uid: string, task: () => Promise<T>): Promise<T> => {
  const previous = cacheLocks.get(uid) ?? Promise.resolve();
  let resolve!: () => void;
  const turn = new Promise<void>((done) => { resolve = done; });
  cacheLocks.set(uid, turn);
  await previous.catch(() => undefined);
  try { return await task(); } finally { resolve(); if (cacheLocks.get(uid) === turn) cacheLocks.delete(uid); }
};
async function readList(key: string, uid: string, prune = false): Promise<TimeEntry[]> {
  const cached = memoryCache.get(key);
  if (cached) return cached;
  let rows: TimeEntry[];
  try { rows = JSON.parse((await AsyncStorage.getItem(key)) || '[]') as TimeEntry[]; } catch { rows = []; }
  if (!Array.isArray(rows)) rows = [];
  const normalized = prune ? pruneTimeEntries(rows, today()) : rows;
  memoryCache.set(key, normalized);
  if (prune && rowsChanged(rows, normalized)) await AsyncStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}
async function writeList(key: string, uid: string, rows: TimeEntry[], prune = false): Promise<void> {
  const normalized = prune ? pruneTimeEntries(rows, today()) : rows;
  const previous = memoryCache.get(key);
  if (previous && !rowsChanged(previous, normalized)) return;
  if (!previous) {
    const raw = await AsyncStorage.getItem(key).catch(() => null);
    try { if (raw && !rowsChanged(JSON.parse(raw) as TimeEntry[], normalized)) { memoryCache.set(key, normalized); return; } } catch { /* regrava conteúdo inválido */ }
  }
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
  memoryCache.set(key, normalized);
}
async function readCache(uid: string) { return readList(cacheKey(uid), uid, true); }
async function readPending(uid: string) { return readList(pendingKey(uid), uid); }
async function writeCache(uid: string, rows: TimeEntry[]) { return writeList(cacheKey(uid), uid, rows, true); }
async function writePending(uid: string, rows: TimeEntry[]) { return writeList(pendingKey(uid), uid, rows); }

export function invalidateTimeEntryCache(uid?: string): void {
  if (uid) { memoryCache.delete(cacheKey(uid)); memoryCache.delete(pendingKey(uid)); return; }
  memoryCache.clear();
}

export async function invalidateTimeEntryDate(data: string, uid?: string): Promise<void> {
  try {
    const userId = uid ?? await currentUserId();
    await withCacheLock(userId, async () => {
      const cached = await readCache(userId);
      await writeCache(userId, cached.filter((entry) => entry.data !== data || (entry as TimeEntry & { _pending?: boolean })._pending));
    });
  } catch { /* a limpeza local é best effort */ }
}

function uuidV4(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function currentUserId(): Promise<string> {
  const auth = await getAuthenticatedSession();
  if (!auth.session) throw new Error(auth.error || SESSION_REQUIRED_MESSAGE);
  return auth.session.user.id;
}

type Query = (userId: string) => PromiseLike<{ data: TimeEntry[] | null; error: { message: string } | null }>;
async function cachedThenRemote(query: Query, matches: (entry: TimeEntry) => boolean, options?: CacheLoadOptions<TimeEntry>): Promise<ServiceResult<TimeEntry[]>> {
  try {
    const uid = await currentUserId();
    const [allCached, allPending] = await withCacheLock(uid, () => Promise.all([readCache(uid), readPending(uid)]));
    const cached = allCached.filter(matches);
    const pending = allPending.filter(matches);
    const cachedRows = [...cached];
    for (const item of pending) if (!cachedRows.some((entry) => entry.id === item.id)) cachedRows.push(item);
    if (options?.onCached) { recordCacheFirst(); serveCached(cachedRows.sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)), options.onCached); }
    const remote = await query(uid);
    if (remote.error) {
      const merged = [...cached];
      for (const item of pending) if (!merged.some((entry) => entry.id === item.id)) merged.push(item);
      return { data: merged.sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)), error: friendly(remote.error) };
    }
    const merged = await withCacheLock(uid, async () => {
      const latestCached = await readCache(uid);
      const latestPending = (await readPending(uid)).filter(matches);
      const result = [...(remote.data || [])];
      for (const item of latestPending) if (!result.some((entry) => entry.id === item.id)) result.push(item);
      await writeCache(uid, [...latestCached.filter((item) => !matches(item)), ...result]);
      return result;
    });
    return { data: merged.sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)), error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export const loadEntriesByDate = (date: string | Date, options?: CacheLoadOptions<TimeEntry>) => {
  const day = civilDate(date);
  return cachedThenRemote(
    (uid) => supabase.from('time_entries').select('*').eq('user_id', uid).eq('data', day).order('registrado_em'),
    (entry) => entry.data === day,
    options,
  );
};

export const loadEntriesByMonth = (month: string | Date, options?: CacheLoadOptions<TimeEntry>) => {
  const civil = civilDate(month);
  const start = `${civil.slice(0, 7)}-01`;
  const [year, mon] = civil.slice(0, 7).split('-').map(Number);
  const endDate = new Date(Date.UTC(year, mon, 0));
  const end = `${year}-${String(mon).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`;
  const matches = (entry: TimeEntry) => entry.data >= start && entry.data <= end;
  return cachedThenRemote(
    (uid) => supabase.from('time_entries').select('*').eq('user_id', uid).gte('data', start).lte('data', end).order('registrado_em'),
    matches,
    options,
  );
};

export const loadEntriesByDateRange = async (startDate: string | Date, endDate: string | Date, options?: CacheLoadOptions<TimeEntry>): Promise<ServiceResult<TimeEntry[]>> => {
  const start = civilDate(startDate);
  const end = civilDate(endDate);
  if (start > end) return { data: null, error: 'O intervalo informado é inválido.' };
  const matches = (entry: TimeEntry) => entry.data >= start && entry.data <= end;
  return cachedThenRemote(
    (uid) => supabase.from('time_entries').select('*').eq('user_id', uid).gte('data', start).lte('data', end).order('registrado_em'),
    matches,
    options,
  );
};

export const loadEntriesByRange = loadEntriesByDateRange;

function isNetworkFailure(error: { message?: string; code?: string; status?: number }): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (typeof error.status === 'number' && error.status >= 400) return false;
  if (error.code && ['23505', '23514', '42501', '23503', '22P02'].includes(error.code)) return false;
  return /network|fetch|connection|offline|internet|timeout|failed to fetch|load failed/i.test(error.message ?? '');
}

async function persistOrQueue(entry: TimeEntry): Promise<ServiceResult<TimeEntry>> {
  const uid = await currentUserId();
  try {
    const remote = await supabase.from('time_entries').insert(entry).select('*').single();
    if (remote.error) {
      const transportFailure = isNetworkFailure(remote.error) || !remote.error.code;
      if (!transportFailure) return { data: null, error: friendly(remote.error) };
      const queued = { ...entry, _pending: true } as TimeEntry;
      await withCacheLock(uid, async () => {
        const [pending, cached] = await Promise.all([readPending(uid), readCache(uid)]);
        await writePending(uid, [...pending.filter((item) => item.id !== entry.id), queued]);
        await writeCache(uid, [...cached.filter((item) => item.id !== entry.id), queued]);
      });
      return { data: queued, error: null };
    }
    await withCacheLock(uid, async () => {
      const cached = await readCache(uid);
      await writeCache(uid, [...cached.filter((item) => item.id !== entry.id), remote.data as TimeEntry]);
    });
    return { data: remote.data as TimeEntry, error: null };
  } catch (error) {
    const networkError = error instanceof Error ? { message: error.message, name: error.name } : { message: '' };
    const transportFailure = /TypeError|network|fetch|connection|offline|timeout|abort|load failed/i.test(`${networkError.name ?? ''} ${networkError.message}`) || !networkError.message;
    if (!transportFailure) return { data: null, error: friendly(error) };
    const queued = { ...entry, _pending: true } as TimeEntry;
    await withCacheLock(uid, async () => {
      const [pending, cached] = await Promise.all([readPending(uid), readCache(uid)]);
      await writePending(uid, [...pending.filter((item) => item.id !== entry.id), queued]);
      await writeCache(uid, [...cached.filter((item) => item.id !== entry.id), queued]);
    });
    return { data: queued, error: null };
  }
}

function makeRow(uid: string, input: TimeEntryInput): TimeEntry {
  const stamp = input.registrado_em ? new Date(input.registrado_em).toISOString() : new Date().toISOString();
  const now = new Date().toISOString();
  return {
    id: uuidV4(), user_id: uid, data: civilDate(stamp), tipo: input.tipo, registrado_em: stamp,
    horario_informado_manual: input.horario_informado_manual ?? false,
    editado: input.editado ?? false, justificativa: input.justificativa ?? null,
    criado_em: now, atualizado_em: now,
  };
}

export async function insertTimeEntry(input: TimeEntryInput): Promise<ServiceResult<TimeEntry>> {
  try {
    const uid = await currentUserId();
    const result = await persistOrQueue(makeRow(uid, input));
    if (result.data) {
      const journey = await awardPieceForEntry(result.data);
      if (journey) useAppStore.getState().bumpJourney(`Peça ganha! ${result.data.tipo === 'saida_almoco' ? 'Saída do almoço' : result.data.tipo === 'volta_almoco' ? 'Retorno do almoço' : result.data.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada`);
    }
    return result;
  }
  catch (error) { return { data: null, error: friendly(error) }; }
}

export async function updateTimeEntry(
  id: string,
  updates: Partial<Pick<TimeEntry, 'registrado_em' | 'horario_informado_manual' | 'editado' | 'justificativa'>>,
): Promise<ServiceResult<TimeEntry>> {
  try {
    const uid = await currentUserId();
    const updatedAt = new Date().toISOString();
    const values = { ...updates, ...(updates.registrado_em ? { registrado_em: new Date(updates.registrado_em).toISOString() } : {}), editado: true, atualizado_em: updatedAt };
    const { data, error } = await supabase.from('time_entries').update(values).eq('id', id).eq('user_id', uid).select('*').single();
    if (error) return { data: null, error: friendly(error) };
    await withCacheLock(uid, async () => {
      const [cached, pending] = await Promise.all([readCache(uid), readPending(uid)]);
      await writeCache(uid, [...cached.filter((item) => item.id !== id), data as TimeEntry]);
      await writePending(uid, pending.filter((item) => item.id !== id));
    });
    return { data: data as TimeEntry, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function deleteTimeEntry(id: string): Promise<ServiceResult<void>> {
  try {
    const uid = await currentUserId();
    const { error } = await supabase.from('time_entries').delete().eq('id', id).eq('user_id', uid);
    if (error) return { data: null, error: friendly(error) };
    await withCacheLock(uid, async () => {
      const [cached, pending] = await Promise.all([readCache(uid), readPending(uid)]);
      await writeCache(uid, cached.filter((item) => item.id !== id));
      await writePending(uid, pending.filter((item) => item.id !== id));
    });
    return { data: null, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function savePendingEntry(input: TimeEntryInput): Promise<ServiceResult<TimeEntry>> {
  try {
    const uid = await currentUserId();
    const row = { ...makeRow(uid, input), _pending: true } as TimeEntry;
    await withCacheLock(uid, async () => {
      const [pending, cached] = await Promise.all([readPending(uid), readCache(uid)]);
      await writePending(uid, [...pending, row]);
      await writeCache(uid, [...cached, row]);
    });
    return { data: row, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function loadEntriesForCompleteHistory(): Promise<ServiceResult<TimeEntry[]>> {
  try {
    const uid = await currentUserId();
    const [cached, pending] = await Promise.all([readCache(uid), readPending(uid)]);
    const rows: TimeEntry[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('time_entries').select('*').eq('user_id', uid).order('registrado_em').range(offset, offset + pageSize - 1);
      if (error) {
        const merged = [...cached];
        for (const entry of pending) if (!merged.some((item) => item.id === entry.id)) merged.push(entry);
        return { data: merged.sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)), error: friendly(error) };
      }
      rows.push(...(data as TimeEntry[]));
      if ((data?.length ?? 0) < pageSize) break;
    }
    const merged = [...rows];
    for (const entry of pending) if (!merged.some((item) => item.id === entry.id)) merged.push(entry);
    const ordered = merged.sort((a, b) => a.registrado_em.localeCompare(b.registrado_em));
    return { data: ordered, error: null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function syncPendingEntries(): Promise<ServiceResult<{ synced: number; failed: number }>> {
  try {
    const uid = await currentUserId();
    const pending = await withCacheLock(uid, () => readPending(uid));
    const remaining: TimeEntry[] = [];
    let synced = 0;
    let firstError: string | null = null;
    for (const item of pending.sort((a, b) => a.registrado_em.localeCompare(b.registrado_em))) {
      const { _pending: _ignored, ...payload } = item as TimeEntry & { _pending?: boolean };
      const { data, error } = await supabase.from('time_entries').insert(payload).select('*').single();
      if (error) {
        if (error.code === '23505') {
          const existing = await supabase.from('time_entries').select('*').eq('id', item.id).eq('user_id', uid).maybeSingle();
          if (!existing.error && existing.data) {
            await withCacheLock(uid, async () => {
              const cache = await readCache(uid);
              await writeCache(uid, [...cache.filter((row) => row.id !== item.id), existing.data as TimeEntry]);
            });
            synced++;
            continue;
          }
        }
        remaining.push(item); firstError ||= friendly(error); continue;
      }
      await withCacheLock(uid, async () => {
        const cache = await readCache(uid);
        await writeCache(uid, [...cache.filter((row) => row.id !== item.id), data as TimeEntry]);
      });
      synced++;
    }
    await withCacheLock(uid, () => writePending(uid, remaining));
    return { data: { synced, failed: remaining.length }, error: firstError };
  } catch (error) { return { data: null, error: friendly(error) }; }
}
