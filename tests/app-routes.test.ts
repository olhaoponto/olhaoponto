import { describe, expect, it } from 'vitest';
import { APP_ROUTES, APP_TAB_ROUTES } from '../utils/app-routes';

describe('rotas do menu principal', () => {
  it('mantém as quatro áreas principais na ordem HOJE, ESPELHO, RESUMO e AGENDA', () => {
    expect(Object.keys(APP_TAB_ROUTES)).toEqual(['index', 'espelho', 'resumo', 'agenda']);
    expect(APP_TAB_ROUTES.index).toBe('/(tabs)');
    expect(APP_TAB_ROUTES.index).not.toBe('/(tabs)/index');
    expect(APP_TAB_ROUTES.espelho).toBe('/(tabs)/espelho');
    expect(APP_TAB_ROUTES.resumo).toBe('/(tabs)/resumo');
    expect(APP_TAB_ROUTES.agenda).toBe('/agenda');
  });

  it('mantém Perfil e Configurações fora do menu principal', () => {
    expect(APP_ROUTES.perfil).toBe('/(tabs)/perfil');
    expect(APP_ROUTES.configuracoes).toBe('/configuracoes');
  });
});
