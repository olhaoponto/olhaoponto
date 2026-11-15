import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getAuthenticatedSession } from './auth-session';

export type RankingPeriod = 'semana' | 'geral';
export type RankingRow = { posicao: number; apelido: string; pecas: number; quebra_cabecas: number; eh_voce: boolean };
export type RankingResult = { rows: RankingRow[]; cachedAt: string | null; offline: boolean; error: string | null };
const key = (uid: string, period: RankingPeriod) => `olhaponto:${uid}:ranking:${period}`;

export async function loadRanking(period: RankingPeriod): Promise<RankingResult> {
  const session = await getAuthenticatedSession(); const uid = session.session?.user.id;
  if (!uid) return { rows: [], cachedAt: null, offline: true, error: 'Sessão não disponível.' };
  const cached = await AsyncStorage.getItem(key(uid, period)).catch(() => null);
  const parse = (raw: string | null) => { try { return raw ? JSON.parse(raw) as { rows: RankingRow[]; cachedAt: string } : null; } catch { return null; } };
  try {
    const { data, error } = await supabase.rpc('ranking_equipe', { p_periodo: period });
    if (!error && data) { const value = { rows: data as RankingRow[], cachedAt: new Date().toISOString() }; await AsyncStorage.setItem(key(uid, period), JSON.stringify(value)); return { ...value, offline: false, error: null }; }
    const fallback = parse(cached); return { rows: fallback?.rows ?? [], cachedAt: fallback?.cachedAt ?? null, offline: true, error: error?.message ?? 'Não foi possível atualizar.' };
  } catch (error) { const fallback = parse(cached); return { rows: fallback?.rows ?? [], cachedAt: fallback?.cachedAt ?? null, offline: true, error: error instanceof Error ? error.message : 'Sem conexão.' }; }
}

export async function updateRankingPreference(values: { participa: boolean; apelido: string | null }): Promise<{ error: string | null }> {
  const session = await getAuthenticatedSession(); const uid = session.session?.user.id;
  if (!uid) return { error: 'Sessão não disponível.' };
  const apelido = values.apelido?.trim() || null;
  if (values.participa && (!apelido || !/^[A-Za-zÀ-ÿ0-9 ._-]{2,20}$/.test(apelido))) return { error: 'Use um apelido de 2 a 20 caracteres.' };
  const { error } = await supabase.from('profiles').update({ ranking_participa: values.participa, ranking_apelido: values.participa ? apelido : null, ranking_aceite_em: values.participa ? new Date().toISOString() : null }).eq('id', uid);
  return { error: error?.message ?? null };
}
