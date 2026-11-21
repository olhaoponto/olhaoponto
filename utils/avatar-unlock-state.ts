export function getAvatarAnnouncement(input: {
  baselineDone: boolean;
  unlockedIds: readonly string[];
  seenIds: readonly string[];
}): { baselineIds: string[]; announceIds: string[] } {
  if (!input.baselineDone) {
    return { baselineIds: [...new Set(input.unlockedIds)], announceIds: [] };
  }
  const seen = new Set(input.seenIds);
  return {
    baselineIds: [],
    announceIds: input.unlockedIds.filter((id) => !seen.has(id)),
  };
}
