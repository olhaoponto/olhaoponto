import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeStreak as calculateStreak } from '@/utils/streak';
import { loadDayStatuses } from './day-status-service';
import { loadEntriesByDateRange } from './time-entry-service';
import { getAuthenticatedSession } from './auth-session';

export const COMPLETE_DAY_PUNCHES = 4;
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
export const computeStreak = calculateStreak;
export type { StreakResult } from '@/utils/streak';

const bestKey = (userId: string) => `olhaponto:${userId}:streak-best`;
const milestonesKey = (userId: string) => `olhaponto:${userId}:streak-milestones`;

function shiftCivilDate(civilDate: string, amount: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readBestValue(raw: string | null): number {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

async function currentUserId(): Promise<string | null> {
  return (await getAuthenticatedSession()).session?.user.id ?? null;
}

export async function loadStreak(today: string): Promise<ReturnType<typeof calculateStreak> | null> {
  const userId = await currentUserId();
  if (!userId || !isValidCivilDate(today)) return null;
  const start = shiftCivilDate(today, -119);
  const [entriesResult, statusesResult, rawBest] = await Promise.all([
    loadEntriesByDateRange(start, today),
    loadDayStatuses(start, today),
    AsyncStorage.getItem(bestKey(userId)),
  ]);
  const previousBest = readBestValue(rawBest);
  const result = calculateStreak(entriesResult.data ?? [], statusesResult.data ?? [], today, previousBest);
  if (result.recorde > previousBest) await AsyncStorage.setItem(bestKey(userId), String(result.recorde));
  return result;
}

export async function markStreakMilestones(current: number): Promise<number | null> {
  const userId = await currentUserId();
  if (!userId || current < 1) return null;
  let seen: number[] = [];
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(milestonesKey(userId))) || '[]');
    if (Array.isArray(parsed)) seen = parsed.filter((value): value is number => typeof value === 'number' && STREAK_MILESTONES.includes(value as typeof STREAK_MILESTONES[number]));
  } catch { /* segue com a lista vazia */ }
  const newMilestones = STREAK_MILESTONES.filter((milestone) => current >= milestone && !seen.includes(milestone));
  if (!newMilestones.length) return null;
  await AsyncStorage.setItem(milestonesKey(userId), JSON.stringify([...new Set([...seen, ...newMilestones])]));
  return newMilestones.at(-1) ?? null;
}
