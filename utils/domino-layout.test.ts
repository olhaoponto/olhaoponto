import { describe, expect, it } from "vitest";
import { dimensoesCorrente, layoutCorrente, type PedraDeLayout, type PosicaoCorrente } from "./domino-layout";

function ocupa(posicao: PosicaoCorrente, lado: number) {
  return {
    left: posicao.x,
    right: posicao.x + (posicao.vertical ? lado / 2 : lado),
    top: posicao.y,
    bottom: posicao.y + (posicao.vertical ? lado : lado / 2),
  };
}

function assertSemSobreposicao(layout: readonly PosicaoCorrente[], lado: number) {
  for (let i = 0; i < layout.length; i += 1) {
    const a = ocupa(layout[i], lado);
    for (let j = i + 1; j < layout.length; j += 1) {
      const b = ocupa(layout[j], lado);
      const sobrepoe = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      expect(sobrepoe).toBe(false);
    }
  }
}

describe("layoutCorrente", () => {
  it("mantém pedras e carroças dentro de 184x160 sem sobreposição", () => {
    const pedras: PedraDeLayout[] = Array.from({ length: 24 }, (_, index) => ({
      a: index % 5 === 0 ? 4 : index % 6,
      b: index % 5 === 0 ? 4 : (index + 2) % 6,
    }));
    const lado = 24;
    const largura = 184;
    const altura = 160;
    const layout = layoutCorrente(24, largura, lado, pedras);
    const dimensoes = dimensoesCorrente(layout, lado);

    expect(layout).toHaveLength(24);
    expect(layout.some((posicao) => posicao.vertical)).toBe(true);
    expect(dimensoes.width).toBeLessThanOrEqual(largura);
    expect(dimensoes.height).toBeLessThanOrEqual(altura);
    assertSemSobreposicao(layout, lado);
    for (const posicao of layout) {
      const caixa = ocupa(posicao, lado);
      expect(caixa.left).toBeGreaterThanOrEqual(0);
      expect(caixa.top).toBeGreaterThanOrEqual(0);
      expect(caixa.right).toBeLessThanOrEqual(largura);
      expect(caixa.bottom).toBeLessThanOrEqual(altura);
    }
  });

  it("alterna o sentido e mantém a curva com distância para a próxima linha", () => {
    const layout = layoutCorrente(8, 176, 44);
    expect(layout).toEqual([
      { x: 0, y: 11, vertical: false },
      { x: 44, y: 11, vertical: false },
      { x: 88, y: 11, vertical: false },
      { x: 143, y: 0, vertical: true },
      { x: 132, y: 63, vertical: false },
      { x: 88, y: 63, vertical: false },
      { x: 44, y: 63, vertical: false },
      { x: 0, y: 63, vertical: false },
    ]);
    assertSemSobreposicao(layout, 44);
  });

  it("posiciona uma carroça em pé mesmo no meio da fileira", () => {
    const layout = layoutCorrente(3, 180, 44, [{ a: 1, b: 1 }, { a: 2, b: 4 }, { a: 3, b: 5 }]);
    expect(layout[0]).toEqual({ x: 11, y: 0, vertical: true });
    expect(layout[1]).toEqual({ x: 44, y: 11, vertical: false });
  });

  it("retorna vazio para dimensões inválidas", () => {
    expect(layoutCorrente(3, 0, 44)).toEqual([]);
    expect(layoutCorrente(0, 220, 44)).toEqual([]);
  });
});
