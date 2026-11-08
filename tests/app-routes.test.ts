import { describe, expect, it } from 'vitest';
import { APP_ROUTES, APP_TAB_ROUTES } from '../utils/app-routes';

describe('rotas do menu principal', () => {
  it('usa o index do grupo de abas para Hoje, em vez de gerar o caminho raiz', () => {
    expect(APP_TAB_ROUTES.index).toBe('/(tabs)');
    expect(APP_TAB_ROUTES.index).not.toBe('/(tabs)/index');
  });

  it('mantém destinos próprios para as outras telas principais', () => {
    expect(APP_TAB_ROUTES.espelho).toBe('/(tabs)/espelho');
    expect(APP_TAB_ROUTES.resumo).toBe('/(tabs)/resumo');
    expect(APP_TAB_ROUTES.perfil).toBe('/(tabs)/perfil');
  });

  it('registra Agenda como rota de primeiro nível do mesmo projeto', () => {
    expect(APP_ROUTES.agenda).toBe('/agenda');
  });
});
