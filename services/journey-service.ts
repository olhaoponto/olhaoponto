import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimeEntry } from '@/types/app';
import { supabase } from './supabase';
import { getAuthenticatedSession } from './auth-session';
import { getJourneyImage, PECAS_POR_QUEBRA_CABECA, PUNCH_ORIGINS, type JourneyPieceOrigin } from '@/utils/journey-game';

export type JourneyPiece = {
  id: string;
  usuario_id: string;
  nivel: number;
  indice: number;
  origem: JourneyPieceOrigin;
  data: string;
  batida_id?: string | null;
  encaixada: boolean;
  encaixada_em?: string | null;
};

export type JourneyLevel = {
  id: string;
  usuario_id: string;
  nivel: number;
  imagem_id: string;
  pecas_total: number;
  concluido_em?: string | null;
};

export type JourneyState = { level: JourneyLevel; pieces: JourneyPiece[] };
const keyFor = (uid: string) => `olhaponto:${uid}:journey-state`;
const uid = async () => (await getAuthenticatedSession()).session?.user.id ?? null;

function localLevel(userId: string, level = 1): JourneyLevel {
  return { id: `local-${userId}-${level}`, usuario_id: userId, nivel: level, imagem_id: getJourneyImage(level).id, pecas_total: 0, concluido_em: null };
}

async function readLocal(userId: string): Promise<JourneyState | null> {
  try { const value = JSON.parse((await AsyncStorage.getItem(keyFor(userId))) || 'null') as JourneyState | null; return value?.level && Array.isArray(value.pieces) ? value : null; } catch { return null; }
}
async function writeLocal(userId: string, state: JourneyState) { await AsyncStorage.setItem(keyFor(userId), JSON.stringify(state)); }

export async function loadJourney(): Promise<JourneyState | null> {
  const userId = await uid();
  if (!userId) return null;
  const local = await readLocal(userId);
  try {
    const [levels, pieces] = await Promise.all([
      supabase.from('jornada_niveis').select('id,usuario_id,nivel,imagem_id,pecas_total,concluido_em').eq('usuario_id', userId).order('nivel', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('jornada_pecas').select('id,usuario_id,nivel,indice,origem,data,batida_id,encaixada,encaixada_em').eq('usuario_id', userId).order('indice', { ascending: true }).limit(100),
    ]);
    if (!levels.error && !pieces.error && levels.data) {
      const state = { level: levels.data as JourneyLevel, pieces: (pieces.data || []) as JourneyPiece[] };
      await writeLocal(userId, state);
      return state;
    }
  } catch { /* usa o último estado local quando estiver offline */ }
  return local || { level: localLevel(userId), pieces: [] };
}

export async function awardPieceForEntry(entry: TimeEntry): Promise<JourneyState | null> {
  const userId = await uid();
  if (!userId || !entry.id || !entry.data) return null;
  const origin = PUNCH_ORIGINS[entry.tipo];
  const current = (await loadJourney()) || { level: localLevel(userId), pieces: [] };
  if (current.pieces.some((piece) => piece.data === entry.data && piece.origem === origin)) return current;
  const used = new Set(current.pieces.filter((piece) => piece.nivel === current.level.nivel).map((piece) => piece.indice));
  const index = Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, item) => item).find((item) => !used.has(item));
  if (index === undefined) return current;
  const piece: JourneyPiece = { id: `local-piece-${entry.id}`, usuario_id: userId, nivel: current.level.nivel, indice: index, origem: origin, data: entry.data, batida_id: entry.id, encaixada: false, encaixada_em: null };
  const next = { ...current, pieces: [...current.pieces, piece] };
  await writeLocal(userId, next);
  try {
    await supabase.from('jornada_niveis').upsert({ usuario_id: userId, nivel: next.level.nivel, imagem_id: next.level.imagem_id, pecas_total: next.pieces.filter((item) => item.nivel === next.level.nivel).length }, { onConflict: 'usuario_id,nivel' });
    const remote = await supabase.from('jornada_pecas').upsert({ usuario_id: userId, nivel: piece.nivel, indice: piece.indice, origem: piece.origem, data: piece.data, batida_id: piece.batida_id, encaixada: false }, { onConflict: 'usuario_id,data,origem' }).select('id,usuario_id,nivel,indice,origem,data,batida_id,encaixada,encaixada_em').single();
    if (!remote.error && remote.data) {
      const synced = { ...next, pieces: next.pieces.map((item) => item.id === piece.id ? remote.data as JourneyPiece : item) };
      await writeLocal(userId, synced);
      return synced;
    }
  } catch { /* mantém a peça local para sincronização posterior */ }
  return next;
}

export async function placeJourneyPiece(pieceId: string): Promise<JourneyState | null> {
  const userId = await uid();
  if (!userId) return null;
  const current = (await readLocal(userId)) || await loadJourney();
  if (!current) return null;
  const piece = current.pieces.find((item) => item.id === pieceId);
  if (!piece || piece.encaixada) return current;
  const placed = { ...piece, encaixada: true, encaixada_em: new Date().toISOString() };
  const pieces = current.pieces.map((item) => item.id === pieceId ? placed : item);
  const currentLevelPieces = pieces.filter((item) => item.nivel === current.level.nivel);
  let level = { ...current.level, pecas_total: currentLevelPieces.length };
  if (currentLevelPieces.length >= PECAS_POR_QUEBRA_CABECA && currentLevelPieces.every((item) => item.encaixada)) {
    level = { ...level, concluido_em: new Date().toISOString() };
  }
  const next = { level, pieces };
  await writeLocal(userId, next);
  try { await supabase.from('jornada_pecas').update({ encaixada: true, encaixada_em: placed.encaixada_em }).eq('id', pieceId).eq('usuario_id', userId); } catch { /* estado local permanece */ }
  return next;
}

export async function advanceJourneyLevel(): Promise<JourneyState | null> {
  const userId = await uid();
  if (!userId) return null;
  const current = (await readLocal(userId)) || await loadJourney();
  if (!current || !current.level.concluido_em) return current;
  const nextLevel = current.level.nivel + 1;
  const level = localLevel(userId, nextLevel);
  const next = { level, pieces: current.pieces.filter((piece) => piece.nivel !== nextLevel) };
  await writeLocal(userId, next);
  try { await supabase.from('jornada_niveis').upsert({ usuario_id: userId, nivel: nextLevel, imagem_id: level.imagem_id, pecas_total: 0 }, { onConflict: 'usuario_id,nivel' }); } catch { /* segue localmente */ }
  return next;
}
