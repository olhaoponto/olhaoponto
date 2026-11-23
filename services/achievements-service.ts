import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayStatusRecord, TimeEntry } from '@/types/app';
import { getAuthenticatedSession } from '@/services/auth-session';
import { loadRecentHistory, recentHistoryRange } from '@/services/recent-history-cache';
import { computeStreak } from '@/utils/streak';
import { getBahiaDate } from '@/utils/work-time';
import { evaluateAchievementRules } from '@/utils/achievements';
import { seedAchievementUnlocks } from '@/utils/achievement-announcement';

export type Achievement = { id: string; titulo: string; descricao: string; icone: string; regra: string };
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
function weekStart(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return shiftDate(value, -((weekday + 6) % 7));
}
function addWeeks(value: string, amount: number): string { return shiftDate(value, amount * 7); }
export { evaluateAchievementRules } from '@/utils/achievements';
export type { AchievementRuleInput } from '@/utils/achievements';

async function readUnlocked(uid: string): Promise<UnlockedAchievement[]> { return parseUnlocked(await AsyncStorage.getItem(storageKey(uid))); }
function parseUnlocked(raw: string | null): UnlockedAchievement[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is UnlockedAchievement => Boolean(item && typeof item === 'object' && typeof (item as UnlockedAchievement).id === 'string' && typeof (item as UnlockedAchievement).desbloqueadaEm === 'string'));
  } catch { return []; }
}
export async function loadAchievements(uid?: string): Promise<UnlockedAchievement[]> {
  const userId = uid ?? (await getAuthenticatedSession()).session?.user.id;
  return userId ? readUnlocked(userId) : [];
}

async function loadMissionHistory(uid: string, today: string): Promise<{ week: string; event: string }[]> {
  try {
    const { start } = recentHistoryRange(today);
    const keys: string[] = [];
    for (let week = weekStart(start); week <= today; week = addWeeks(week, 1)) keys.push(`olhaponto:${uid}:mission-events:${week}`);
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

async function loadStatusHistory(uid: string, today: string): Promise<DayStatusRecord[]> {
  const history = await loadRecentHistory(uid, today);
  return [...new Map(history.statuses.map((item) => [item.data, item])).values()];
}

export async function evaluateAchievements(uid?: string): Promise<{ unlocked: UnlockedAchievement[]; newlyUnlocked: UnlockedAchievement[] }> {
  const startedAt = Date.now();
  const session = await getAuthenticatedSession();
  const userId = uid ?? session.session?.user.id;
  if (!userId) return { unlocked: [], newlyUnlocked: [] };
  const today = getBahiaDate(new Date());
  const [history, statuses, missionEvents, stored, stepsRaw] = await Promise.all([
    loadRecentHistory(userId, today),
    loadStatusHistory(userId, today),
    loadMissionHistory(userId, today),
    AsyncStorage.getItem(storageKey(userId)),
    AsyncStorage.getItem(stepsKey(userId)),
  ]);
  const entries: TimeEntry[] = history.entries;
  const streak = computeStreak(entries, statuses, today);
  let totalCycles = 0;
  try {
    const parsed = JSON.parse(stepsRaw || 'null') as { totalCycles?: unknown } | null;
    totalCycles = typeof parsed?.totalCycles === 'number' && Number.isFinite(parsed.totalCycles) ? parsed.totalCycles : 0;
  } catch { /* progresso inválido vale zero */ }
  const ruleIds = evaluateAchievementRules({ today, entries, statuses, streak, missionEvents, totalCycles });
  const previous = parseUnlocked(stored);
  const known = new Set(previous.map((item) => item.id));
  const now = new Date().toISOString();
  const pending = ACHIEVEMENTS.filter((item) => ruleIds.includes(item.id) && !known.has(item.id)).map((item) => ({ ...item, desbloqueadaEm: now }));
  const seed = seedAchievementUnlocks({ raw: stored, previous, pending });
  if (seed.unlocked.length !== previous.length) await AsyncStorage.setItem(storageKey(userId), JSON.stringify(seed.unlocked));
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug(`[perf] evaluateAchievements ${Date.now() - startedAt}ms user=${userId}`);
  return { unlocked: seed.unlocked, newlyUnlocked: seed.announce };
}
