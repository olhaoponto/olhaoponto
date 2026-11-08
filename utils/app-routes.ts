import type { Href } from 'expo-router';

export const APP_ROUTES = {
  agenda: '/agenda' as Href,
  perfil: '/(tabs)/perfil' as Href,
  configuracoes: '/configuracoes' as Href,
} as const;

/** O cartão compartilhado navega entre as quatro áreas principais, mesmo com a tab bar nativa oculta. */
export const APP_TAB_ROUTES = {
  index: '/(tabs)' as Href,
  espelho: '/(tabs)/espelho' as Href,
  resumo: '/(tabs)/resumo' as Href,
  agenda: APP_ROUTES.agenda,
} as const;

export type AppTabKey = keyof typeof APP_TAB_ROUTES;
