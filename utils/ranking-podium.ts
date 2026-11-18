import type { RankingRow } from '@/services/ranking-service';

export function sortRankingRows(rows: readonly RankingRow[]): RankingRow[] {
  return [...rows].sort((a, b) => a.posicao - b.posicao);
}

export function getPodiumColumns(rows: readonly RankingRow[]): RankingRow[] {
  const sorted = sortRankingRows(rows).filter((row) => row.posicao >= 1 && row.posicao <= 3);
  return [2, 1, 3].map((position) => sorted.find((row) => row.posicao === position)).filter((row): row is RankingRow => Boolean(row));
}

export function getRankingRowsFourToTen(rows: readonly RankingRow[]): RankingRow[] {
  return sortRankingRows(rows).filter((row) => row.posicao >= 4 && row.posicao <= 10);
}

export function getUserOutsideTopTen(rows: readonly RankingRow[]): RankingRow | null {
  return sortRankingRows(rows).find((row) => row.eh_voce && row.posicao > 10) ?? null;
}
