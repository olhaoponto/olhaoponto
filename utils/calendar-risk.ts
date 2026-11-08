import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { TimeEntry } from '@/types/app';

export const HARD_DAILY_LIMIT_MINUTES = 600;
const MINUTE_MS = 60_000;
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface EntryTimeEstimate {
  time: string;
  minutesAfterMidnight: number;
  sampleDays: number;
}

function civilDate(entry: TimeEntry, timeZone: string): string {
  if (entry.data && /^\d{4}-\d{2}-\d{2}$/.test(entry.data)) return entry.data;
  const stamp = new Date(entry.registrado_em);
  return Number.isFinite(stamp.getTime()) ? formatInTimeZone(stamp, timeZone, 'yyyy-MM-dd') : '';
}

function clockMinutes(stamp: string, timeZone: string): number | null {
  const date = new Date(stamp);
  if (!Number.isFinite(date.getTime())) return null;
  const clock = formatInTimeZone(date, timeZone, 'HH:mm');
  if (!CLOCK_PATTERN.test(clock)) return null;
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Median of up to five recent workdays; requires three recorded starts. */
export function estimateTypicalEntryTime(
  entries: readonly TimeEntry[],
  targetDate: string,
  timeZone = 'America/Bahia',
  recentDays = 5,
  minimumDays = 3,
): EntryTimeEstimate | null {
  const byDay = new Map<string, { minutes: number; stamp: number }>();
  for (const entry of entries) {
    if (entry.tipo !== 'entrada') continue;
    const day = civilDate(entry, timeZone);
    if (!day || day >= targetDate) continue;
    const stamp = Date.parse(entry.registrado_em);
    const minutes = clockMinutes(entry.registrado_em, timeZone);
    if (!Number.isFinite(stamp) || minutes === null) continue;
    const previous = byDay.get(day);
    if (!previous || stamp < previous.stamp) byDay.set(day, { minutes, stamp });
  }
  const recent = [...byDay.entries()]
    .sort(([dayA], [dayB]) => dayB.localeCompare(dayA))
    .slice(0, Math.max(1, recentDays))
    .map(([, value]) => value.minutes)
    .sort((a, b) => a - b);
  if (recent.length < Math.max(1, minimumDays)) return null;
  const middle = Math.floor(recent.length / 2);
  const median = recent.length % 2 ? recent[middle] : Math.round((recent[middle - 1] + recent[middle]) / 2);
  return {
    time: `${String(Math.floor(median / 60)).padStart(2, '0')}:${String(median % 60).padStart(2, '0')}`,
    minutesAfterMidnight: median,
    sampleDays: recent.length,
  };
}

export function isValidClock(value: string): boolean {
  return CLOCK_PATTERN.test(value);
}

export function zonedDateTime(date: string, clock: string, timeZone = 'America/Bahia'): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidClock(clock)) return null;
  try {
    const result = fromZonedTime(`${date}T${clock}:00`, timeZone);
    return Number.isFinite(result.getTime()) ? result : null;
  } catch {
    return null;
  }
}

export interface WorkedTimeProjection {
  minimumMinutes: number;
  maximumMinutes: number;
  breakEvidence: 'recorded' | 'not-started' | 'estimated';
}

/** Projects worked minutes through the meeting end without assuming a lunch clock time. */
export function projectWorkedRangeAt(
  entries: readonly TimeEntry[],
  date: string,
  meetingEnd: Date | string,
  lunchMinutes: number,
  timeZone = 'America/Bahia',
  expectedEntryTime?: string,
): WorkedTimeProjection | null {
  const end = meetingEnd instanceof Date ? meetingEnd.getTime() : Date.parse(meetingEnd);
  if (!Number.isFinite(end)) return null;
  const dayEntries = entries.filter((entry) => civilDate(entry, timeZone) === date);
  const recordedStart = dayEntries.find((entry) => entry.tipo === 'entrada');
  const start = recordedStart
    ? Date.parse(recordedStart.registrado_em)
    : expectedEntryTime
      ? zonedDateTime(date, expectedEntryTime, timeZone)?.getTime() ?? Number.NaN
      : Number.NaN;
  if (!Number.isFinite(start)) return null;
  if (end <= start) return { minimumMinutes: 0, maximumMinutes: 0, breakEvidence: 'estimated' };

  const lunchOutEntry = dayEntries.find((entry) => entry.tipo === 'saida_almoco');
  const lunchInEntry = dayEntries.find((entry) => entry.tipo === 'volta_almoco');
  const lunchOut = lunchOutEntry ? Date.parse(lunchOutEntry.registrado_em) : Number.NaN;
  const lunchIn = lunchInEntry ? Date.parse(lunchInEntry.registrado_em) : Number.NaN;
  const validLunchOut = Number.isFinite(lunchOut) && lunchOut >= start;
  if (validLunchOut && end < lunchOut) {
    const worked = Math.floor(Math.max(0, end - start) / MINUTE_MS);
    return { minimumMinutes: worked, maximumMinutes: worked, breakEvidence: 'not-started' };
  }
  if (validLunchOut) {
    const beforeLunch = Math.max(0, lunchOut - start);
    const expectedReturn = Number.isFinite(lunchIn) && lunchIn >= lunchOut
      ? lunchIn
      : lunchOut + Math.max(0, lunchMinutes) * MINUTE_MS;
    const afterLunch = Math.max(0, end - expectedReturn);
    const worked = Math.floor((beforeLunch + afterLunch) / MINUTE_MS);
    return { minimumMinutes: worked, maximumMinutes: worked, breakEvidence: 'recorded' };
  }
  const elapsed = Math.floor(Math.max(0, end - start) / MINUTE_MS);
  const possibleBreak = Math.max(0, Math.floor(lunchMinutes));
  return {
    minimumMinutes: Math.max(0, elapsed - possibleBreak),
    maximumMinutes: elapsed,
    breakEvidence: 'estimated',
  };
}

export function projectWorkedMinutesAt(
  entries: readonly TimeEntry[],
  date: string,
  meetingEnd: Date | string,
  lunchMinutes: number,
  timeZone = 'America/Bahia',
  expectedEntryTime?: string,
): number | null {
  return projectWorkedRangeAt(entries, date, meetingEnd, lunchMinutes, timeZone, expectedEntryTime)?.minimumMinutes ?? null;
}
