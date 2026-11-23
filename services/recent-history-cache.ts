import type { DayStatusRecord, TimeEntry } from '@/types/app';
import { loadDayStatuses } from './day-status-service';
import { loadEntriesByDateRange } from './time-entry-service';

const TTL_MS = 5 * 60_000;

type RecentHistory = { entries: TimeEntry[]; statuses: DayStatusRecord[]; loadedAt: number };
const cache = new Map<string, RecentHistory>();
const inFlight = new Map<string, Promise<RecentHistory>>();

function shiftCivilDate(civilDate: string, amount: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

export function recentHistoryRange(today: string) {
  return { start: shiftCivilDate(today, -119), end: today };
}

export function invalidateRecentHistory(userId?: string) {
  if (userId) {
    for (const key of cache.keys()) if (key.startsWith(`${userId}:`)) cache.delete(key);
  } else cache.clear();
}

export async function loadRecentHistory(userId: string, today: string, force = false): Promise<RecentHistory> {
  const key = `${userId}:${today}`;
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.loadedAt < TTL_MS) return cached;
  const pending = inFlight.get(key);
  if (!force && pending) return pending;
  const { start, end } = recentHistoryRange(today);
  const request = Promise.all([loadEntriesByDateRange(start, end), loadDayStatuses(start, end)])
    .then(([entriesResult, statusesResult]) => {
      const value = { entries: entriesResult.data ?? [], statuses: statusesResult.data ?? [], loadedAt: Date.now() };
      cache.set(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
