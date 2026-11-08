import { describe, expect, it } from 'vitest';
import type { Profile } from '../types/app';
import { getAuthRouteRedirect, isRouteProtected } from '../utils/auth-route';

const profile: Profile = {
  id: 'user-1', nome: 'Usuário', email: 'user@example.com', role: 'user', ativo: true,
  senha_provisoria: false, aceite_termos_em: '2026-01-01T00:00:00Z', aceite_termos_versao: '1',
  almoco_minutos: 60, limite_minutos: 600, fuso: 'America/Bahia', preferencias_alerta: null,
};

describe('auth route guard', () => {
  it('protects tabs and detail screens while leaving splash/login/recovery public', () => {
    expect(isRouteProtected('(tabs)')).toBe(true);
    expect(isRouteProtected('admin')).toBe(true);
    expect(isRouteProtected('agenda')).toBe(true);
    expect(isRouteProtected('login')).toBe(false);
    expect(isRouteProtected('index')).toBe(false);
    expect(isRouteProtected('auth')).toBe(false);
  });

  it('redirects an unauthenticated back/deep-link to login', () => {
    expect(getAuthRouteRedirect({ routeRoot: '(tabs)' })).toBe('/login');
    expect(getAuthRouteRedirect({ routeRoot: 'agenda' })).toBe('/login');
    expect(getAuthRouteRedirect({ routeRoot: 'bank-hours', sessionUserId: 'user-1' })).toBe('/');
  });

  it('keeps a provisional-password user on the password route before terms', () => {
    expect(getAuthRouteRedirect({ routeRoot: 'terms', sessionUserId: 'user-1', profile: { ...profile, senha_provisoria: true, aceite_termos_em: null } })).toBe('/change-password');
    expect(getAuthRouteRedirect({ routeRoot: '(tabs)', sessionUserId: 'user-1', profile: { ...profile, senha_provisoria: true } })).toBe('/change-password');
  });

  it('requires accepted terms before protected app screens and rejects non-admin admin links', () => {
    expect(getAuthRouteRedirect({ routeRoot: '(tabs)', sessionUserId: 'user-1', profile: { ...profile, aceite_termos_em: null } })).toBe('/terms');
    expect(getAuthRouteRedirect({ routeRoot: 'admin', sessionUserId: 'user-1', profile })).toBe('/(tabs)');
    expect(getAuthRouteRedirect({ routeRoot: '(tabs)', sessionUserId: 'user-1', profile })).toBeNull();
  });

  it('protege a rota de boas-vindas e só a libera após autenticação e aceite', () => {
    expect(isRouteProtected('welcome')).toBe(true);
    expect(getAuthRouteRedirect({ routeRoot: 'welcome' })).toBe('/login');
    expect(getAuthRouteRedirect({ routeRoot: 'welcome', sessionUserId: 'user-1', profile: { ...profile, aceite_termos_em: null } })).toBe('/terms');
    expect(getAuthRouteRedirect({ routeRoot: 'welcome', sessionUserId: 'user-1', profile })).toBeNull();
  });
});
