import { describe, expect, it } from 'vitest';
import { isUnlocked } from '@/utils/avatar-unlock';

describe('avatar catalog', () => {
  it('desbloqueia raridades por total de peças', () => {
    expect(isUnlocked({ unlock: { tipo: 'pecas', valor: 1 } }, { pecas: 0, ciclos: 0, puzzles: 0 })).toBe(false);
    expect(isUnlocked({ unlock: { tipo: 'pecas', valor: 1 } }, { pecas: 1, ciclos: 0, puzzles: 0 })).toBe(true);
    expect(isUnlocked({ unlock: { tipo: 'pecas', valor: 151 } }, { pecas: 150, ciclos: 0, puzzles: 0 })).toBe(false);
    expect(isUnlocked({ unlock: { tipo: 'pecas', valor: 151 } }, { pecas: 151, ciclos: 0, puzzles: 0 })).toBe(true);
    expect(isUnlocked({ unlock: { tipo: 'pecas', valor: 419 } }, { pecas: 419, ciclos: 0, puzzles: 0 })).toBe(true);
  });

  it('usa a métrica correta em cada avatar lendário', () => {
    expect(isUnlocked({ unlock: { tipo: 'ciclos', valor: 1 } }, { pecas: 999, ciclos: 0, puzzles: 999 })).toBe(false);
    expect(isUnlocked({ unlock: { tipo: 'ciclos', valor: 1 } }, { pecas: 0, ciclos: 1, puzzles: 0 })).toBe(true);
    expect(isUnlocked({ unlock: { tipo: 'puzzles', valor: 1 } }, { pecas: 0, ciclos: 0, puzzles: 1 })).toBe(true);
  });
});
