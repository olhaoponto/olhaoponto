import type { Href } from 'expo-router';

/** O index da aba Hoje é a rota do grupo, não `/(tabs)/index`. */
export const APP_TAB_ROUTES = {
  index: '/(tabs)' as Href,
  espelho: '/(tabs)/espelho' as Href,
  resumo: '/(tabs)/resumo' as Href,
  perfil: '/(tabs)/perfil' as Href,
} as const;

export type AppTabKey = keyof typeof APP_TAB_ROUTES;
