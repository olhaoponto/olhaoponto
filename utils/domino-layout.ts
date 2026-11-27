export type PedraDeLayout = {
  a: number;
  b: number;
};

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
 * `ladoPedra` é o comprimento da pedra deitada. Uma pedra em pé ocupa
 * metade desse comprimento na largura e o comprimento inteiro na altura.
 * Cada fileira alterna o sentido; a pedra na curva e as carroças ficam em pé.
 */
export function layoutCorrente(
  quantidade: number,
  larguraDisponivel: number,
  ladoPedra: number,
  pedras: readonly PedraDeLayout[] = [],
): PosicaoCorrente[] {
  if (quantidade <= 0 || larguraDisponivel <= 0 || ladoPedra <= 0) return [];
  const colunas = Math.max(1, Math.floor(larguraDisponivel / ladoPedra));
  const distanciaEntreLinhas = ladoPedra + 8;
  const resultado: PosicaoCorrente[] = [];

  for (let index = 0; index < quantidade; index += 1) {
    const linha = Math.floor(index / colunas);
    const colunaNaLinha = index % colunas;
    const invertida = linha % 2 === 1;
    const coluna = invertida ? colunas - 1 - colunaNaLinha : colunaNaLinha;
    const ultimaDaLinha = colunaNaLinha === colunas - 1 || index === quantidade - 1;
    const carroca = pedras[index] ? pedras[index].a === pedras[index].b : false;
    const vertical = carroca || (ultimaDaLinha && index + 1 < quantidade);
    const xBase = coluna * ladoPedra;
    const x = vertical ? xBase + ladoPedra / 4 : xBase;
    const y = linha * distanciaEntreLinhas + (vertical ? 0 : ladoPedra / 4);
    resultado.push({ x, y, vertical });
  }
  return resultado;
}

export function dimensoesCorrente(posicoes: readonly PosicaoCorrente[], ladoPedra: number): DimensoesCorrente {
  return posicoes.reduce<DimensoesCorrente>((dimensoes, posicao) => ({
    width: Math.max(dimensoes.width, posicao.x + (posicao.vertical ? ladoPedra / 2 : ladoPedra)),
    height: Math.max(dimensoes.height, posicao.y + (posicao.vertical ? ladoPedra : ladoPedra / 2)),
  }), { width: 0, height: 0 });
}
