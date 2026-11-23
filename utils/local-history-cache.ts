import type { DayStatusRecord, TimeEntry } from '@/types/app';

export const LOCAL_CACHE_WINDOW_DAYS = 150;
export const AGENDA_HISTORY_WINDOW_DAYS = 180;

function shiftCivilDate(civilDate: string, amount: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

export function cacheWindowStart(today: string, days = LOCAL_CACHE_WINDOW_DAYS): string {
  return shiftCivilDate(today, -(days - 1));
}

export function pruneByCivilDate<T extends { data: string; _pending?: boolean }>(rows: readonly T[], today: string, getDate: (row: T) => string, days = LOCAL_CACHE_WINDOW_DAYS): T[] {
  const start = cacheWindowStart(today, days);
  return rows.filter((row) => row._pending === true || getDate(row) >= start && getDate(row) <= today);
}

export function pruneTimeEntries(rows: readonly TimeEntry[], today: string): TimeEntry[] {
  return pruneByCivilDate(rows, today, (row) => row.data);
}

export function pruneDayStatuses(rows: readonly DayStatusRecord[], today: string): DayStatusRecord[] {
  return pruneByCivilDate(rows, today, (row) => row.data);
}

export function rowsSignature<T>(rows: readonly T[]): string {
  return JSON.stringify(rows);
}

export function rowsChanged<T>(before: readonly T[], after: readonly T[]): boolean {
  return rowsSignature(before) !== rowsSignature(after);
}
