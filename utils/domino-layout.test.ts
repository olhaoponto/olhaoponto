import { describe, expect, it } from "vitest";
import { layoutCorrente } from "./domino-layout";

describe("layoutCorrente", () => {
  it("mantém todas as pedras dentro da largura e sem sobreposição", () => {
    const lado = 44;
    const largura = 220;
    const layout = layoutCorrente(31, largura, lado);

    expect(layout).toHaveLength(31);
    for (const posicao of layout) {
      expect(posicao.x).toBeGreaterThanOrEqual(0);
      expect(posicao.x + lado).toBeLessThanOrEqual(largura);
      expect(posicao.y).toBeGreaterThanOrEqual(0);
    }

    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        const a = layout[i];
        const b = layout[j];
        const sobrepoe = a.x < b.x + lado && a.x + lado > b.x && a.y < b.y + lado && a.y + lado > b.y;
        expect(sobrepoe).toBe(false);
      }
    }
  });

  it("alterna o sentido das linhas", () => {
    expect(layoutCorrente(8, 176, 44)).toEqual([
      { x: 0, y: 0, vertical: false },
      { x: 44, y: 0, vertical: false },
      { x: 88, y: 0, vertical: false },
      { x: 132, y: 0, vertical: false },
      { x: 132, y: 44, vertical: false },
      { x: 88, y: 44, vertical: false },
      { x: 44, y: 44, vertical: false },
      { x: 0, y: 44, vertical: false },
    ]);
  });

  it("retorna vazio para dimensões inválidas", () => {
    expect(layoutCorrente(3, 0, 44)).toEqual([]);
    expect(layoutCorrente(0, 220, 44)).toEqual([]);
  });
});
