import type { DayOccurrence, DayStatusRecord } from '@/types/app';

export function keepCachedOnError<T>(cached: readonly T[]): T[] {
  return [...cached];
}

export function mergeDayOccurrence(
  cached: readonly DayOccurrence[],
  workDate: string,
  remote: DayOccurrence | null,
): { rows: DayOccurrence[]; data: DayOccurrence | null } {
  const local = cached.find((row) => row.work_date === workDate) ?? null;
  const kept = cached.filter((row) => row.work_date !== workDate);
  if (remote) return { rows: [...kept, remote], data: remote };
  if (local?._pending) return { rows: [...kept, local], data: local };
  return { rows: kept, data: null };
}

export function mergeDayOccurrences(
  cached: readonly DayOccurrence[],
  remote: readonly DayOccurrence[],
): DayOccurrence[] {
  const merged = new Map<string, DayOccurrence>();
  for (const row of remote) merged.set(row.work_date, row);
  for (const row of cached) if (row._pending) merged.set(row.work_date, row);
  return [...merged.values()].sort((a, b) => b.work_date.localeCompare(a.work_date));
}

export function mergeDayStatuses(
  cached: readonly DayStatusRecord[],
  remote: readonly DayStatusRecord[],
  startDate: string,
  endDate: string,
): DayStatusRecord[] {
  const merged = new Map<string, DayStatusRecord>();
  for (const row of remote) merged.set(row.data, row);
  for (const row of cached) {
    if (row._pending || row.data < startDate || row.data > endDate) merged.set(row.data, row);
  }
  return [...merged.values()].sort((a, b) => a.data.localeCompare(b.data));
}
