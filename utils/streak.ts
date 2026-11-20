export const COMPLETE_DAY_PUNCHES = 4;

export interface StreakResult {
  atual: number;
  recorde: number;
  emRisco: boolean;
}

type Entry = { data: string };
type Status = { data: string; status: 'working' | 'rest' | 'absence' | 'medical_leave' };

function shiftCivilDate(civilDate: string, amount: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function computeStreak(
  entries: readonly Entry[],
  statuses: readonly Status[],
  today: string,
  previousBest = 0,
): StreakResult {
  if (!isValidCivilDate(today)) return { atual: 0, recorde: Math.max(0, Math.floor(previousBest)), emRisco: false };

  const countByDate = new Map<string, number>();
  for (const entry of entries) countByDate.set(entry.data, (countByDate.get(entry.data) ?? 0) + 1);
  const statusByDate = new Map(statuses.map((item) => [item.data, item.status]));
  const todayStatus = statusByDate.get(today);
  const todayComplete = (countByDate.get(today) ?? 0) >= COMPLETE_DAY_PUNCHES;
  let emRisco = false;
  let cursor = today;

  if (todayStatus === 'rest' || todayStatus === 'medical_leave') {
    cursor = shiftCivilDate(cursor, -1);
  } else if (todayStatus === 'absence') {
    return { atual: 0, recorde: Math.max(0, Math.floor(previousBest)), emRisco: false };
  } else if (todayComplete) {
    cursor = shiftCivilDate(cursor, -1);
  } else {
    emRisco = true;
    cursor = shiftCivilDate(cursor, -1);
  }

  let atual = todayComplete ? 1 : 0;
  while (true) {
    const status = statusByDate.get(cursor);
    if (status === 'rest' || status === 'medical_leave') {
      cursor = shiftCivilDate(cursor, -1);
      continue;
    }
    if (status === 'absence' || (countByDate.get(cursor) ?? 0) < COMPLETE_DAY_PUNCHES) break;
    atual += 1;
    cursor = shiftCivilDate(cursor, -1);
  }

  const safeBest = Number.isFinite(previousBest) ? Math.max(0, Math.floor(previousBest)) : 0;
  return { atual, recorde: Math.max(safeBest, atual), emRisco };
}
