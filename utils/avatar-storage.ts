export function avatarStorageKeys(userId: string) {
  const base = `olhaoponto:${userId}`;
  return { selected: `${base}:avatar-escolhido`, seen: `${base}:avatares-vistos`, pieces: `${base}:pecas-total`, steps: `${base}:sete-passos` };
}

export function nextPieceCount(current: number): number {
  return Math.max(0, Math.floor(current)) + 1;
}

export function parseCycles(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as { totalCycles?: unknown }).totalCycles !== 'number') return 0;
    const totalCycles = (parsed as { totalCycles: number }).totalCycles;
    return Number.isFinite(totalCycles) && totalCycles >= 0 ? Math.floor(totalCycles) : 0;
  } catch {
    return 0;
  }
}
