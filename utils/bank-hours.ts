import type { BalanceAdjustment } from '../types/app';
import { calculatePeriodTotals, type TimeEntry } from './work-time';

export function calculateBankBalance(
  entries: readonly TimeEntry[],
  adjustments: readonly Pick<BalanceAdjustment, 'saldo_minutos'>[],
  now: string | Date = new Date(),
): { appMinutes: number; externalMinutes: number; totalMinutes: number } {
  const appMinutes = calculatePeriodTotals(entries, now).overtimeMinutes;
  const externalMinutes = adjustments.reduce((sum, adjustment) => sum + adjustment.saldo_minutos, 0);
  return { appMinutes, externalMinutes, totalMinutes: appMinutes + externalMinutes };
}
