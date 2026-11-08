export const DEFAULT_LUNCH_RETURN_WARNING_MINUTES = 5;
export const PRESET_LUNCH_RETURN_WARNING_MINUTES = [5, 10, 15] as const;
export const MAX_LUNCH_RETURN_WARNING_MINUTES = 180;

export function parseLunchReturnWarningMinutes(value: unknown): number | null {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  const minutes = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_LUNCH_RETURN_WARNING_MINUTES) return null;
  return minutes;
}

export function getLunchReturnWarningMinutes(value: unknown): number {
  return parseLunchReturnWarningMinutes(value) ?? DEFAULT_LUNCH_RETURN_WARNING_MINUTES;
}

export function calculateLunchReturnTimes(
  actualDepartureAt: string | Date,
  lunchMinutes: number,
  warningMinutes: unknown,
): { departureAt: Date; returnAt: Date; warningAt: Date } | null {
  const departureAt = actualDepartureAt instanceof Date ? new Date(actualDepartureAt.getTime()) : new Date(actualDepartureAt);
  const validWarningMinutes = parseLunchReturnWarningMinutes(warningMinutes);
  if (!Number.isFinite(departureAt.getTime()) || !Number.isInteger(lunchMinutes) || lunchMinutes < 0 || lunchMinutes > 480 || validWarningMinutes === null) return null;

  const returnAt = new Date(departureAt.getTime() + lunchMinutes * 60_000);
  const warningAt = new Date(returnAt.getTime() - validWarningMinutes * 60_000);
  return { departureAt, returnAt, warningAt };
}
