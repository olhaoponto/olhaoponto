import { describe, expect, it } from "vitest";
import {
  generateLunchGameBoard,
  getLunchGameBoardMetrics,
  getLunchGamePairCount,
  getLunchGameState,
  isLunchGamePieceFree,
  undoLunchGamePair,
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

  it("mantém uma jogada livre e pode ser consumido em várias seeds", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (const seed of [1, 7, 42, 99, 20261123]) {
        let remaining = generateLunchGameBoard(difficulty, seed);
        while (remaining.length) {
          const free = remaining.filter((piece) =>
            isLunchGamePieceFree(piece, remaining),
          );
          expect(free.length).toBeGreaterThanOrEqual(2);
          const pairId = free.find((piece) =>
            free.some((other) => other.pairId === piece.pairId && other.id !== piece.id),
          )?.pairId;
          expect(pairId).toBeDefined();
          remaining = remaining.filter((piece) => piece.pairId !== pairId);
        }
      }
    }
  });

  it("usa as formas fixas sem sobreposição na mesma camada", () => {
    const expected = {
      easy: [16, 8],
      medium: [24, 8, 4],
      hard: [30, 12, 6],
    } as const;
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const board = generateLunchGameBoard(difficulty, 42);
      const metrics = getLunchGameBoardMetrics(difficulty);
      expect(metrics.width).toBe(metrics.columns * 62);
      expect(metrics.height).toBe(metrics.rows * 70);
      for (const [layer, count] of expected[difficulty].entries()) {
        const pieces = board.filter((piece) => piece.layer === layer);
        expect(pieces).toHaveLength(count);
        for (const piece of pieces) {
          expect(
            pieces.filter(
              (other) =>
                other.id !== piece.id &&
                other.row === piece.row &&
                Math.abs(other.column - piece.column) < 1,
            ),
          ).toHaveLength(0);
        }
      }
    }
  });

  it("desfaz somente o último par removido", () => {
    expect(undoLunchGamePair(["a", "b", "c", "d"], ["c", "d"])).toEqual([
      "a",
      "b",
    ]);
  });
});
