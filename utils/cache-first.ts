export function serveCached<T>(rows: readonly T[], onCached?: (rows: T[]) => void): T[] {
  const snapshot = [...rows];
  onCached?.(snapshot);
  return snapshot;
}
