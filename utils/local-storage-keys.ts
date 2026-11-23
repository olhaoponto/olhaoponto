/** Namespaces of AsyncStorage that survive a logout: progress the user built by
 * using the app (avatars, peças, Sete Passos, conquistas e sequência). Everything
 * else under the user namespace is a cache or a queue and is dropped. */
export const PRESERVED_USER_DATA_PREFIXES = [
  'avatar-escolhido',
  'avatares-vistos',
  'avatares-baseline',
  'pecas-total',
  'sete-passos',
  'achievements',
  'streak-best',
  'streak-milestones',
  'lunch-game',
  'mission-events:',
] as const;

/** The app-name typo is still alive in storage: avatars/Sete Passos are written as
 * `olhaoponto:` while everything else uses `olhaponto:`. Both spellings must be
 * cleared (and preserved) so no progress is lost on logout. */
const USER_DATA_NAMESPACES = ['olhaponto', 'olhaoponto'] as const;

export function userDataKeyPrefix(userId: string): string {
  return `olhaponto:${userId}:`;
}

export function isUserDataKey(key: string, userId: string): boolean {
  return USER_DATA_NAMESPACES.some((namespace) => key.startsWith(`${namespace}:${userId}:`));
}

/** Suffix of a user key, i.e. what comes right after `olhaponto:<uid>:`. */
export function userDataKeySuffix(key: string, userId: string): string {
  for (const namespace of USER_DATA_NAMESPACES) {
    const prefix = `${namespace}:${userId}:`;
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  }
  return '';
}

export function isPreservedUserDataKey(key: string, userId: string): boolean {
  const suffix = userDataKeySuffix(key, userId);
  return suffix.length > 0 && PRESERVED_USER_DATA_PREFIXES.some((prefix) => suffix.startsWith(prefix));
}

/** Splits the keys owned by a user into what logout keeps and what it drops. */
export function partitionUserDataKeys(keys: readonly string[], userId: string): { preserved: string[]; removable: string[] } {
  const preserved: string[] = [];
  const removable: string[] = [];
  for (const key of keys) {
    if (!isUserDataKey(key, userId)) continue;
    (isPreservedUserDataKey(key, userId) ? preserved : removable).push(key);
  }
  return { preserved, removable };
}
