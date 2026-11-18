import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getAuthenticatedSession } from './auth-session';

export type RankingPeriod = 'semana' | 'geral';
export type RankingRow = { posicao: number; nome: string; pontos: number; dias: number; eh_voce: boolean };
export type RankingResult = { rows: RankingRow[]; cachedAt: string | null; offline: boolean; error: string | null };

const key = (uid: string, period: RankingPeriod) => `olhaponto:${uid}:ranking-pontos:${period}`;

function parseCache(raw: string | null): { rows: RankingRow[]; cachedAt: string } | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw) as { rows?: unknown; cachedAt?: unknown };
    if (!Array.isArray(value.rows) || typeof value.cachedAt !== 'string') return null;
    return { rows: value.rows as RankingRow[], cachedAt: value.cachedAt };
  } catch {
    return null;
  }
}

export async function loadRanking(period: RankingPeriod): Promise<RankingResult> {
  const session = await getAuthenticatedSession();
  const uid = session.session?.user.id;
  if (!uid) return { rows: [], cachedAt: null, offline: true, error: 'Sessão não disponível.' };
  const cached = await AsyncStorage.getItem(key(uid, period)).catch(() => null);
  try {
    const { data, error } = await supabase.rpc('ranking_pontos', { p_periodo: period });
    if (!error && data) {
      const value = { rows: data as RankingRow[], cachedAt: new Date().toISOString() };
      await AsyncStorage.setItem(key(uid, period), JSON.stringify(value));
      return { ...value, offline: false, error: null };
    }
    const fallback = parseCache(cached);
    return { rows: fallback?.rows ?? [], cachedAt: fallback?.cachedAt ?? null, offline: true, error: error?.message ?? 'Não foi possível atualizar.' };
  } catch (error) {
    const fallback = parseCache(cached);
    return { rows: fallback?.rows ?? [], cachedAt: fallback?.cachedAt ?? null, offline: true, error: error instanceof Error ? error.message : 'Sem conexão.' };
  }
}

export async function updateRankingVisibility(visible: boolean): Promise<{ error: string | null }> {
  const session = await getAuthenticatedSession();
  const uid = session.session?.user.id;
  if (!uid) return { error: 'Sessão não disponível.' };
  try {
    const { error } = await supabase.from('profiles').update({ ranking_oculto: !visible }).eq('id', uid);
    return { error: error?.message ?? null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível atualizar a visibilidade do ranking.' };
  }
}
