import type { Profile } from '../types/app';

export type AuthRouteRedirect = '/' | '/login' | '/(tabs)' | '/change-password' | '/terms';

export function isRouteProtected(routeRoot: string): boolean {
  return !['index', 'login', 'auth'].includes(routeRoot);
}

export function getAuthRouteRedirect(input: {
  routeRoot: string;
  sessionUserId?: string;
  profile?: Profile | null;
}): AuthRouteRedirect | null {
  const { routeRoot, sessionUserId, profile } = input;
  if (!isRouteProtected(routeRoot)) return null;
  if (!sessionUserId) return '/login';
  if (!profile || profile.id !== sessionUserId) return '/';
  if (!profile.ativo) return '/login';
  if (routeRoot === 'admin' && profile.role !== 'admin') return '/(tabs)';
  if (profile.senha_provisoria && routeRoot !== 'change-password') return '/change-password';
  if (!profile.aceite_termos_em && routeRoot !== 'terms' && routeRoot !== 'change-password') return '/terms';
  if (routeRoot === 'terms' && profile.senha_provisoria) return '/change-password';
  return null;
}
