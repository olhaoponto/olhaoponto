import { describe, expect, it } from "vitest";
import {
  calculateDominoRoundScore,
  createDominoRound,
  createDominoSet,
  drawDominoTile,
  DOMINO_MATCH_TARGET,
  DOMINO_SCORING,
  getLegalDominoMoves,
  playDominoMove,
} from "../utils/domino";

// Alias local keeps the test intention explicit if the reusable engine adds a richer move query later.
const legalMoves = getLegalDominoMoves;

describe("engine de Dominó", () => {
  it("cria as 28 peças duplo-seis e distribui sete para cada jogador", () => {
    const tiles = createDominoSet();
    const state = createDominoRound(42);
    expect(tiles).toHaveLength(28);
    expect(new Set(tiles.map((tile) => tile.id)).size).toBe(28);
    expect(state.hand).toHaveLength(7);
    expect(state.computerHand).toHaveLength(7);
    expect(state.boneyard).toHaveLength(14);
  });

  it("é determinístico por seed", () => {
    expect(createDominoRound(99)).toEqual(createDominoRound(99));
    expect(createDominoRound(99).hand).not.toEqual(createDominoRound(100).hand);
  });

  it("permite jogar uma peça legal na abertura e rejeita peça inexistente", () => {
    const state = createDominoRound(7);
    const move = legalMoves(state, state.turn)[0];
    expect(move).toBeDefined();
    expect(playDominoMove(state, state.turn, move).chain).toHaveLength(1);
    expect(playDominoMove(state, state.turn, { tileId: "fake", side: "right" })).toEqual(state);
  });

  it("compra do monte quando não tem jogada e passa quando o monte acaba", () => {
    const state = createDominoRound(3);
    const noMoveState = { ...state, turn: "player" as const, hand: [{ id: "1-1", a: 1, b: 1 }], chain: [{ tile: { id: "6-6", a: 6, b: 6 }, left: 6, right: 6 }], boneyard: [{ id: "1-2", a: 1, b: 2 }] };
    const drawn = drawDominoTile(noMoveState, "player");
    expect(drawn.hand).toHaveLength(2);
    expect(drawn.turn).toBe("player");
    const passed = drawDominoTile({ ...drawn, boneyard: [] }, "player");
    expect(passed.turn).toBe("computer");
    expect(passed.passes).toBe(1);
  });

  it("encerra com batida e aplica pontuação configurável", () => {
    const state = createDominoRound(1);
    const tile = state.hand[0];
    const winning = { ...state, hand: [tile], computerHand: [], turn: "player" as const, chain: [] };
    const result = playDominoMove(winning, "player", { tileId: tile.id, side: "right" });
    expect(result.roundWinner).toBe("player");
    expect(result.roundPoints).toBe(DOMINO_SCORING[tile.a === tile.b ? "carroca" : "batida-simples"]);
  });

  it("vence o jogo trancado por menor soma de pontos", () => {
    const state = createDominoRound(2);
    const locked = { ...state, turn: "player" as const, hand: [{ id: "1-1", a: 1, b: 1 }], computerHand: [{ id: "5-6", a: 5, b: 6 }], chain: [{ tile: { id: "3-3", a: 3, b: 3 }, left: 3, right: 3 }], boneyard: [] };
    const result = drawDominoTile(locked, "player");
    const result2 = drawDominoTile(result, "computer");
    expect(result2.roundWinner).toBe("player");
  });

  it("expõe alvo da partida e pontuações", () => {
    expect(DOMINO_MATCH_TARGET).toBe(6);
    expect(calculateDominoRoundScore("batida-simples")).toBe(1);
    expect(calculateDominoRoundScore("carroca")).toBe(2);
    expect(calculateDominoRoundScore("la-e-lo")).toBe(3);
    expect(calculateDominoRoundScore("cruzada")).toBe(4);
  });
});
