import { describe, expect, it } from "vitest";
import {
  criarConfronto,
  iniciarMao,
  jogadasLegais,
  jogar,
  passar,
  resolverMao,
  type Confronto,
  type EstadoMao,
  type Jogador,
  type Pedra,
} from "./domino-torneio";

function pedra(id: string, a: number, b: number): Pedra {
  return { id, a, b };
}

function estadoTeste(confronto: Confronto, overrides: Partial<Pick<EstadoMao, "maos" | "mesa" | "vez" | "aberturaPorBucha" | "aberturaValeCinco">> = {}): EstadoMao {
  const maos = overrides.maos ?? {
    0: [pedra("p0", 2, 4)],
    1: [pedra("p1", 2, 5)],
    2: [pedra("p2", 3, 6)],
    3: [pedra("p3", 2, 6)],
  };
  return {
    confronto,
    mao: confronto.mao + 1,
    maos,
    dormem: [],
    mesa: overrides.mesa ?? [],
    vez: overrides.vez ?? 0,
    aberturaPorBucha: overrides.aberturaPorBucha ?? false,
    aberturaValeCinco: overrides.aberturaValeCinco ?? false,
    passes: 0,
    fechado: false,
    fechamento: null,
    resolvida: false,
    resultado: null,
  };
}

function vencerComBuchada(confronto: Confronto): EstadoMao {
  return jogar(estadoTeste(confronto, {
    maos: {
      0: [pedra("bucha", 2, 2)],
      1: [pedra("j1", 2, 5)],
      2: [pedra("j2", 3, 6)],
      3: [pedra("j3", 2, 6)],
    },
  }), 0, { pedraId: "bucha", lado: "direita" });
}

function fecharPorPasses(estado: EstadoMao): EstadoMao {
  let atual = estado;
  for (const jogador of [0, 1, 2, 3] as Jogador[]) atual = passar(atual, jogador);
  return resolverMao(atual);
}

describe("domino-torneio", () => {
  it("abre com 1/1 em 0x0 e em 3x3, reembaralhando se necessário", () => {
    for (const confronto of [
      criarConfronto(1),
      { ...criarConfronto(2), pontos: { JER: 3, JES: 3 } },
    ]) {
      const mao = iniciarMao(confronto);
      expect(mao.aberturaPorBucha).toBe(true);
      expect(mao.dormem.some((pedra) => pedra.a === 1 && pedra.b === 1)).toBe(false);
      expect(mao.maos[mao.vez].some((pedra) => pedra.a === 1 && pedra.b === 1)).toBe(true);
      expect(jogadasLegais(mao, mao.vez)).toEqual([{ pedraId: "1-1", lado: "direita" }]);
    }
  });

  it("aplica a progressão normal 0 para 3, 5 e uma peça", () => {
    let confronto = criarConfronto(3);
    confronto = jogar(estadoTeste(confronto), 0, { pedraId: "p0", lado: "direita" }).confronto;
    expect(confronto.pontos.JER).toBe(3);
    confronto = jogar(estadoTeste(confronto), 0, { pedraId: "p0", lado: "direita" }).confronto;
    expect(confronto.pontos.JER).toBe(5);
    confronto = jogar(estadoTeste(confronto), 0, { pedraId: "p0", lado: "direita" }).confronto;
    expect(confronto.pontos.JER).toBe(0);
    expect(confronto.pecas.JER).toBe(1);
  });

  it("concede buchada como uma peça automática e registra feita/sofrida", () => {
    const resultado = vencerComBuchada(criarConfronto(4));
    expect(resultado.resultado).toMatchObject({ motivo: "buchada", vencedor: "JER", pecaConcedida: true });
    expect(resultado.confronto.pecas.JER).toBe(1);
    expect(resultado.confronto.especiais.JER.feitas.buchada).toBe(1);
    expect(resultado.confronto.especiais.JES.sofridas.buchada).toBe(1);
  });

  it("registra Lasquinê solto sem encerrar a mão", () => {
    const estado = estadoTeste(criarConfronto(5), {
      mesa: [{ pedra: pedra("mesa", 2, 4), esquerda: 2, direita: 4 }],
      maos: {
        0: [pedra("lasquine", 2, 4), pedra("extra", 6, 6)],
        1: [pedra("resposta", 4, 5)],
        2: [pedra("outro", 1, 1)],
        3: [pedra("livre", 0, 0)],
      },
    });
    const resultado = jogar(estado, 0, { pedraId: "lasquine", lado: "esquerda" });
    expect(resultado.resolvida).toBe(false);
    expect(resultado.confronto.especiais.JER.feitas.lasquine).toBe(1);
    expect(resultado.confronto.pecas.JER).toBe(0);
  });

  it("concede uma peça para Lasquinê preso", () => {
    const estado = estadoTeste(criarConfronto(6), {
      mesa: [{ pedra: pedra("mesa", 2, 4), esquerda: 2, direita: 4 }],
      maos: {
        0: [pedra("lasquine", 2, 4), pedra("extra", 6, 6)],
        1: [pedra("j1", 0, 0)],
        2: [pedra("j2", 1, 1)],
        3: [pedra("j3", 5, 5)],
      },
    });
    const resultado = jogar(estado, 0, { pedraId: "lasquine", lado: "esquerda" });
    expect(resultado.resultado).toMatchObject({ motivo: "lasquine-preso", vencedor: "JER", pecaConcedida: true });
    expect(resultado.confronto.especiais.JER.feitas["lasquine-preso"]).toBe(1);
  });

  it("resolve Fechado de Propósito quando o jogador tem alternativa não travante", () => {
    const estado = estadoTeste(criarConfronto(7), {
      mesa: [{ pedra: pedra("mesa", 1, 2), esquerda: 1, direita: 2 }],
      maos: {
        0: [pedra("trava", 1, 3), pedra("alternativa", 1, 4)],
        1: [pedra("adversario1", 6, 6)],
        2: [pedra("parceiro", 4, 5)],
        3: [pedra("adversario2", 5, 5)],
      },
    });
    const resultado = jogar(estado, 0, { pedraId: "trava", lado: "esquerda" });
    expect(resultado.resultado).toMatchObject({ motivo: "fechado-proposito", vencedor: "JER", pecaConcedida: true });
  });

  it("entrega Fechado de Propósito à dupla adversária quando a soma não é menor", () => {
    const estado = estadoTeste(criarConfronto(8), {
      mesa: [{ pedra: pedra("mesa", 1, 2), esquerda: 1, direita: 2 }],
      maos: {
        0: [pedra("trava", 1, 3), pedra("alternativa", 1, 4)],
        1: [pedra("adversario1", 0, 0)],
        2: [pedra("parceiro", 4, 5)],
        3: [pedra("adversario2", 5, 5)],
      },
    });
    const resultado = jogar(estado, 0, { pedraId: "trava", lado: "esquerda" });
    expect(resultado.resultado).toMatchObject({ motivo: "fechado-proposito", vencedor: "JES", pecaConcedida: true });
  });

  it("resolve Fechado por Ponta e anula quando há empate entre duplas", () => {
    const fechado = estadoTeste(criarConfronto(9), {
      mesa: [{ pedra: pedra("mesa", 0, 0), esquerda: 0, direita: 0 }],
      maos: {
        0: [pedra("a", 6, 6)],
        1: [pedra("b", 1, 1)],
        2: [pedra("c", 5, 5)],
        3: [pedra("d", 2, 2)],
      },
    });
    expect(fecharPorPasses(fechado).resultado).toMatchObject({ motivo: "fechado-ponta", vencedor: "JES" });

    const empate = estadoTeste(criarConfronto(10), {
      mesa: [{ pedra: pedra("mesa", 0, 0), esquerda: 0, direita: 0 }],
      maos: {
        0: [pedra("a", 1, 1)],
        1: [pedra("b", 1, 1)],
        2: [pedra("c", 4, 4)],
        3: [pedra("d", 5, 5)],
      },
    });
    const anulado = fecharPorPasses(empate);
    expect(anulado.resultado).toMatchObject({ motivo: "anulada", vencedor: null });
    expect(anulado.confronto.proximaMaoValeCinco).toBe(true);
    expect(iniciarMao(anulado.confronto).aberturaValeCinco).toBe(true);
  });

  it("fecha a mão seguinte ao empate com abertura em 1/1 e valor cinco", () => {
    const confronto = { ...criarConfronto(11), proximaMaoValeCinco: true };
    const mao = iniciarMao(confronto);
    expect(mao.aberturaPorBucha).toBe(true);
    expect(mao.aberturaValeCinco).toBe(true);
    expect(jogadasLegais(mao, mao.vez)).toHaveLength(1);
  });

  it("vence o confronto melhor de três ao alcançar duas peças", () => {
    let resultado = vencerComBuchada(criarConfronto(12));
    resultado = vencerComBuchada(resultado.confronto);
    expect(resultado.confronto.pecas.JER).toBe(2);
    expect(resultado.confronto.vencedor).toBe("JER");
  });
});
