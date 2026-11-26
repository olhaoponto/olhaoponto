export type PosicaoCorrente = {
  x: number;
  y: number;
  vertical: boolean;
};

export type DimensoesCorrente = {
  width: number;
  height: number;
};

/**
 * Distribui a corrente em fileiras horizontais alternadas. Depois da primeira
 * fileira, cada curva usa uma célula a menos e deixa a próxima fileira começar
 * uma célula para dentro, evitando sobreposição quando a curva ocupa duas
 * meias-alturas.
 */
export function layoutCorrente(
  quantidade: number,
  larguraDisponivel: number,
  ladoPedra: number,
): PosicaoCorrente[] {
  if (quantidade <= 0 || larguraDisponivel <= 0 || ladoPedra <= 0) return [];
  const colunas = Math.max(1, Math.floor(larguraDisponivel / ladoPedra));
  const passoVertical = ladoPedra / 2 + 4;
  const resultado: PosicaoCorrente[] = [];
  let restante = quantidade;
  let indice = 0;
  let linha = 0;

  while (restante > 0) {
    const capacidade = linha === 0 || colunas === 1 ? colunas : Math.max(1, colunas - 1);
    const nestaLinha = Math.min(capacidade, restante);
    for (let coluna = 0; coluna < nestaLinha; coluna += 1) {
      const invertida = linha % 2 === 1;
      const deslocamento = linha === 0 || colunas === 1 ? 0 : 1;
      const x = invertida
        ? (colunas - 2 - coluna) * ladoPedra
        : (coluna + deslocamento) * ladoPedra;
      resultado.push({
        x,
        y: linha * passoVertical,
        vertical: coluna === nestaLinha - 1 && indice + 1 < quantidade,
      });
      indice += 1;
    }
    restante -= nestaLinha;
    linha += 1;
  }
  return resultado;
}

export function dimensoesCorrente(posicoes: readonly PosicaoCorrente[], ladoPedra: number): DimensoesCorrente {
  return posicoes.reduce<DimensoesCorrente>((dimensoes, posicao) => ({
    width: Math.max(dimensoes.width, posicao.x + (posicao.vertical ? ladoPedra / 2 : ladoPedra)),
    height: Math.max(dimensoes.height, posicao.y + (posicao.vertical ? ladoPedra : ladoPedra / 2)),
  }), { width: 0, height: 0 });
}
