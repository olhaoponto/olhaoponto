import { describe, expect, it } from 'vitest';
import { avatarStorageKeys, nextPieceCount, parseCycles } from '@/utils/avatar-storage';
import { getProgressCache, invalidateProgressCache, setProgressCache } from '@/utils/progress-cache';
import { decodePendingAvatarId, decideAvatarSync, encodePendingAvatarId } from '@/utils/avatar-db-sync';

const validIds = new Set(['av-01', 'av-02']);

describe('avatar service', () => {
  it('usa namespaces separados por usuário', () => {
    expect(avatarStorageKeys('user-7')).toEqual({
      selected: 'olhaoponto:user-7:avatar-escolhido',
      seen: 'olhaoponto:user-7:avatares-vistos',
      pieces: 'olhaoponto:user-7:pecas-total',
      steps: 'olhaoponto:user-7:sete-passos',
    });
  });

  it('incrementa o contador de peças apenas em passos inteiros', () => {
    expect(nextPieceCount(0)).toBe(1);
    expect(nextPieceCount(7)).toBe(8);
    expect(nextPieceCount(-4)).toBe(1);
    expect(nextPieceCount(2.9)).toBe(3);
  });

  it('lê totalCycles do JSON persistido', () => {
    expect(parseCycles('{"lastRewardedEndDate":"2026-11-19","totalCycles":3}')).toBe(3);
    expect(parseCycles(null)).toBe(0);
    expect(parseCycles('não é JSON')).toBe(0);
  });

  it('invalida o progresso por usuário sem carregar assets', () => {
    setProgressCache('user-7', { pecas: 3, ciclos: 1, puzzles: 2 });
    expect(getProgressCache('user-7')).toEqual({ pecas: 3, ciclos: 1, puzzles: 2 });
    invalidateProgressCache('user-7');
    expect(getProgressCache('user-7')).toBeUndefined();
  });

  it('faz o banco vencer o avatar local', () => {
    expect(decideAvatarSync({ dbId: 'av-02', localId: 'av-01', pendingId: 'av-01', validIds })).toEqual({ kind: 'use-database', id: 'av-02' });
  });

  it('sobe o avatar local quando o banco está nulo', () => {
    expect(decideAvatarSync({ dbId: null, localId: 'av-01', pendingId: undefined, validIds })).toEqual({ kind: 'upload', id: 'av-01', source: 'local' });
  });

  it('ignora id inválido vindo do banco', () => {
    expect(decideAvatarSync({ dbId: 'av-99', localId: 'av-01', pendingId: 'av-01', validIds })).toEqual({ kind: 'ignore' });
  });

  it('prioriza a seleção pendente e preserva null como seleção válida', () => {
    expect(decideAvatarSync({ dbId: null, localId: 'av-01', pendingId: null, validIds })).toEqual({ kind: 'upload', id: null, source: 'pending' });
    expect(decodePendingAvatarId(encodePendingAvatarId(null))).toBeNull();
  });
});
