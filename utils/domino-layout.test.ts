import { describe, expect, it } from "vitest";
import { dimensoesCorrente, layoutCorrente } from "./domino-layout";

describe("layoutCorrente", () => {
  it("mantém pedras horizontais e verticais dentro da largura e sem sobreposição", () => {
    const lado = 44;
    const largura = 220;
    const layout = layoutCorrente(31, largura, lado);
    const dimensoes = dimensoesCorrente(layout, lado);

    expect(layout).toHaveLength(31);
    expect(dimensoes.width).toBeLessThanOrEqual(largura);
    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        const a = layout[i];
        const b = layout[j];
        const aWidth = a.vertical ? lado / 2 : lado;
        const aHeight = a.vertical ? lado : lado / 2;
        const bWidth = b.vertical ? lado / 2 : lado;
        const bHeight = b.vertical ? lado : lado / 2;
        const sobrepoe = a.x < b.x + bWidth && a.x + aWidth > b.x && a.y < b.y + bHeight && a.y + aHeight > b.y;
        expect(sobrepoe).toBe(false);
      }
    }
  });

  it("faz 24 pedras caberem em uma área de 184 por 160", () => {
    const largura = 184;
    const altura = 160;
    const lado = [44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24].find((candidato) => {
      const dimensoes = dimensoesCorrente(layoutCorrente(24, largura, candidato), candidato);
      return dimensoes.width <= largura && dimensoes.height <= altura;
    });
    expect(lado).toBe(36);
    const layout = layoutCorrente(24, largura, lado ?? 24);
    const dimensoes = dimensoesCorrente(layout, lado ?? 24);
    expect(dimensoes.width).toBeLessThanOrEqual(largura);
    expect(dimensoes.height).toBeLessThanOrEqual(altura);
  });

  it("alterna o sentido e curva a corrente nas pontas", () => {
    expect(layoutCorrente(8, 176, 44)).toEqual([
      { x: 0, y: 0, vertical: false },
      { x: 44, y: 0, vertical: false },
      { x: 88, y: 0, vertical: false },
      { x: 132, y: 0, vertical: true },
      { x: 88, y: 26, vertical: false },
      { x: 44, y: 26, vertical: false },
      { x: 0, y: 26, vertical: true },
      { x: 44, y: 52, vertical: false },
    ]);
  });

  it("retorna vazio para dimensões inválidas", () => {
    expect(layoutCorrente(3, 0, 44)).toEqual([]);
    expect(layoutCorrente(0, 220, 44)).toEqual([]);
  });
});
