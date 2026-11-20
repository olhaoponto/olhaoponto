import { describe, expect, it } from 'vitest';
import { avatarStorageKeys, nextPieceCount } from '@/utils/avatar-storage';

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
});
