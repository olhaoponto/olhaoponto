export type RankingCandidate = { id: string; apelido: string; pecas: number; ultima: string | null };
export function orderRanking(rows: RankingCandidate[], uid?: string) {
  return [...rows].sort((a, b) => b.pecas - a.pecas || (a.ultima ? (b.ultima ? a.ultima.localeCompare(b.ultima) : -1) : 1) || a.apelido.localeCompare(b.apelido, 'pt-BR')).map((row, index) => ({ ...row, posicao: index + 1, eh_voce: row.id === uid }));
}
