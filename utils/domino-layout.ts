export type PosicaoCorrente = {
  x: number;
  y: number;
  vertical: boolean;
};

/**
 * Distribui as pedras em fileiras horizontais alternadas. A última pedra de
 * cada fileira fica atravessada para formar a curva de 90 graus da corrente.
 * Cada posição ocupa uma célula quadrada, por isso também acomoda uma pedra
 * vertical sem sobreposição.
 */
export function layoutCorrente(
  quantidade: number,
  larguraDisponivel: number,
  ladoPedra: number,
): PosicaoCorrente[] {
  if (quantidade <= 0 || larguraDisponivel <= 0 || ladoPedra <= 0) return [];
  const colunas = Math.max(1, Math.floor(larguraDisponivel / ladoPedra));
  const resultado: PosicaoCorrente[] = [];
  for (let indice = 0; indice < quantidade; indice += 1) {
    const linha = Math.floor(indice / colunas);
    const coluna = indice % colunas;
    const invertida = linha % 2 === 1;
    const x = invertida ? (colunas - coluna - 1) * ladoPedra : coluna * ladoPedra;
    const ultimaDaLinha = coluna === colunas - 1 || indice === quantidade - 1;
    resultado.push({
      x,
      y: linha * ladoPedra,
      vertical: ultimaDaLinha,
    });
  }
  return resultado;
}
