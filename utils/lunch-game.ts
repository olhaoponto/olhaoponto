import type { TimeEntry } from "./work-time";

export type LunchGameStatus = "locked" | "open" | "closed";

export type LunchGameState = {
  status: LunchGameStatus;
  closesAt: string | null;
  remainingMs: number;
};

export type LunchGameDifficulty = "easy" | "medium" | "hard";

export type LunchGamePiece = {
  id: string;
  pairId: string;
  icon: string;
  color: string;
  layer: number;
  row: number;
  column: number;
};

const LUNCH_WINDOW_MS = 60 * 60 * 1000;
const ICONS = [
  "coffee-outline",
  "food-apple-outline",
  "fruit-cherries",
  "pizza",
  "cupcake",
  "bottle-soda-outline",
  "hamburger",
  "silverware-fork-knife",
  "food-drumstick-outline",
  "ice-cream",
  "noodles",
  "leaf",
  "carrot",
  "cheese",
  "rice",
  "cookie-outline",
  "fish",
  "egg-outline",
  "food-croissant",
  "mushroom-outline",
  "popcorn",
  "water-outline",
  "food-variant",
  "candy-outline",
] as const;
const COLORS = [
  "#EF7967",
  "#F2C648",
  "#24B3A2",
  "#6C63FF",
  "#E85AAD",
  "#4AA3DF",
  "#F28E2B",
  "#7EBD5A",
];

function timeOf(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function civilDateOf(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function entryDate(entry: TimeEntry): string | null {
  if (entry.data) return entry.data;
  const timestamp = timeOf(entry.registrado_em);
  return timestamp ? civilDateOf(new Date(timestamp)) : null;
}

export function getLunchGameState(
  entries: readonly TimeEntry[],
  now: Date = new Date(),
): LunchGameState {
  const today = civilDateOf(now);
  const todayEntries = entries.filter((entry) => entryDate(entry) === today);
  const lunchOut = todayEntries
    .filter((entry) => entry.tipo === "saida_almoco")
    .sort((a, b) => timeOf(a.registrado_em) - timeOf(b.registrado_em))[0];
  if (!lunchOut) return { status: "locked", closesAt: null, remainingMs: 0 };

  const outAt = timeOf(lunchOut.registrado_em);
  const lunchReturn = todayEntries
    .filter(
      (entry) =>
        entry.tipo === "volta_almoco" && timeOf(entry.registrado_em) >= outAt,
    )
    .sort((a, b) => timeOf(a.registrado_em) - timeOf(b.registrado_em))[0];
  if (lunchReturn)
    return {
      status: "closed",
      closesAt: new Date(outAt + LUNCH_WINDOW_MS).toISOString(),
      remainingMs: 0,
    };

  const closesAtMs = outAt + LUNCH_WINDOW_MS;
  const remainingMs = Math.max(0, closesAtMs - now.getTime());
  return {
    status: remainingMs > 0 ? "open" : "closed",
    closesAt: new Date(closesAtMs).toISOString(),
    remainingMs,
  };
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let value = Math.abs(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    const target = Math.floor((value / 4294967296) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function pairCountFor(difficulty: LunchGameDifficulty): number {
  return difficulty === "easy" ? 12 : difficulty === "medium" ? 18 : 24;
}

export function generateLunchGameBoard(
  difficulty: LunchGameDifficulty,
  seed = 1,
): LunchGamePiece[] {
  const pairs = pairCountFor(difficulty);
  const layers = difficulty === "easy" ? 3 : difficulty === "medium" ? 3 : 4;
  const pairsPerLayer = Math.ceil(pairs / layers);
  const columns = difficulty === "hard" ? 12 : difficulty === "medium" ? 9 : 8;
  const shuffledIcons = seededShuffle(ICONS, seed);
  const pieces: LunchGamePiece[] = [];
  let pairIndex = 0;

  for (let layer = 0; layer < layers && pairIndex < pairs; layer += 1) {
    const layerPairs = Math.min(pairsPerLayer, pairs - pairIndex);
    let remainingPairs = layerPairs;
    let row = 0;
    while (remainingPairs > 0 && pairIndex < pairs) {
      const rowPairs = Math.min(remainingPairs, Math.floor(columns / 2));
      for (
        let localPair = 0;
        localPair < rowPairs && pairIndex < pairs;
        localPair += 1
      ) {
        const left = localPair;
        const right = columns - localPair - 1;
        // Os pares são colocados na ordem inversa da remoção: as bordas
        // correspondem ao primeiro par disponível e os bloqueadores ficam no fim.
        const pairId = `pair-${pairs - 1 - pairIndex}`;
        const icon = shuffledIcons[pairIndex % shuffledIcons.length];
        const color = COLORS[pairIndex % COLORS.length];
        const offset = layer % 2 === 0 ? 0 : 0.5;
        pieces.push({
          id: `piece-${pairIndex}-a`,
          pairId,
          icon,
          color,
          layer,
          row,
          column: left + offset,
        });
        pieces.push({
          id: `piece-${pairIndex}-b`,
          pairId,
          icon,
          color,
          layer,
          row,
          column: right + offset,
        });
        pairIndex += 1;
      }
      remainingPairs -= rowPairs;
      row += 1;
    }
  }
  return pieces;
}

export function isLunchGamePieceFree(
  piece: LunchGamePiece,
  remaining: readonly LunchGamePiece[],
): boolean {
  const sameOrAbove = remaining.filter(
    (candidate) => candidate.id !== piece.id,
  );
  const covered = sameOrAbove.some(
    (candidate) =>
      candidate.layer > piece.layer &&
      Math.abs(candidate.column - piece.column) < 1.1 &&
      Math.abs(candidate.row - piece.row) < 1.1,
  );
  if (covered) return false;
  const leftBlocked = sameOrAbove.some(
    (candidate) =>
      candidate.layer === piece.layer &&
      candidate.row === piece.row &&
      Math.abs(candidate.column - piece.column) < 1.1 &&
      candidate.column < piece.column,
  );
  const rightBlocked = sameOrAbove.some(
    (candidate) =>
      candidate.layer === piece.layer &&
      candidate.row === piece.row &&
      Math.abs(candidate.column - piece.column) < 1.1 &&
      candidate.column > piece.column,
  );
  return !leftBlocked || !rightBlocked;
}

export function getLunchGamePairCount(difficulty: LunchGameDifficulty): number {
  return pairCountFor(difficulty);
}

export const LUNCH_GAME_WINDOW_MS = LUNCH_WINDOW_MS;
