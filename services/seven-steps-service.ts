import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AlertPreferences, DayStatusRecord, TimeEntry } from '@/types/app';
import { getAuthenticatedSession } from '@/services/auth-session';
import { awardBonusPiece } from '@/services/journey-service';
import { computeSevenSteps, type SevenStepsResult } from '@/utils/seven-steps';

const storageKey = (userId: string) => `olhaoponto:${userId}:sete-passos`;

type StoredSevenSteps = { lastRewardedEndDate: string | null; totalCycles: number };
export type SevenStepsState = SevenStepsResult & { rewardGranted: boolean; totalCycles: number };

async function readStored(userId: string): Promise<StoredSevenSteps> {
  try {
    const value = JSON.parse((await AsyncStorage.getItem(storageKey(userId))) || 'null') as Partial<StoredSevenSteps> | null;
    return {
      lastRewardedEndDate: typeof value?.lastRewardedEndDate === 'string' ? value.lastRewardedEndDate : null,
      totalCycles: typeof value?.totalCycles === 'number' && Number.isFinite(value.totalCycles) ? value.totalCycles : 0,
    };
  } catch {
    return { lastRewardedEndDate: null, totalCycles: 0 };
  }
}

export async function loadSevenSteps(input: {
  civilDate: string;
  entries: readonly TimeEntry[];
  statuses: readonly (Pick<DayStatusRecord, 'data'> & { status: string })[];
  preferences?: AlertPreferences | null;
}): Promise<SevenStepsState> {
  const session = await getAuthenticatedSession();
  const userId = session.session?.user.id;
  if (!userId) return { ...computeSevenSteps(input.civilDate, input.entries, input.statuses, input.preferences), rewardGranted: false, totalCycles: 0 };

  const stored = await readStored(userId);
  const computed = computeSevenSteps(input.civilDate, input.entries, input.statuses, input.preferences, stored.lastRewardedEndDate);
  if (!computed.rewardDue || !computed.lastResolvedDate) return { ...computed, rewardGranted: false, totalCycles: stored.totalCycles };

  const journey = await awardBonusPiece(computed.lastResolvedDate);
  const bonusExists = Boolean(journey?.pieces.some((piece) => piece.data === computed.lastResolvedDate && piece.origem === 'bonus'));
  if (!bonusExists) return { ...computed, rewardGranted: false, totalCycles: stored.totalCycles };

  const nextStored = { lastRewardedEndDate: computed.lastResolvedDate, totalCycles: stored.totalCycles + 1 };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(nextStored)).catch(() => undefined);
  return { ...computed, rewardDue: false, rewardGranted: true, totalCycles: nextStored.totalCycles };
}
