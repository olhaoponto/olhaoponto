export type AchievementUnlockSeed<T extends { id: string }> = {
  /** Raw JSON stored under `olhaponto:<uid>:achievements`, or null when the user was never evaluated. */
  raw: string | null;
  /** Achievements already saved with an unlock date. */
  previous: readonly T[];
  /** Achievements the rules matched but that are not saved yet (already stamped with a date). */
  pending: readonly T[];
};

export type AchievementUnlockSeedResult<T extends { id: string }> = {
  /** Achievements to persist. */
  unlocked: T[];
  /** Achievements allowed to raise the "Nova conquista!" notice. */
  announce: T[];
  /** True when the user had no achievements key at all, so everything was seeded without a notice. */
  firstEvaluation: boolean;
};

/**
 * A first evaluation must not celebrate: a user who already has history on the server matches
 * several rules at once the first time they run, and warning about all of them on every login is
 * noise, not a reward. Only achievements earned after the key exists are announced.
 */
export function seedAchievementUnlocks<T extends { id: string }>(input: AchievementUnlockSeed<T>): AchievementUnlockSeedResult<T> {
  if (input.raw !== null) {
    return { unlocked: [...input.previous, ...input.pending], announce: [...input.pending], firstEvaluation: false };
  }
  return { unlocked: [...input.pending], announce: [], firstEvaluation: true };
}
