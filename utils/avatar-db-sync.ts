export type AvatarSyncDecision =
  | { kind: 'ignore' }
  | { kind: 'use-database'; id: string }
  | { kind: 'upload'; id: string | null; source: 'pending' | 'local' };

export function isKnownAvatarId(id: string | null | undefined, validIds: ReadonlySet<string>): id is string {
  return typeof id === 'string' && validIds.has(id);
}

export function encodePendingAvatarId(id: string | null): string {
  return id ?? '';
}

export function decodePendingAvatarId(value: string | null): string | null | undefined {
  if (value === null) return undefined;
  return value || null;
}

export function decideAvatarSync(input: {
  dbId: string | null;
  localId: string | null;
  pendingId: string | null | undefined;
  validIds: ReadonlySet<string>;
}): AvatarSyncDecision {
  if (input.dbId !== null) {
    return isKnownAvatarId(input.dbId, input.validIds)
      ? { kind: 'use-database', id: input.dbId }
      : { kind: 'ignore' };
  }

  if (input.pendingId !== undefined) {
    return input.pendingId === null || isKnownAvatarId(input.pendingId, input.validIds)
      ? { kind: 'upload', id: input.pendingId, source: 'pending' }
      : { kind: 'ignore' };
  }

  return isKnownAvatarId(input.localId, input.validIds)
    ? { kind: 'upload', id: input.localId, source: 'local' }
    : { kind: 'ignore' };
}
