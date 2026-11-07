import type { AlertPreferences, DayStatusRecord, TimeEntry, WorkSchedule } from '../types/app';
import { calculateWorkedSeconds } from './work-time';
import { getExpectedWorkMinutesForDate, getWorkScheduleForDate } from './work-schedules';

const PUNCH_TYPES = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'] as const;
const SKIPPED_STATUSES = new Set(['rest', 'absence', 'medical_leave']);

function shiftDate(civilDate: string, amount: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

export interface WeeklyMissionSummary {
  startDate: string;
  endDate: string;
  goal: number;
  completed: number;
  balanceMinutes: number;
  completedDays: string[];
}

/** Progress celebrates a resolved daily record, not attendance, worked hours, or overtime. */
export function getWeeklyMissionSummary(
  civilDate: string,
  entries: readonly TimeEntry[],
  statuses: readonly DayStatusRecord[],
  preferences?: AlertPreferences | null,
  fallbackLunchMinutes = 60,
): WeeklyMissionSummary {
  const [year, month, day] = civilDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const startDate = shiftDate(civilDate, -mondayOffset);
  const statusByDate = new Map(statuses.map((item) => [item.data, item.status]));
  const entriesByDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) entriesByDate.set(entry.data, [...(entriesByDate.get(entry.data) ?? []), entry]);
  const considered: string[] = [];
  const resolved: string[] = [];
  let balanceMinutes = 0;

  for (let offset = 0; offset <= mondayOffset; offset++) {
    const date = shiftDate(startDate, offset);
    const dateAnchor = new Date(`${date}T12:00:00.000Z`);
    const dayOfWeek = dateAnchor.getUTCDay();
    const status = statusByDate.get(date);
    const schedule = getWorkScheduleForDate(preferences, date, fallbackLunchMinutes);
    const scheduled = schedule.work_days.includes(dayOfWeek);
    const isWorking = status === 'working' || scheduled;
    const dayEntries = entriesByDate.get(date) ?? [];
    const fullRecord = PUNCH_TYPES.every((type) => dayEntries.some((item) => item.tipo === type));
    const excluded = status ? SKIPPED_STATUSES.has(status) : false;
    if (isWorking || status) considered.push(date);
    if (excluded || fullRecord) resolved.push(date);

    // Only compare completed four-punch days; incomplete days are not inferred as deficits.
    if (!excluded && isWorking && fullRecord) {
      const actualMinutes = Math.floor(calculateWorkedSeconds(dayEntries, new Date()) / 60);
      balanceMinutes += actualMinutes - getExpectedWorkMinutesForDate(schedule, date);
    }
  }

  const goal = Math.min(3, Math.max(1, considered.length));
  return { startDate, endDate: shiftDate(startDate, 6), goal, completed: Math.min(goal, resolved.length), balanceMinutes, completedDays: resolved };
}

export function getScheduledDayForDate(preferences: AlertPreferences | null | undefined, civilDate: string, fallbackLunchMinutes = 60): WorkSchedule {
  return getWorkScheduleForDate(preferences, civilDate, fallbackLunchMinutes);
}
