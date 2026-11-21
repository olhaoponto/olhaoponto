import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayStatusRecord, TimeEntry } from '@/types/app';
import { getAuthenticatedSession } from '@/services/auth-session';
import { loadAllEntries } from '@/services/time-entry-service';
import { loadDayStatuses } from '@/services/day-status-service';
import { computeStreak } from '@/utils/streak';
import { getBahiaDate } from '@/utils/work-time';
import { evaluateAchievementRules } from '@/utils/achievements';

export type Achievement = {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  regra: string;
};

export type UnlockedAchievement = Achievement & { desbloqueadaEm: string };

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'primeiro_ponto', titulo: 'Primeiro passo', descricao: 'Registre sua primeira batida no Olha o Ponto.', icone: '🎯', regra: 'primeira batida registrada' },
  { id: 'dia_completo', titulo: 'Dia completo', descricao: 'Complete seu primeiro dia com as quatro batidas.', icone: '✅', regra: 'primeiro dia completo' },
  { id: 'semana_perfeita', titulo: 'Semana perfeita', descricao: 'Complete cinco dias na mesma semana.', icone: '🌟', regra: '5 dias completos na mesma semana' },
  { id: 'sequencia_7', titulo: 'Uma semana de foco', descricao: 'Mantenha uma sequência de 7 dias completos.', icone: '🔥', regra: 'sequência de 7 dias' },
  { id: 'sequencia_30', titulo: 'Ritmo constante', descricao: 'Mantenha uma sequência de 30 dias completos.', icone: '🏅', regra: 'sequência de 30 dias' },
  { id: 'sequencia_100', titulo: 'Cem dias', descricao: 'Mantenha uma sequência de 100 dias completos.', icone: '💯', regra: 'sequência de 100 dias' },
  { id: 'mes_completo', titulo: 'Mês em dia', descricao: 'Passe um mês fechado sem registrar falta.', icone: '📅', regra: 'mês fechado sem falta' },
  { id: 'espelho_em_dia', titulo: 'Espelho em dia', descricao: 'Abra o Espelho por quatro semanas seguidas.', icone: '🪞', regra: 'review_mirror em 4 semanas seguidas' },
  { id: 'colega_amigo', titulo: 'Colega amigo', descricao: 'Ajude um colega ou envie um convite de almoço.', icone: '🤝', regra: 'ajuda ou convite de almoço' },
  { id: 'sete_passos', titulo: 'Sete Passos', descricao: 'Conclua um ciclo do desafio Sete Passos.', icone: '🌿', regra: 'um ciclo dos Sete Passos' },
];

const storageKey = (uid: string) => `olhaponto:${uid}:achievements`;
const stepsKey = (uid: string) => `olhaoponto:${uid}:sete-passos`;
function shiftDate(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

export { evaluateAchievementRules } from '@/utils/achievements';
export type { AchievementRuleInput } from '@/utils/achievements';

async function readUnlocked(uid: string): Promise<UnlockedAchievement[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(storageKey(uid))) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is UnlockedAchievement => Boolean(item && typeof item === 'object' && typeof (item as UnlockedAchievement).id === 'string' && typeof (item as UnlockedAchievement).desbloqueadaEm === 'string'));
  } catch { return []; }
}

export async function loadAchievements(uid?: string): Promise<UnlockedAchievement[]> {
  const userId = uid ?? (await getAuthenticatedSession()).session?.user.id;
  return userId ? readUnlocked(userId) : [];
}

async function loadMissionHistory(uid: string): Promise<{ week: string; event: string }[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(`olhaponto:${uid}:mission-events:`));
    const values = await AsyncStorage.multiGet(keys);
    const events: { week: string; event: string }[] = [];
    for (const [key, raw] of values) {
      const week = key.split(':').at(-1) || '';
      const parsed: unknown = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) for (const event of parsed) if (typeof event === 'string') events.push({ week, event });
    }
    return events;
  } catch { return []; }
}

async function loadStatusHistory(today: string): Promise<DayStatusRecord[]> {
  const result: DayStatusRecord[] = [];
  for (let offset = 0; offset < 120; offset += 31) {
    const start = shiftDate(today, -(offset + 30));
    const end = shiftDate(today, -offset);
    const chunk = await loadDayStatuses(start, end);
    result.push(...(chunk.data ?? []));
  }
  return [...new Map(result.map((item) => [item.data, item])).values()];
}

export async function evaluateAchievements(uid?: string): Promise<{ unlocked: UnlockedAchievement[]; newlyUnlocked: UnlockedAchievement[] }> {
  const session = await getAuthenticatedSession();
  const userId = uid ?? session.session?.user.id;
  if (!userId) return { unlocked: [], newlyUnlocked: [] };
  const today = getBahiaDate(new Date());
  const [entriesResult, statuses, missionEvents, previous, stepsRaw] = await Promise.all([
    loadAllEntries(),
    loadStatusHistory(today),
    loadMissionHistory(userId),
    readUnlocked(userId),
    AsyncStorage.getItem(stepsKey(userId)),
  ]);
  const entries = entriesResult.data ?? [];
  const streak = computeStreak(entries, statuses, today);
  let totalCycles = 0;
  try {
    const parsed = JSON.parse(stepsRaw || 'null') as { totalCycles?: unknown } | null;
    totalCycles = typeof parsed?.totalCycles === 'number' && Number.isFinite(parsed.totalCycles) ? parsed.totalCycles : 0;
  } catch { /* progresso inválido vale zero */ }
  const ruleIds = evaluateAchievementRules({ today, entries, statuses, streak, missionEvents, totalCycles });
  const known = new Set(previous.map((item) => item.id));
  const now = new Date().toISOString();
  const newlyUnlocked = ACHIEVEMENTS.filter((item) => ruleIds.includes(item.id) && !known.has(item.id)).map((item) => ({ ...item, desbloqueadaEm: now }));
  const unlocked = [...previous, ...newlyUnlocked];
  if (newlyUnlocked.length) await AsyncStorage.setItem(storageKey(userId), JSON.stringify(unlocked));
  return { unlocked, newlyUnlocked };
}
