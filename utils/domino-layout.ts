export type PosicaoCorrente = {
  x: number;
  y: number;
  vertical: boolean;
};

/**
 * Distribui as pedras em linhas alternadas: esquerda→direita e direita→esquerda.
 * O passo inclui uma pequena folga para que as caixas nunca se sobreponham.
 */
export function layoutCorrente(
  quantidade: number,
  larguraDisponivel: number,
  ladoPedra: number,
): PosicaoCorrente[] {
  if (quantidade <= 0 || larguraDisponivel <= 0 || ladoPedra <= 0) return [];
  const passo = ladoPedra;
  const colunas = Math.max(1, Math.floor(larguraDisponivel / passo));
  const resultado: PosicaoCorrente[] = [];
  for (let indice = 0; indice < quantidade; indice += 1) {
    const linha = Math.floor(indice / colunas);
    const coluna = indice % colunas;
    const invertida = linha % 2 === 1;
    const x = invertida ? (colunas - coluna - 1) * passo : coluna * passo;
    resultado.push({ x, y: linha * passo, vertical: false });
  }
  return resultado;
}
