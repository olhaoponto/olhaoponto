import { describe, expect, it } from "vitest";
import {
  generateLunchGameBoard,
  getLunchGamePairCount,
  getLunchGameState,
  isLunchGamePieceFree,
} from "../utils/lunch-game";
import type { TimeEntry } from "../utils/work-time";

function entry(
  tipo: TimeEntry["tipo"],
  iso: string,
  data = "2026-11-23",
): TimeEntry {
  return { tipo, registrado_em: iso, data };
}

describe("estado do Mahjong do almoço", () => {
  const now = new Date("2026-11-23T16:00:00.000Z");

  it("fica bloqueado sem saída para o almoço", () => {
    expect(
      getLunchGameState([entry("entrada", "2026-11-23T11:00:00.000Z")], now),
    ).toEqual({ status: "locked", closesAt: null, remainingMs: 0 });
  });

  it("abre após a saída e fecha 60 minutos depois", () => {
    const state = getLunchGameState(
      [entry("saida_almoco", "2026-11-23T15:30:00.000Z")],
      now,
    );
    expect(state.status).toBe("open");
    expect(state.closesAt).toBe("2026-11-23T16:30:00.000Z");
    expect(state.remainingMs).toBe(30 * 60 * 1000);
    expect(
      getLunchGameState(
        [entry("saida_almoco", "2026-11-23T15:00:00.000Z")],
        now,
      ).status,
    ).toBe("closed");
  });

  it("fecha imediatamente quando a volta é batida", () => {
    const state = getLunchGameState(
      [
        entry("saida_almoco", "2026-11-23T15:30:00.000Z"),
        entry("volta_almoco", "2026-11-23T15:50:00.000Z"),
      ],
      now,
    );
    expect(state.status).toBe("closed");
    expect(state.remainingMs).toBe(0);
  });

  it("ignora batidas de outro dia na virada", () => {
    const state = getLunchGameState(
      [entry("saida_almoco", "2026-11-22T15:30:00.000Z", "2026-11-22")],
      new Date("2026-11-23T12:00:00.000Z"),
    );
    expect(state.status).toBe("locked");
  });
});

describe("tabuleiro resolvível", () => {
  it("gera dois exemplares de cada par nas três dificuldades", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const board = generateLunchGameBoard(difficulty, 42);
      expect(board).toHaveLength(getLunchGamePairCount(difficulty) * 2);
      expect(new Set(board.map((piece) => piece.pairId)).size).toBe(
        getLunchGamePairCount(difficulty),
      );
      for (const pairId of new Set(board.map((piece) => piece.pairId))) {
        expect(board.filter((piece) => piece.pairId === pairId)).toHaveLength(
          2,
        );
      }
    }
  });

  it("mantém uma jogada livre e pode ser consumido sem deixar peças bloqueadas", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      let remaining = generateLunchGameBoard(difficulty, 7);
      while (remaining.length) {
        const free = remaining.filter((piece) =>
          isLunchGamePieceFree(piece, remaining),
        );
        expect(free.length).toBeGreaterThan(0);
        const pairId = free[0].pairId;
        remaining = remaining.filter((piece) => piece.pairId !== pairId);
      }
    }
  });
});
