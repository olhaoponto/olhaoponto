import Constants from 'expo-constants';
import { isVersionNewer } from '@/utils/version-compare';

const RELEASES_URL = 'https://api.github.com/repos/olhaoponto/olhaoponto/releases/latest';
const APK_URL = 'https://github.com/olhaoponto/olhaoponto/releases/latest/download/olhaoponto.apk';
const REQUEST_TIMEOUT_MS = 8_000;

export type AppUpdate = {
  version: string;
  notes: string;
  releaseUrl: string;
  apkUrl: string;
};

export function getInstalledVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const release = await response.json() as { tag_name?: unknown; body?: unknown; html_url?: unknown };
    const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
    if (!isVersionNewer(tag, getInstalledVersion())) return null;
    return {
      version: tag.replace(/^v/i, ''),
      notes: typeof release.body === 'string' ? release.body : '',
      releaseUrl: typeof release.html_url === 'string' ? release.html_url : 'https://github.com/olhaoponto/olhaoponto/releases/latest',
      apkUrl: APK_URL,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
