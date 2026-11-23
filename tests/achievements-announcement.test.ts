import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ data: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.data.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.data.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { store.data.delete(key); }),
    multiRemove: vi.fn(async (keys: string[]) => { keys.forEach((key) => store.data.delete(key)); }),
    getAllKeys: vi.fn(async () => [...store.data.keys()]),
    multiGet: vi.fn(async (keys: string[]) => keys.map((key) => [key, store.data.get(key) ?? null] as [string, string | null])),
  },
}));

const entriesRef = vi.hoisted(() => ({ current: [] as { data: string; tipo: string }[] }));

vi.mock('@/services/auth-session', () => ({
  getAuthenticatedSession: vi.fn(async () => ({ session: { user: { id: 'user-1' } }, error: null })),
  SESSION_REQUIRED_MESSAGE: 'Sua sessão não está ativa.',
}));
vi.mock('@/services/time-entry-service', () => ({
  loadEntriesForCompleteHistory: vi.fn(async () => ({ data: entriesRef.current, error: null })),
  loadEntriesByDateRange: vi.fn(async () => ({ data: entriesRef.current, error: null })),
}));
vi.mock('@/services/day-status-service', () => ({
  loadDayStatuses: vi.fn(async () => ({ data: [], error: null })),
}));

import { evaluateAchievements } from '@/services/achievements-service';
import { invalidateRecentHistory } from '@/services/recent-history-cache';
import { seedAchievementUnlocks } from '@/utils/achievement-announcement';
import { getBahiaDate } from '@/utils/work-time';

const achievementsKey = 'olhaponto:user-1:achievements';
const today = getBahiaDate(new Date());
type Saved = { id: string; desbloqueadaEm: string };

function readSaved(): Saved[] {
  return JSON.parse(store.data.get(achievementsKey) || '[]') as Saved[];
}
function punches(count: number) {
  const types = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
  return Array.from({ length: count }, (_, index) => ({ data: today, tipo: types[index] }));
}

describe('seedAchievementUnlocks', () => {
  const saved = { id: 'primeiro_ponto', desbloqueadaEm: '2026-11-20T12:00:00.000Z' };
  const fresh = { id: 'dia_completo', desbloqueadaEm: '2026-11-21T12:00:00.000Z' };

  it('silencia tudo quando a chave de conquistas ainda não existe', () => {
    const result = seedAchievementUnlocks({ raw: null, previous: [], pending: [saved, fresh] });
    expect(result.firstEvaluation).toBe(true);
    expect(result.announce).toEqual([]);
    expect(result.unlocked.map((item) => item.id)).toEqual(['primeiro_ponto', 'dia_completo']);
  });

  it('anuncia quando a chave existe, mesmo vazia', () => {
    const result = seedAchievementUnlocks({ raw: '[]', previous: [], pending: [saved] });
    expect(result.firstEvaluation).toBe(false);
    expect(result.announce.map((item) => item.id)).toEqual(['primeiro_ponto']);
    expect(result.unlocked).toHaveLength(1);
  });

  it('anuncia apenas o que ainda não estava salvo', () => {
    const result = seedAchievementUnlocks({ raw: JSON.stringify([saved]), previous: [saved], pending: [fresh] });
    expect(result.announce.map((item) => item.id)).toEqual(['dia_completo']);
    expect(result.unlocked.map((item) => item.id)).toEqual(['primeiro_ponto', 'dia_completo']);
  });

  it('nada a anunciar quando nenhuma regra nova foi atendida', () => {
    const result = seedAchievementUnlocks({ raw: JSON.stringify([saved]), previous: [saved], pending: [] });
    expect(result.announce).toEqual([]);
    expect(result.unlocked).toEqual([saved]);
    expect(result.firstEvaluation).toBe(false);
  });
});

describe('evaluateAchievements', () => {
beforeEach(() => {
  store.data.clear();
  entriesRef.current = [];
  invalidateRecentHistory();
});

  it('grava em silêncio a primeira avaliação do usuário', async () => {
    entriesRef.current = punches(1);
    expect(store.data.has(achievementsKey)).toBe(false);
    const result = await evaluateAchievements('user-1');
    expect(result.newlyUnlocked).toEqual([]);
    expect(result.unlocked.map((item) => item.id)).toContain('primeiro_ponto');
    expect(readSaved().map((item) => item.id)).toContain('primeiro_ponto');
    expect(readSaved()[0]?.desbloqueadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('não reapresenta a conquista já salva em avaliações seguintes', async () => {
    entriesRef.current = punches(1);
    await evaluateAchievements('user-1');
    const second = await evaluateAchievements('user-1');
    expect(second.newlyUnlocked).toEqual([]);
    expect(second.unlocked).toHaveLength(1);
  });

  it('anuncia uma conquista obtida depois da primeira avaliação', async () => {
    entriesRef.current = punches(1);
    await evaluateAchievements('user-1');
    entriesRef.current = punches(4);
    invalidateRecentHistory('user-1');
    const result = await evaluateAchievements('user-1');
    expect(result.newlyUnlocked.map((item) => item.id)).toEqual(['dia_completo']);
    expect(result.unlocked.map((item) => item.id)).toEqual(['primeiro_ponto', 'dia_completo']);
  });

  it('anuncia quando a chave existe vazia, porque a primeira avaliação já aconteceu', async () => {
    store.data.set(achievementsKey, '[]');
    entriesRef.current = punches(1);
    const result = await evaluateAchievements('user-1');
    expect(result.newlyUnlocked.map((item) => item.id)).toEqual(['primeiro_ponto']);
  });

  it('não grava nada quando nenhuma regra foi atendida', async () => {
    const result = await evaluateAchievements('user-1');
    expect(result.unlocked).toEqual([]);
    expect(result.newlyUnlocked).toEqual([]);
    expect(store.data.has(achievementsKey)).toBe(false);
  });

  it('retorna listas vazias sem usuário autenticado', async () => {
    expect(await evaluateAchievements('')).toEqual({ unlocked: [], newlyUnlocked: [] });
  });
});
