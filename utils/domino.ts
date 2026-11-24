export type DominoPlayer = "player" | "computer";
export type DominoSide = "left" | "right";
export type DominoRoundType = "batida-simples" | "carroca" | "la-e-lo" | "cruzada" | "trancado";

export type DominoTile = { id: string; a: number; b: number };
export type DominoMove = { tileId: string; side: DominoSide };
export type DominoPlacedTile = { tile: DominoTile; left: number; right: number };

export const DOMINO_SCORING: Readonly<Record<DominoRoundType, number>> = {
  "batida-simples": 1,
  carroca: 2,
  "la-e-lo": 3,
  cruzada: 4,
  trancado: 1,
};
export const DOMINO_MATCH_TARGET = 6;

export type DominoGameState = {
  seed: number;
  hand: DominoTile[];
  computerHand: DominoTile[];
  boneyard: DominoTile[];
  chain: DominoPlacedTile[];
  turn: DominoPlayer;
  passes: number;
  scores: { player: number; computer: number };
  roundWinner: DominoPlayer | "draw" | null;
  matchWinner: DominoPlayer | null;
  roundType: DominoRoundType | null;
  roundPoints: number;
};

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let value = Math.abs(Math.trunc(seed)) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    const target = Math.floor((value / 4294967296) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createDominoSet(): DominoTile[] {
  return Array.from({ length: 28 }, (_, index) => {
    let current = 0;
    for (let a = 0; a <= 6; a += 1) {
      for (let b = a; b <= 6; b += 1) {
        if (current === index) return { id: `${a}-${b}`, a, b };
        current += 1;
      }
    }
    return { id: `missing-${index}`, a: 0, b: 0 };
  });
}

function pipTotal(tile: DominoTile): number { return tile.a + tile.b; }
function isDouble(tile: DominoTile): boolean { return tile.a === tile.b; }
function highestTile(tiles: readonly DominoTile[]): DominoTile | null {
  return [...tiles].sort((left, right) => (Number(isDouble(right)) - Number(isDouble(left))) || pipTotal(right) - pipTotal(left) || right.id.localeCompare(left.id))[0] ?? null;
}

export function chooseDominoStarter(playerHand: readonly DominoTile[], computerHand: readonly DominoTile[]): DominoPlayer {
  const playerDouble = [...playerHand].filter(isDouble).sort((a, b) => b.a - a.a)[0];
  const computerDouble = [...computerHand].filter(isDouble).sort((a, b) => b.a - a.a)[0];
  if (playerDouble || computerDouble) return !computerDouble || (playerDouble && playerDouble.a >= computerDouble.a) ? "player" : "computer";
  const playerHigh = highestTile(playerHand);
  const computerHigh = highestTile(computerHand);
  return !computerHigh || (playerHigh && pipTotal(playerHigh) >= pipTotal(computerHigh)) ? "player" : "computer";
}

export function createDominoRound(seed = 1, scores = { player: 0, computer: 0 }): DominoGameState {
  const shuffled = seededShuffle(createDominoSet(), seed);
  const hand = shuffled.slice(0, 7);
  const computerHand = shuffled.slice(7, 14);
  return {
    seed,
    hand,
    computerHand,
    boneyard: shuffled.slice(14),
    chain: [],
    turn: chooseDominoStarter(hand, computerHand),
    passes: 0,
    scores: { ...scores },
    roundWinner: null,
    matchWinner: null,
    roundType: null,
    roundPoints: 0,
  };
}

export function getDominoEnds(state: { chain: readonly DominoPlacedTile[] }): { left: number | null; right: number | null } {
  const first = state.chain[0];
  const last = state.chain[state.chain.length - 1];
  return first && last ? { left: first.left, right: last.right } : { left: null, right: null };
}

export function getLegalDominoMoves(state: Pick<DominoGameState, "chain" | "hand" | "computerHand">, player: DominoPlayer): DominoMove[] {
  const hand = player === "player" ? state.hand : state.computerHand;
  const ends = getDominoEnds(state);
  if (ends.left === null || ends.right === null) return hand.map((tile) => ({ tileId: tile.id, side: "right" }));
  return hand.flatMap((tile) => {
    const moves: DominoMove[] = [];
    if (tile.a === ends.left || tile.b === ends.left) moves.push({ tileId: tile.id, side: "left" });
    if (tile.a === ends.right || tile.b === ends.right) moves.push({ tileId: tile.id, side: "right" });
    return moves;
  });
}

function placeTile(chain: readonly DominoPlacedTile[], tile: DominoTile, side: DominoSide): DominoPlacedTile[] {
  if (!chain.length) return [{ tile, left: tile.a, right: tile.b }];
  const ends = getDominoEnds({ chain });
  if (side === "left") {
    return [{ tile, left: tile.a === ends.left ? tile.b : tile.a, right: ends.left as number }, ...chain];
  }
  return [...chain, { tile, left: ends.right as number, right: tile.a === ends.right ? tile.b : tile.a }];
}

function matchesEnd(tile: DominoTile, end: number | null): boolean {
  return end !== null && (tile.a === end || tile.b === end);
}

export function getDominoMoveType(state: Pick<DominoGameState, "chain">, tile: DominoTile): DominoRoundType {
  if (state.chain.length === 0) return isDouble(tile) ? "carroca" : "batida-simples";
  const ends = getDominoEnds(state);
  const matchesBothEnds = matchesEnd(tile, ends.left) && matchesEnd(tile, ends.right);
  if (isDouble(tile) && ends.left === ends.right && matchesBothEnds) return "cruzada";
  if (!isDouble(tile) && matchesBothEnds) return "la-e-lo";
  return isDouble(tile) ? "carroca" : "batida-simples";
}

function finishRound(state: DominoGameState, winner: DominoPlayer | "draw", roundType: DominoRoundType): DominoGameState {
  const roundPoints = winner === "draw" ? 0 : DOMINO_SCORING[roundType];
  const scores = winner === "draw" ? state.scores : { ...state.scores, [winner]: state.scores[winner] + roundPoints };
  return { ...state, scores, roundWinner: winner, matchWinner: scores.player >= DOMINO_MATCH_TARGET ? "player" : scores.computer >= DOMINO_MATCH_TARGET ? "computer" : null, roundType, roundPoints };
}

export function playDominoMove(state: DominoGameState, player: DominoPlayer, move: DominoMove): DominoGameState {
  if (state.roundWinner || state.matchWinner || state.turn !== player) return state;
  const legal = getLegalDominoMoves(state, player).some((candidate) => candidate.tileId === move.tileId && candidate.side === move.side);
  if (!legal) return state;
  const handKey = player === "player" ? "hand" : "computerHand";
  const hand = state[handKey];
  const tile = hand.find((candidate) => candidate.id === move.tileId);
  if (!tile) return state;
  const nextHand = hand.filter((candidate) => candidate.id !== move.tileId);
  const roundType = getDominoMoveType(state, tile);
  const next = { ...state, [handKey]: nextHand, chain: placeTile(state.chain, tile, move.side), passes: 0, turn: player === "player" ? "computer" : "player" } as DominoGameState;
  if (!nextHand.length) return finishRound(next, player, roundType);
  const other: DominoPlayer = player === "player" ? "computer" : "player";
  if (!next.boneyard.length && !getLegalDominoMoves(next, other).length && !getLegalDominoMoves(next, player).length) {
    const playerTotal = next.hand.reduce((sum, item) => sum + pipTotal(item), 0);
    const computerTotal = next.computerHand.reduce((sum, item) => sum + pipTotal(item), 0);
    const winner = playerTotal === computerTotal ? "draw" : playerTotal < computerTotal ? "player" : "computer";
    return finishRound(next, winner, "trancado");
  }
  return next;
}

export function drawDominoTile(state: DominoGameState, player: DominoPlayer): DominoGameState {
  if (state.roundWinner || state.matchWinner || state.turn !== player) return state;
  if (!state.boneyard.length) {
    const next: DominoGameState = { ...state, passes: state.passes + 1, turn: player === "player" ? "computer" : "player" };
    if (next.passes >= 2 && !getLegalDominoMoves(next, "player").length && !getLegalDominoMoves(next, "computer").length) {
      const playerTotal = next.hand.reduce((sum, item) => sum + pipTotal(item), 0);
      const computerTotal = next.computerHand.reduce((sum, item) => sum + pipTotal(item), 0);
      const winner = playerTotal === computerTotal ? "draw" : playerTotal < computerTotal ? "player" : "computer";
      return finishRound(next, winner, "trancado");
    }
    return next;
  }
  const handKey = player === "player" ? "hand" : "computerHand";
  return { ...state, [handKey]: [...state[handKey], state.boneyard[0]], boneyard: state.boneyard.slice(1), passes: 0 } as DominoGameState;
}

export function chooseComputerDominoMove(state: DominoGameState): DominoMove | null {
  const legal = getLegalDominoMoves(state, "computer");
  return [...legal].sort((left, right) => {
    const leftTile = state.computerHand.find((tile) => tile.id === left.tileId);
    const rightTile = state.computerHand.find((tile) => tile.id === right.tileId);
    return Number(Boolean(rightTile && isDouble(rightTile))) - Number(Boolean(leftTile && isDouble(leftTile))) || (rightTile ? pipTotal(rightTile) : 0) - (leftTile ? pipTotal(leftTile) : 0) || left.side.localeCompare(right.side);
  })[0] ?? null;
}

export function dominoTilePoints(tile: DominoTile): number { return pipTotal(tile); }
export function calculateDominoRoundScore(type: DominoRoundType): number { return DOMINO_SCORING[type]; }
