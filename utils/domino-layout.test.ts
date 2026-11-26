import { describe, expect, it } from "vitest";
import { layoutCorrente } from "./domino-layout";

describe("layoutCorrente", () => {
  it("mantém pedras horizontais e verticais dentro da largura e sem sobreposição", () => {
    const lado = 44;
    const largura = 220;
    const layout = layoutCorrente(31, largura, lado);

    expect(layout).toHaveLength(31);
    for (const posicao of layout) {
      const larguraPedra = posicao.vertical ? lado / 2 : lado;
      const alturaPedra = posicao.vertical ? lado : lado / 2;
      expect(posicao.x).toBeGreaterThanOrEqual(0);
      expect(posicao.x + larguraPedra).toBeLessThanOrEqual(largura);
      expect(posicao.y).toBeGreaterThanOrEqual(0);
      expect(alturaPedra).toBeGreaterThan(0);
    }

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

  it("alterna o sentido e curva a corrente nas pontas", () => {
    expect(layoutCorrente(8, 176, 44)).toEqual([
      { x: 0, y: 0, vertical: false },
      { x: 44, y: 0, vertical: false },
      { x: 88, y: 0, vertical: false },
      { x: 132, y: 0, vertical: true },
      { x: 132, y: 44, vertical: false },
      { x: 88, y: 44, vertical: false },
      { x: 44, y: 44, vertical: false },
      { x: 0, y: 44, vertical: true },
    ]);
  });

  it("retorna vazio para dimensões inválidas", () => {
    expect(layoutCorrente(3, 0, 44)).toEqual([]);
    expect(layoutCorrente(0, 220, 44)).toEqual([]);
  });
});
