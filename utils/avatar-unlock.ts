export type AvatarUnlockType = 'pecas' | 'ciclos' | 'puzzles';
export type AvatarUnlock = { tipo: AvatarUnlockType; valor: number };
export type AvatarProgress = { pecas: number; ciclos: number; puzzles: number };

export function isUnlocked(avatar: { unlock: AvatarUnlock }, progress: AvatarProgress): boolean {
  return progress[avatar.unlock.tipo] >= avatar.unlock.valor;
}
