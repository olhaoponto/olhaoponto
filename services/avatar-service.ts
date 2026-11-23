import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Avatar, AvatarProgress } from '@/utils/avatar-catalog';
import { AVATARS, isUnlocked } from '@/utils/avatar-catalog';
import { getAuthenticatedSession } from '@/services/auth-session';
import { loadJourney } from '@/services/journey-service';
import { supabase } from '@/services/supabase';
import { avatarStorageKeys, nextPieceCount, parseCycles } from '@/utils/avatar-storage';
import { getAvatarAnnouncement } from '@/utils/avatar-unlock-state';
import { getProgressCache, invalidateProgressCache, setProgressCache } from '@/utils/progress-cache';

export { invalidateProgressCache };

const selectedKey = (userId: string) => avatarStorageKeys(userId).selected;
const seenKey = (userId: string) => avatarStorageKeys(userId).seen;
const piecesKey = (userId: string) => avatarStorageKeys(userId).pieces;
const stepsKey = (userId: string) => avatarStorageKeys(userId).steps;
const baselineKey = (userId: string) => `olhaponto:${userId}:avatares-baseline`;

const selectedCache = new Map<string, string | null>();
const selectedLoads = new Map<string, Promise<string | null>>();
const progressLoads = new Map<string, Promise<AvatarProgress>>();

async function userId() { return (await getAuthenticatedSession()).session?.user.id ?? null; }
async function readNumber(key: string) {
  const value = Number(await AsyncStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
async function readIds(key: string) {
  try {
    const value = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

export async function getSelectedAvatarId(): Promise<string | null> {
  const uid = await userId();
  if (!uid) return null;
  if (selectedCache.has(uid)) return selectedCache.get(uid) ?? null;
  const current = selectedLoads.get(uid);
  if (current) return current;
  const load = AsyncStorage.getItem(selectedKey(uid)).then((id) => {
    selectedCache.set(uid, id);
    selectedLoads.delete(uid);
    return id;
  }).catch((error) => {
    selectedLoads.delete(uid);
    throw error;
  });
  selectedLoads.set(uid, load);
  return load;
}

export function getCachedSelectedAvatarId(uid: string | null | undefined): string | null {
  return uid && selectedCache.has(uid) ? selectedCache.get(uid) ?? null : null;
}

export async function setSelectedAvatar(id: string | null): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  if (id) await AsyncStorage.setItem(selectedKey(uid), id);
  else await AsyncStorage.removeItem(selectedKey(uid));
  selectedCache.set(uid, id);
}

export async function markAvatarsSeen(ids: readonly string[]): Promise<void> {
  const uid = await userId();
  if (!uid || !ids.length) return;
  const seen = new Set(await readIds(seenKey(uid)));
  ids.forEach((id) => seen.add(id));
  await AsyncStorage.setItem(seenKey(uid), JSON.stringify([...seen]));
}

export async function recordNewPiece(): Promise<number> {
  const uid = await userId();
  if (!uid) return 0;
  const next = nextPieceCount(await readNumber(piecesKey(uid)));
  await AsyncStorage.setItem(piecesKey(uid), String(next));
  invalidateProgressCache(uid);
  return next;
}

export async function getProgress(): Promise<AvatarProgress> {
  const uid = await userId();
  if (!uid) return { pecas: 0, ciclos: 0, puzzles: 0 };
  const cached = getProgressCache(uid);
  if (cached) return cached;
  const current = progressLoads.get(uid);
  if (current) return current;
  const load = Promise.all([
    readNumber(piecesKey(uid)), loadJourney(), AsyncStorage.getItem(stepsKey(uid)).then(parseCycles),
    supabase.from('jornada_niveis').select('concluido_em').eq('usuario_id', uid).not('concluido_em', 'is', null).limit(100),
  ]).then(([counter, journey, steps, levels]) => {
    const journeyPieces = journey?.pieces.length ?? 0;
    const completedLevels = levels.error ? (journey?.level.concluido_em ? 1 : 0) : (levels.data?.length ?? 0);
    const progress = { pecas: Math.max(counter, journeyPieces), ciclos: steps, puzzles: completedLevels };
    setProgressCache(uid, progress);
    progressLoads.delete(uid);
    return progress;
  }).catch((error) => {
    progressLoads.delete(uid);
    throw error;
  });
  progressLoads.set(uid, load);
  return load;
}

export async function getUnseenUnlockedAvatars(progress: AvatarProgress): Promise<Avatar[]> {
  const uid = await userId();
  if (!uid) return [];
  const seen = new Set(await readIds(seenKey(uid)));
  return AVATARS.filter((avatar) => isUnlocked(avatar, progress) && !seen.has(avatar.id));
}

export async function prepareAvatarAnnouncements(progress: AvatarProgress): Promise<Avatar[]> {
  const uid = await userId();
  if (!uid) return [];
  const [baseline, seen] = await Promise.all([AsyncStorage.getItem(baselineKey(uid)), readIds(seenKey(uid))]);
  const unlocked = AVATARS.filter((avatar) => isUnlocked(avatar, progress));
  const decision = getAvatarAnnouncement({ baselineDone: baseline === '1', unlockedIds: unlocked.map((avatar) => avatar.id), seenIds: seen });
  const baselineSeen = new Set([...seen, ...decision.baselineIds]);
  if (baseline !== '1') await AsyncStorage.setItem(baselineKey(uid), '1');
  if (baselineSeen.size !== seen.length) await AsyncStorage.setItem(seenKey(uid), JSON.stringify([...baselineSeen]));
  const announce = new Set(decision.announceIds);
  return unlocked.filter((avatar) => announce.has(avatar.id));
}

export async function getUnlockedAvatars(progress: AvatarProgress): Promise<Avatar[]> {
  return AVATARS.filter((avatar) => isUnlocked(avatar, progress));
}
