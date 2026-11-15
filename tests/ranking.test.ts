import { describe, expect, it } from 'vitest';
import { orderRanking } from '@/utils/ranking';

describe('ranking da equipe', () => {
  it('ordena por peças, chegada e apelido', () => {
    const result = orderRanking([
      { id: 'b', apelido: 'Bia', pecas: 4, ultima: '2026-11-14T10:00:00Z' },
      { id: 'a', apelido: 'Ana', pecas: 4, ultima: '2026-11-14T09:00:00Z' },
      { id: 'c', apelido: 'Caio', pecas: 2, ultima: null },
    ]);
    expect(result.map((row) => row.apelido)).toEqual(['Ana', 'Bia', 'Caio']);
  });
  it('marca o usuário mesmo quando ele está fora do top cinco', () => {
    const result = orderRanking(Array.from({ length: 6 }, (_, index) => ({ id: String(index), apelido: `Pessoa ${index}`, pecas: 6 - index, ultima: null })), '5');
    expect(result[5]).toMatchObject({ posicao: 6, eh_voce: true });
  });
});
