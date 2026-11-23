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
export type LunchGameBoardMetrics = {
  columns: number;
  rows: number;
  width: number;
  height: number;
};

const LUNCH_WINDOW_MS = 60 * 60 * 1000;
export const LUNCH_GAME_WINDOW_MS = LUNCH_WINDOW_MS;
export const LUNCH_GAME_BOARD_VERSION = 2;
export const LUNCH_GAME_TILE_WIDTH = 62;
export const LUNCH_GAME_TILE_HEIGHT = 70;

const ICONS = [
  "🍜", "🍎", "🍒", "🍕", "🧁", "🍔", "🍣", "🥐", "🥕",
  "🧀", "🍪", "🐟", "🥚", "🍄", "🍿", "🐢", "🦊", "🦉",
] as const;
const COLORS = ["#C85B43", "#D49B35", "#3A8B77", "#5E7C9E", "#A45C79", "#557E63"] as const;
type LayerShape = { rows: number; columns: number };
const SHAPES: Record<LunchGameDifficulty, readonly LayerShape[]> = {
  easy: [{ rows: 4, columns: 4 }, { rows: 2, columns: 4 }],
  medium: [{ rows: 6, columns: 4 }, { rows: 4, columns: 2 }, { rows: 2, columns: 2 }],
  hard: [{ rows: 6, columns: 5 }, { rows: 4, columns: 3 }, { rows: 2, columns: 3 }],
};

function timeOf(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}
function civilDateOf(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}
function entryDate(entry: TimeEntry): string | null {
  if (entry.data) return entry.data;
  const timestamp = timeOf(entry.registrado_em);
  return timestamp ? civilDateOf(new Date(timestamp)) : null;
}

export function getLunchGameState(entries: readonly TimeEntry[], now: Date = new Date()): LunchGameState {
  const today = civilDateOf(now);
  const todayEntries = entries.filter((entry) => entryDate(entry) === today);
  const lunchOut = todayEntries
    .filter((entry) => entry.tipo === "saida_almoco")
    .sort((a, b) => timeOf(a.registrado_em) - timeOf(b.registrado_em))[0];
  if (!lunchOut) return { status: "locked", closesAt: null, remainingMs: 0 };
  const outAt = timeOf(lunchOut.registrado_em);
  const lunchReturn = todayEntries
    .filter((entry) => entry.tipo === "volta_almoco" && timeOf(entry.registrado_em) >= outAt)
    .sort((a, b) => timeOf(a.registrado_em) - timeOf(b.registrado_em))[0];
  if (lunchReturn) {
    return { status: "closed", closesAt: new Date(outAt + LUNCH_WINDOW_MS).toISOString(), remainingMs: 0 };
  }
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
export function getLunchGamePairCount(difficulty: LunchGameDifficulty): number {
  return pairCountFor(difficulty);
}
export function getLunchGameBoardMetrics(difficulty: LunchGameDifficulty): LunchGameBoardMetrics {
  const shapes = SHAPES[difficulty];
  const columns = Math.max(...shapes.map((shape) => shape.columns));
  const rows = Math.max(...shapes.map((shape) => shape.rows));
  return { columns, rows, width: columns * LUNCH_GAME_TILE_WIDTH, height: rows * LUNCH_GAME_TILE_HEIGHT };
}

function makeSlots(difficulty: LunchGameDifficulty): LunchGamePiece[] {
  const shapes = SHAPES[difficulty];
  const metrics = getLunchGameBoardMetrics(difficulty);
  return shapes.flatMap((shape, layer) => {
    const columnOffset = (metrics.columns - shape.columns) / 2;
    const rowOffset = (metrics.rows - shape.rows) / 2;
    return Array.from({ length: shape.rows * shape.columns }, (_, index) => {
      const row = Math.floor(index / shape.columns);
      const column = index % shape.columns;
      return {
        id: `piece-${layer}-${row}-${column}`,
        pairId: "", icon: "", color: COLORS[layer % COLORS.length], layer,
        row: row + rowOffset, column: column + columnOffset,
      };
    });
  });
}

export function isLunchGamePieceFree(piece: LunchGamePiece, remaining: readonly LunchGamePiece[]): boolean {
  const covered = remaining.some((candidate) =>
    candidate.id !== piece.id && candidate.layer > piece.layer &&
    Math.abs(candidate.column - piece.column) < 1 && Math.abs(candidate.row - piece.row) < 1,
  );
  if (covered) return false;
  const leftBlocked = remaining.some((candidate) =>
    candidate.id !== piece.id && candidate.layer === piece.layer &&
    Math.abs(candidate.row - piece.row) < 0.01 &&
    Math.abs(candidate.column - piece.column) < 1.01 && candidate.column < piece.column,
  );
  const rightBlocked = remaining.some((candidate) =>
    candidate.id !== piece.id && candidate.layer === piece.layer &&
    Math.abs(candidate.row - piece.row) < 0.01 &&
    Math.abs(candidate.column - piece.column) < 1.01 && candidate.column > piece.column,
  );
  return !leftBlocked || !rightBlocked;
}

export function hasFreeLunchGameMove(remaining: readonly LunchGamePiece[]): boolean {
  const freeIcons = new Set<string>();
  return remaining
    .filter((piece) => isLunchGamePieceFree(piece, remaining))
    .some((piece) => {
      if (freeIcons.has(piece.icon)) return true;
      freeIcons.add(piece.icon);
      return false;
    });
}

function findRemovalOrder(
  pieces: readonly LunchGamePiece[],
  seed: number,
): LunchGamePiece[] | null {
  const memo = new Set<string>();
  const search = (current: readonly LunchGamePiece[], depth: number): LunchGamePiece[] | null => {
    if (!current.length) return [];
    const key = current.map((piece) => piece.id).sort().join("|");
    if (memo.has(key)) return null;
    const free = seededShuffle(
      current.filter((piece) => isLunchGamePieceFree(piece, current)),
      seed + depth * 7919 + current.length * 131,
    );
    for (let firstIndex = 0; firstIndex < free.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < free.length; secondIndex += 1) {
        const first = free[firstIndex];
        const second = free[secondIndex];
        const next = current.filter((piece) => piece.id !== first.id && piece.id !== second.id);
        const rest = search(next, depth + 1);
        if (rest) return [first, second, ...rest];
      }
    }
    memo.add(key);
    return null;
  };
  return search(pieces, 0);
}

export function generateLunchGameBoard(difficulty: LunchGameDifficulty, seed = 1): LunchGamePiece[] {
  const slots = makeSlots(difficulty);
  const assignments = new Map<string, { pairId: string; icon: string; color: string }>();
  const shuffledIcons = seededShuffle(ICONS, seed + 97);
  const removalOrder = findRemovalOrder(slots, seed);
  if (!removalOrder) throw new Error(`Não foi possível montar o tabuleiro ${difficulty}`);
  for (let pairIndex = 0; pairIndex < removalOrder.length / 2; pairIndex += 1) {
    const first = removalOrder[pairIndex * 2];
    const second = removalOrder[pairIndex * 2 + 1];
    const assignment = {
      pairId: `pair-${pairIndex}`,
      icon: shuffledIcons[pairIndex % shuffledIcons.length],
      color: COLORS[pairIndex % COLORS.length],
    };
    assignments.set(first.id, assignment);
    assignments.set(second.id, assignment);
  }
  return slots.map((slot) => ({
    ...slot,
    ...(assignments.get(slot.id) ?? { pairId: "", icon: shuffledIcons[0], color: COLORS[0] }),
  }));
}

export function reshuffleLunchGameEmojis(
  pieces: readonly LunchGamePiece[],
  removedIds: readonly string[],
  seed = 1,
): LunchGamePiece[] {
  const removed = new Set(removedIds);
  const active = pieces.filter((piece) => !removed.has(piece.id));
  if (active.length < 2) return [...pieces];
  const removalOrder = findRemovalOrder(active, seed);
  if (!removalOrder) return [...pieces];
  const shuffledIcons = seededShuffle(ICONS, seed + 193);
  const icons = new Map<string, string>();
  for (let index = 0; index < removalOrder.length; index += 2) {
    const icon = shuffledIcons[(index / 2) % shuffledIcons.length];
    icons.set(removalOrder[index].id, icon);
    icons.set(removalOrder[index + 1].id, icon);
  }
  return pieces.map((piece) => ({
    ...piece,
    icon: icons.get(piece.id) ?? piece.icon,
  }));
}

export function undoLunchGamePair(removedIds: readonly string[], pairIds: readonly string[]): string[] {
  const removed = new Set(removedIds);
  for (const id of pairIds) removed.delete(id);
  return [...removed];
}
