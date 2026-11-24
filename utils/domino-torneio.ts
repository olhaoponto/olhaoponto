export type Jogador = 0 | 1 | 2 | 3;
export type Dupla = "JER" | "JES";
export type Lado = "esquerda" | "direita";
export type TipoJogadaEspecial =
  | "buchada"
  | "lasquine"
  | "lasquine-preso"
  | "fechado-proposito"
  | "fechado-ponta";

export type Pedra = { id: string; a: number; b: number };
export type Jogada = { pedraId: string; lado: Lado };
export type PedraNaMesa = { pedra: Pedra; esquerda: number; direita: number };
export type PlacarDuplas = Record<Dupla, number>;
export type RegistroEspeciais = Record<Dupla, {
  feitas: Record<TipoJogadaEspecial, number>;
  sofridas: Record<TipoJogadaEspecial, number>;
}>;

export type Confronto = {
  seed: number;
  mao: number;
  pontos: PlacarDuplas;
  pecas: PlacarDuplas;
  gc: 0;
  ultimaDuplaVencedora: Dupla | null;
  ultimoJogadorVencedor: Jogador | null;
  proximaMaoValeCinco: boolean;
  vencedor: Dupla | null;
  especiais: RegistroEspeciais;
};

export type EstadoMao = {
  confronto: Confronto;
  mao: number;
  maos: Record<Jogador, Pedra[]>;
  dormem: Pedra[];
  mesa: PedraNaMesa[];
  vez: Jogador;
  aberturaPorBucha: boolean;
  aberturaValeCinco: boolean;
  passes: number;
  fechado: boolean;
  fechamento: "proposito" | "ponta" | null;
  resolvida: boolean;
  resultado: ResultadoMao | null;
};

export type ResultadoMao = {
  vencedor: Dupla | null;
  motivo: "batida" | "buchada" | "lasquine-preso" | "fechado-proposito" | "fechado-ponta" | "anulada";
  jogador: Jogador | null;
  pontosConcedidos: number;
  pecaConcedida: boolean;
};

export const DUPLA_DE: Record<Jogador, Dupla> = { 0: "JER", 1: "JES", 2: "JER", 3: "JES" };
export const JOGADORES: readonly Jogador[] = [0, 1, 2, 3];
export const META_PECAS = 2;
export const PEDRAS_POR_JOGADOR = 6;
export const PEDRAS_DORMEM = 4;

const tiposEspeciais: readonly TipoJogadaEspecial[] = [
  "buchada", "lasquine", "lasquine-preso", "fechado-proposito", "fechado-ponta",
];

function registroVazio(): RegistroEspeciais {
  const zerado = () => Object.fromEntries(tiposEspeciais.map((tipo) => [tipo, 0])) as Record<TipoJogadaEspecial, number>;
  return {
    JER: { feitas: zerado(), sofridas: zerado() },
    JES: { feitas: zerado(), sofridas: zerado() },
  };
}

function proximaJogada(jogador: Jogador): Jogador {
  return ((jogador + 1) % 4) as Jogador;
}

function somaPedras(pedras: readonly Pedra[]): number {
  return pedras.reduce((total, pedra) => total + pedra.a + pedra.b, 0);
}

function eDupla(pedra: Pedra): boolean {
  return pedra.a === pedra.b;
}

function novaSemente(seed: number): number {
  return (Math.imul(Math.trunc(seed) || 1, 1664525) + 1013904223) >>> 0;
}

function embaralhar(pedras: readonly Pedra[], seed: number): Pedra[] {
  const resultado = [...pedras];
  let valor = Math.abs(Math.trunc(seed)) || 1;
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    valor = novaSemente(valor);
    const destino = valor % (indice + 1);
    [resultado[indice], resultado[destino]] = [resultado[destino], resultado[indice]];
  }
  return resultado;
}

export function conjuntoDuploSeis(): Pedra[] {
  const pedras: Pedra[] = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) pedras.push({ id: `${a}-${b}`, a, b });
  }
  return pedras;
}

function temBucha(pedras: readonly Pedra[]): boolean {
  return pedras.some((pedra) => pedra.a === 1 && pedra.b === 1);
}

function duplaDo(jogador: Jogador): Dupla {
  return DUPLA_DE[jogador];
}

function copiaPlacar(placar: PlacarDuplas): PlacarDuplas {
  return { JER: placar.JER, JES: placar.JES };
}

export function criarConfronto(seed: number): Confronto {
  return {
    seed,
    mao: 0,
    pontos: { JER: 0, JES: 0 },
    pecas: { JER: 0, JES: 0 },
    gc: 0,
    ultimaDuplaVencedora: null,
    ultimoJogadorVencedor: null,
    proximaMaoValeCinco: false,
    vencedor: null,
    especiais: registroVazio(),
  };
}

function distribuir(confronto: Confronto): { maos: Record<Jogador, Pedra[]>; dormem: Pedra[]; seed: number } {
  const precisaBucha = confronto.proximaMaoValeCinco ||
    ((confronto.pontos.JER === 0 && confronto.pontos.JES === 0) || (confronto.pontos.JER === 3 && confronto.pontos.JES === 3));
  let seed = confronto.seed + confronto.mao * 1009 + 17;
  for (let tentativa = 0; tentativa < 256; tentativa += 1) {
    const pedras = embaralhar(conjuntoDuploSeis(), seed);
    const maos = {
      0: pedras.slice(0, 6),
      1: pedras.slice(6, 12),
      2: pedras.slice(12, 18),
      3: pedras.slice(18, 24),
    } satisfies Record<Jogador, Pedra[]>;
    const dormem = pedras.slice(24);
    if (!precisaBucha || !temBucha(dormem)) return { maos, dormem, seed };
    seed += 1;
  }
  throw new Error("Não foi possível distribuir uma mão com a bucha 1/1 fora do dorme.");
}

export function iniciarMao(confronto: Confronto): EstadoMao {
  if (confronto.vencedor) throw new Error("O confronto já terminou.");
  const distribuicao = distribuir(confronto);
  const mao = confronto.mao + 1;
  const aberturaPorBucha = confronto.proximaMaoValeCinco ||
    ((confronto.pontos.JER === 0 && confronto.pontos.JES === 0) || (confronto.pontos.JER === 3 && confronto.pontos.JES === 3));
  const jogadorComBucha = (JOGADORES.find((jogador) => distribuicao.maos[jogador].some((pedra) => pedra.a === 1 && pedra.b === 1)) ?? 0) as Jogador;
  const vez = aberturaPorBucha
    ? jogadorComBucha
    : (confronto.ultimoJogadorVencedor ?? (confronto.ultimaDuplaVencedora === "JER" ? 0 : 1));
  return {
    confronto: { ...confronto, mao, seed: distribuicao.seed },
    mao,
    maos: distribuicao.maos,
    dormem: distribuicao.dormem,
    mesa: [],
    vez,
    aberturaPorBucha,
    aberturaValeCinco: confronto.proximaMaoValeCinco,
    passes: 0,
    fechado: false,
    fechamento: null,
    resolvida: false,
    resultado: null,
  };
}

function casa(pedra: Pedra, valor: number): boolean {
  return pedra.a === valor || pedra.b === valor;
}

export function pontas(estado: { mesa: readonly PedraNaMesa[] }): { esquerda: number | null; direita: number | null } {
  const primeira = estado.mesa[0];
  const ultima = estado.mesa[estado.mesa.length - 1];
  return primeira && ultima ? { esquerda: primeira.esquerda, direita: ultima.direita } : { esquerda: null, direita: null };
}

function colocar(mesa: readonly PedraNaMesa[], pedra: Pedra, lado: Lado): PedraNaMesa[] {
  if (!mesa.length) return [{ pedra, esquerda: pedra.a, direita: pedra.b }];
  const extremos = pontas({ mesa });
  if (lado === "esquerda") {
    return [{ pedra, esquerda: pedra.a === extremos.esquerda ? pedra.b : pedra.a, direita: extremos.esquerda as number }, ...mesa];
  }
  return [...mesa, { pedra, esquerda: extremos.direita as number, direita: pedra.a === extremos.direita ? pedra.b : pedra.a }];
}

export function jogadasLegais(estado: EstadoMao, jogador: Jogador): Jogada[] {
  if (estado.resolvida || estado.vez !== jogador) return [];
  const mao = estado.maos[jogador];
  if (!estado.mesa.length) {
    if (estado.aberturaPorBucha) {
      return jogador === estado.vez
        ? mao.filter((pedra) => pedra.a === 1 && pedra.b === 1).map((pedra) => ({ pedraId: pedra.id, lado: "direita" as Lado }))
        : [];
    }
    return mao.map((pedra) => ({ pedraId: pedra.id, lado: "direita" as Lado }));
  }
  const extremos = pontas(estado);
  return mao.flatMap((pedra) => {
    const jogadas: Jogada[] = [];
    if (casa(pedra, extremos.esquerda as number)) jogadas.push({ pedraId: pedra.id, lado: "esquerda" });
    if (casa(pedra, extremos.direita as number)) jogadas.push({ pedraId: pedra.id, lado: "direita" });
    return jogadas;
  });
}

function estadoComJogada(estado: EstadoMao, jogador: Jogador, jogada: Jogada): EstadoMao | null {
  const pedra = estado.maos[jogador].find((item) => item.id === jogada.pedraId);
  if (!pedra) return null;
  const mao = estado.maos[jogador].filter((item) => item.id !== jogada.pedraId);
  return {
    ...estado,
    maos: { ...estado.maos, [jogador]: mao },
    mesa: colocar(estado.mesa, pedra, jogada.lado),
    vez: proximaJogada(jogador),
    passes: 0,
  };
}

function todosSemJogada(estado: EstadoMao): boolean {
  return JOGADORES.every((jogador) => jogadasLegais({ ...estado, vez: jogador }, jogador).length === 0);
}

function jogadaTrava(estado: EstadoMao, jogada: Jogada, jogador: Jogador): boolean {
  const depois = estadoComJogada(estado, jogador, jogada);
  return depois ? todosSemJogada(depois) : false;
}

function registraEspecial(confronto: Confronto, dupla: Dupla, tipo: TipoJogadaEspecial): Confronto {
  const outro: Dupla = dupla === "JER" ? "JES" : "JER";
  const especiais: RegistroEspeciais = {
    JER: { feitas: { ...confronto.especiais.JER.feitas }, sofridas: { ...confronto.especiais.JER.sofridas } },
    JES: { feitas: { ...confronto.especiais.JES.feitas }, sofridas: { ...confronto.especiais.JES.sofridas } },
  };
  especiais[dupla].feitas[tipo] += 1;
  especiais[outro].sofridas[tipo] += 1;
  return { ...confronto, especiais };
}

function atualizaPlacar(confronto: Confronto, dupla: Dupla, especial: boolean, valeCinco: boolean): { confronto: Confronto; pontos: number; peca: boolean } {
  const pontos = copiaPlacar(confronto.pontos);
  const pecas = copiaPlacar(confronto.pecas);
  if (especial) {
    pecas[dupla] += 1;
    pontos[dupla] = 0;
    return { confronto: { ...confronto, pontos, pecas, vencedor: pecas[dupla] >= META_PECAS ? dupla : null }, pontos: 0, peca: true };
  }
  const atual = pontos[dupla];
  if (valeCinco) {
    if (atual === 0) {
      pontos[dupla] = 5;
      return { confronto: { ...confronto, pontos }, pontos: 5, peca: false };
    }
    pecas[dupla] += 1;
    pontos[dupla] = 0;
    return { confronto: { ...confronto, pontos, pecas, vencedor: pecas[dupla] >= META_PECAS ? dupla : null }, pontos: 0, peca: true };
  }
  if (atual === 0) {
    pontos[dupla] = 3;
    return { confronto: { ...confronto, pontos }, pontos: 3, peca: false };
  }
  if (atual === 3) {
    pontos[dupla] = 5;
    return { confronto: { ...confronto, pontos }, pontos: 5, peca: false };
  }
  pecas[dupla] += 1;
  pontos[dupla] = 0;
  return { confronto: { ...confronto, pontos, pecas, vencedor: pecas[dupla] >= META_PECAS ? dupla : null }, pontos: 0, peca: true };
}

function conclui(estado: EstadoMao, vencedor: Dupla | null, motivo: ResultadoMao["motivo"], jogador: Jogador | null, especial: TipoJogadaEspecial | null, forcaPeca: boolean, valeCinco = false): EstadoMao {
  let confronto = { ...estado.confronto, proximaMaoValeCinco: vencedor === null && motivo === "anulada" };
  if (especial) confronto = registraEspecial(confronto, duplaDo(jogador ?? 0), especial);
  if (vencedor) {
    const atualizado = atualizaPlacar(confronto, vencedor, forcaPeca, valeCinco);
    confronto = { ...atualizado.confronto, ultimaDuplaVencedora: vencedor, ultimoJogadorVencedor: jogador };
  }
  const resultado: ResultadoMao = {
    vencedor,
    motivo,
    jogador,
    pontosConcedidos: vencedor ? (forcaPeca ? 0 : (valeCinco && confronto.pontos[vencedor] === 5 ? 5 : confronto.pontos[vencedor])) : 0,
    pecaConcedida: vencedor ? forcaPeca || (valeCinco && confronto.pontos[vencedor] === 0) : false,
  };
  return { ...estado, confronto, resolvida: true, resultado, fechado: motivo === "fechado-ponta" || motivo === "fechado-proposito" || motivo === "lasquine-preso" };
}

export function jogar(estado: EstadoMao, jogador: Jogador, jogada: Jogada): EstadoMao {
  if (estado.resolvida || estado.vez !== jogador || !jogadasLegais(estado, jogador).some((item) => item.pedraId === jogada.pedraId && item.lado === jogada.lado)) return estado;
  const pedra = estado.maos[jogador].find((item) => item.id === jogada.pedraId);
  if (!pedra) return estado;
  const lasquine = estado.mesa.length > 0 && jogadasLegais(estado, jogador).filter((item) => item.pedraId === jogada.pedraId).length === 2;
  const travou = jogadaTrava(estado, jogada, jogador);
  const alternativas = jogadasLegais(estado, jogador).filter((item) => item.pedraId !== jogada.pedraId).some((item) => !jogadaTrava(estado, item, jogador));
  const depois = estadoComJogada(estado, jogador, jogada);
  if (!depois) return estado;
  const confrontoComLasquine = lasquine
    ? registraEspecial(depois.confronto, duplaDo(jogador), travou ? "lasquine-preso" : "lasquine")
    : depois.confronto;
  const depoisComEspecial = { ...depois, confronto: confrontoComLasquine };
  if (!depois.maos[jogador].length) {
    const buchada = eDupla(pedra);
    return conclui(depoisComEspecial, duplaDo(jogador), buchada ? "buchada" : "batida", jogador, buchada ? "buchada" : null, buchada);
  }
  if (travou && alternativas) {
    const somaJogador = somaPedras(depois.maos[jogador]);
    const menores = JOGADORES.filter((outro) => duplaDo(outro) !== duplaDo(jogador)).every((outro) => somaJogador < somaPedras(depois.maos[outro]));
    const vencedor = menores ? duplaDo(jogador) : (duplaDo(jogador) === "JER" ? "JES" : "JER");
    return conclui(depoisComEspecial, vencedor, "fechado-proposito", jogador, "fechado-proposito", true);
  }
  if (travou && lasquine) {
    return conclui(depoisComEspecial, duplaDo(jogador), "lasquine-preso", jogador, null, true);
  }
  if (travou) {
    const somas = JOGADORES.map((outro) => ({ dupla: duplaDo(outro), soma: somaPedras(depois.maos[outro]) }));
    const menor = Math.min(...somas.map((item) => item.soma));
    const duplasMenores = new Set(somas.filter((item) => item.soma === menor).map((item) => item.dupla));
    if (duplasMenores.size > 1) return conclui(depoisComEspecial, null, "anulada", jogador, null, false);
    return conclui(depoisComEspecial, [...duplasMenores][0] as Dupla, "fechado-ponta", jogador, "fechado-ponta", false);
  }
  return depoisComEspecial;
}

export function passar(estado: EstadoMao, jogador: Jogador): EstadoMao {
  if (estado.resolvida || estado.vez !== jogador || jogadasLegais(estado, jogador).length > 0) return estado;
  const passes = estado.passes + 1;
  return { ...estado, passes, vez: proximaJogada(jogador), fechado: passes >= 4, fechamento: passes >= 4 ? "ponta" : null };
}

export function resolverMao(estado: EstadoMao): EstadoMao {
  if (estado.resolvida || !estado.fechado) return estado;
  const somas = JOGADORES.map((jogador) => ({ jogador, dupla: duplaDo(jogador), soma: somaPedras(estado.maos[jogador]) }));
  const menor = Math.min(...somas.map((item) => item.soma));
  const menores = new Set(somas.filter((item) => item.soma === menor).map((item) => item.dupla));
  if (menores.size > 1) return conclui(estado, null, "anulada", null, null, false);
  const vencedor = [...menores][0] as Dupla;
  return conclui(estado, vencedor, "fechado-ponta", null, "fechado-ponta", false);
}

export function jogadaBot(estado: EstadoMao, jogador: Jogador): Jogada | null {
  const legais = jogadasLegais(estado, jogador);
  return [...legais].sort((esquerda, direita) => {
    const pedraEsquerda = estado.maos[jogador].find((pedra) => pedra.id === esquerda.pedraId);
    const pedraDireita = estado.maos[jogador].find((pedra) => pedra.id === direita.pedraId);
    return Number(Boolean(pedraDireita && eDupla(pedraDireita))) - Number(Boolean(pedraEsquerda && eDupla(pedraEsquerda))) ||
      (pedraDireita ? pedraDireita.a + pedraDireita.b : 0) - (pedraEsquerda ? pedraEsquerda.a + pedraEsquerda.b : 0) ||
      esquerda.lado.localeCompare(direita.lado);
  })[0] ?? null;
}

export const escolherJogadaBot = jogadaBot;

// Gancho futuro: Dobrada ainda não faz parte do Regulamento V4 implementado aqui.
