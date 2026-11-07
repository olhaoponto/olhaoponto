export function getCivilWeekday(civilDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(civilDate)) return -1;
  const anchor = new Date(`${civilDate}T12:00:00.000Z`);
  return Number.isFinite(anchor.getTime()) && anchor.toISOString().slice(0, 10) === civilDate ? anchor.getUTCDay() : -1;
}

export function addCivilDays(civilDate: string, amount: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

export function getWeekDateRange(civilDate: string): { startDate: string; endDate: string } {
  const weekday = getCivilWeekday(civilDate);
  if (weekday < 0) return { startDate: civilDate, endDate: civilDate };
  const mondayOffset = (weekday + 6) % 7;
  const startDate = addCivilDays(civilDate, -mondayOffset);
  return { startDate, endDate: addCivilDays(startDate, 6) };
}
