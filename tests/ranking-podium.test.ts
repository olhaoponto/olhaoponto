import { describe, expect, it } from 'vitest';
import type { RankingRow } from '@/services/ranking-service';
import { getPodiumColumns, getRankingRowsFourToTen, getUserOutsideTopTen, sortRankingRows } from '@/utils/ranking-podium';

const row = (posicao: number, eh_voce = false): RankingRow => ({ posicao, nome: `Pessoa ${posicao}`, pontos: 100 - posicao, dias: 1, eh_voce });

describe('ranking podium', () => {
  it('ordena as linhas e posiciona o pódio como 2º, 1º e 3º', () => {
    const rows = [row(3), row(1), row(2)];
    expect(sortRankingRows(rows).map((item) => item.posicao)).toEqual([1, 2, 3]);
    expect(getPodiumColumns(rows).map((item) => item.posicao)).toEqual([2, 1, 3]);
  });

  it('separa as posições 4 a 10', () => {
    expect(getRankingRowsFourToTen([row(11), row(10), row(4), row(3)]).map((item) => item.posicao)).toEqual([4, 10]);
  });

  it('acha o usuário quando ele está fora do Top 10', () => {
    expect(getUserOutsideTopTen([row(12, true), row(2)])?.posicao).toBe(12);
    expect(getUserOutsideTopTen([row(10, true)])).toBeNull();
  });
});
