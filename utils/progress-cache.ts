export type ProgressCacheValue = {
  pecas: number;
  ciclos: number;
  puzzles: number;
};

const cache = new Map<string, ProgressCacheValue>();

export function getProgressCache(uid: string): ProgressCacheValue | undefined {
  return cache.get(uid);
}

export function setProgressCache(uid: string, progress: ProgressCacheValue): void {
  cache.set(uid, progress);
}

export function invalidateProgressCache(uid: string): void {
  cache.delete(uid);
}

export function clearProgressCache(): void {
  cache.clear();
}
