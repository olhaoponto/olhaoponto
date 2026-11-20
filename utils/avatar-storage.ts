export function avatarStorageKeys(userId: string) {
  const base = `olhaoponto:${userId}`;
  return { selected: `${base}:avatar-escolhido`, seen: `${base}:avatares-vistos`, pieces: `${base}:pecas-total`, steps: `${base}:sete-passos` };
}

export function nextPieceCount(current: number): number {
  return Math.max(0, Math.floor(current)) + 1;
}
