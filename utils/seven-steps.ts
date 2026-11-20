import type { AlertPreferences, DayStatusRecord, TimeEntry } from '@/types/app';
import { getWorkScheduleForDate } from '@/utils/work-schedules';

const PUNCH_TYPES = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'] as const;
const SKIPPED_STATUSES = new Set(['rest', 'absence', 'medical_leave', 'holiday', 'feriado']);
const MAX_LOOKBACK_DAYS = 370;

export type SevenStepsResult = {
  step: number;
  completed: boolean;
  rewardDue: boolean;
  lastResolvedDate: string | null;
};

type SevenStepsStatus = Pick<DayStatusRecord, 'data'> & { status: string };

function shiftDate(civilDate: string, amount: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

function weekdayOf(civilDate: string): number {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function computeSevenSteps(
  civilDate: string,
  entries: readonly TimeEntry[],
  statuses: readonly SevenStepsStatus[],
  preferences?: AlertPreferences | null,
  lastRewardedEndDate?: string | null,
): SevenStepsResult {
  const statusByDate = new Map(statuses.map((item) => [item.data, item.status]));
  const entriesByDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) entriesByDate.set(entry.data, [...(entriesByDate.get(entry.data) ?? []), entry]);

  let step = 0;
  let lastResolvedDate: string | null = null;
  for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset += 1) {
    const date = shiftDate(civilDate, -offset);
    if (lastRewardedEndDate && date <= lastRewardedEndDate) break;

    const status = statusByDate.get(date);
    const statusIsSkipped = Boolean(status && SKIPPED_STATUSES.has(status));
    if (statusIsSkipped || weekdayOf(date) === 0 || weekdayOf(date) === 6) continue;

    const schedule = getWorkScheduleForDate(preferences, date);
    const scheduled = schedule.work_days.includes(weekdayOf(date));
    const isWorking = status === 'working' || scheduled;
    if (!isWorking) continue;

    const dayEntries = entriesByDate.get(date) ?? [];
    const resolved = PUNCH_TYPES.every((type) => dayEntries.some((entry) => entry.tipo === type));
    if (!resolved) {
      if (offset === 0) continue;
      break;
    }
    step += 1;
    lastResolvedDate ??= date;
    if (step === 7) break;
  }

  const completed = step === 7;
  return {
    step,
    completed,
    rewardDue: completed && lastResolvedDate !== lastRewardedEndDate,
    lastResolvedDate,
  };
}
