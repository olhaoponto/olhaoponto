const MAX_HIDDEN_COMMUNICATIONS = 200;

export function pruneHiddenCommunicationIds(ids: readonly string[], limit = MAX_HIDDEN_COMMUNICATIONS): string[] {
  const validLimit = Math.max(0, Math.floor(limit));
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(-validLimit);
}

export function parseHiddenCommunicationIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? pruneHiddenCommunicationIds(parsed.filter((item): item is string => typeof item === 'string')) : [];
  } catch {
    return [];
  }
}

export function serializeHiddenCommunicationIds(ids: readonly string[]): string {
  return JSON.stringify(pruneHiddenCommunicationIds(ids));
}

export function addHiddenCommunicationId(ids: readonly string[], id: string): string[] {
  return pruneHiddenCommunicationIds([...ids, id]);
}
