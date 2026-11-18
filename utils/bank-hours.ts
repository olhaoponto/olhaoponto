import type { BalanceAdjustment } from '../types/app';
import { calculatePeriodTotals, type TimeEntry } from './work-time';
import { DEFAULT_WORK_SCHEDULE } from './work-schedules';
import type { WorkSchedule } from '../types/app';
import type { DayOccurrence } from '../types/app';

export function calculateBankBalance(
  entries: readonly TimeEntry[],
  adjustments: readonly Pick<BalanceAdjustment, 'saldo_minutos'>[],
  now: string | Date = new Date(),
  workSchedule: WorkSchedule = DEFAULT_WORK_SCHEDULE,
  occurrences: readonly Pick<DayOccurrence, 'debito_minutos'>[] = [],
): { appMinutes: number; externalMinutes: number; occurrenceMinutes?: number; totalMinutes: number } {
  const appMinutes = calculatePeriodTotals(entries, now, workSchedule).overtimeMinutes;
  const externalMinutes = adjustments.reduce((sum, adjustment) => sum + adjustment.saldo_minutos, 0);
  const occurrenceMinutes = occurrences.reduce((sum, occurrence) => sum - Math.max(0, occurrence.debito_minutos), 0);
  return { appMinutes, externalMinutes, ...(occurrences.length ? { occurrenceMinutes } : {}), totalMinutes: appMinutes + externalMinutes + occurrenceMinutes };
}
