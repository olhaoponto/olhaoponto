export type VersionComparison = -1 | 0 | 1;

function parseVersion(value: string): [number, number, number] | null {
  const match = value.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left: string, right: string): VersionComparison | null {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

export function isVersionNewer(latest: string, installed: string): boolean {
  return compareVersions(latest, installed) === 1;
}
