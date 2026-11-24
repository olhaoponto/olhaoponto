import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle } from "react-native-svg";
import Animated, { SlideInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { AppText, ScreenShell, SurfaceCard, useAppColors } from "@/components/ui";
import { useAppStore } from "@/store/app-store";
import { getLunchGameState } from "@/utils/lunch-game";
import { chooseComputerDominoMove, createDominoRound, drawDominoTile, getDominoEnds, getLegalDominoMoves, playDominoMove, type DominoGameState, type DominoMove, type DominoPlayer, type DominoTile } from "@/utils/domino";

const STORAGE_PREFIX = "olhaponto:";
const STORAGE_SUFFIX = ":lunch-game-domino";
const BOARD_VERSION = 1;
const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  0: [], 1: [[12, 12]], 2: [[7, 7], [17, 17]], 3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]], 5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};

type SavedDomino = { version: number; date: string; state: DominoGameState };
function key(uid: string): string { return `${STORAGE_PREFIX}${uid}${STORAGE_SUFFIX}`; }
function todayKey(date: Date): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function tileLabel(tile: DominoTile): string { return `${tile.a}–${tile.b}`; }

function Pips({ value, size, offset = 0 }: { value: number; size: number; offset?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24">{PIP_POSITIONS[value].map(([cx, cy], index) => <Circle key={`${offset}-${index}`} cx={cx} cy={cy} r={1.8} fill="#173B39" />)}</Svg>;
}

function DominoVisual({ tile, values, compact = false, selected = false, onPress, disabled = false }: { tile: DominoTile; values?: { a: number; b: number }; compact?: boolean; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const display = values ?? { a: tile.a, b: tile.b };
  const pipSize = compact ? 22 : 28;
  const content = <Animated.View entering={SlideInDown.springify()} style={[styles.dominoShadow, compact && styles.dominoCompact, selected && styles.dominoSelected, style]}><View style={[styles.dominoFace, compact && styles.dominoFaceCompact]}><Pips value={display.a} size={pipSize} offset={display.a} /><View style={styles.divider} /><Pips value={display.b} size={pipSize} offset={display.b} /></View></Animated.View>;
  if (!onPress) return content;
  return <Pressable disabled={disabled} onPress={() => { scale.value = withTiming(1.06, { duration: 100 }, () => { scale.value = withTiming(1); }); onPress(); }} accessibilityRole="button" accessibilityLabel={`Peça ${tileLabel(tile)}`} accessibilityState={{ disabled, selected }}>{content}</Pressable>;
}

function Timer({ closesAt, onExpired }: { closesAt: string; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Date.parse(closesAt) - Date.now()));
  const expired = useRef(false);
  useEffect(() => {
    expired.current = false;
    const update = () => { const next = Math.max(0, Date.parse(closesAt) - Date.now()); setRemaining(next); if (!next && !expired.current) { expired.current = true; onExpired(); } };
    update();
    const timer = setInterval(() => { if (AppState.currentState === "active") update(); }, 1000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [closesAt, onExpired]);
  const seconds = Math.ceil(remaining / 1000);
  return <View style={styles.timer}><AppText variant="tiny" color="#BFE9D6">TEMPO DO ALMOÇO</AppText><AppText variant="subtitle" color="#FFF5D8">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</AppText></View>;
}

export default function DominoLunchScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const userId = useAppStore((state) => state.session?.user.id ?? null);
  const entries = useAppStore((state) => state.entries);
  const today = todayKey(new Date());
  const lunchState = useMemo(() => getLunchGameState(entries), [entries]);
  const [state, setState] = useState<DominoGameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [message, setMessage] = useState("Sua vez: escolha uma peça.");
  const [ended, setEnded] = useState(false);
  const persist = useCallback((next: DominoGameState) => { if (userId) void AsyncStorage.setItem(key(userId), JSON.stringify({ version: BOARD_VERSION, date: today, state: next })).catch(() => undefined); }, [today, userId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) { setLoaded(true); return; }
      try {
        const raw = await AsyncStorage.getItem(key(userId));
        const saved = raw ? JSON.parse(raw) as SavedDomino : null;
        if (active) setState(saved?.version === BOARD_VERSION && saved.date === today ? saved.state : createDominoRound(Number(today.replaceAll("-", ""))));
      } catch { if (active) setState(createDominoRound(Number(today.replaceAll("-", "")))); }
      if (active) setLoaded(true);
    };
    void load();
    return () => { active = false; };
  }, [today, userId]);
  useEffect(() => { if (loaded && state) persist(state); }, [loaded, persist, state]);
  const closeGame = useCallback(() => { setEnded(true); }, []);
  useEffect(() => {
    if (!state || state.turn !== "computer" || state.roundWinner || state.matchWinner || ended) return undefined;
    const timeout = setTimeout(() => {
      const move = chooseComputerDominoMove(state);
      const next = move ? playDominoMove(state, "computer", move) : drawDominoTile(state, "computer");
      setState(next); setMessage(move ? "O computador jogou." : next.boneyard.length < state.boneyard.length ? "O computador comprou uma peça." : "O computador passou.");
    }, 720);
    return () => clearTimeout(timeout);
  }, [ended, state]);

  const playerMoves = useMemo(() => state ? getLegalDominoMoves(state, "player") : [], [state]);
  const selectedMoves = useMemo(() => playerMoves.filter((move) => move.tileId === selectedTileId), [playerMoves, selectedTileId]);
  const ends = useMemo(() => state ? getDominoEnds(state) : { left: null, right: null }, [state]);
  const commitMove = useCallback((move: DominoMove) => {
    if (!state) return;
    const next = playDominoMove(state, "player", move);
    if (next === state) return;
    setState(next); setSelectedTileId(null); setMessage(next.roundWinner ? (next.roundWinner === "player" ? "Você venceu a rodada!" : "O computador venceu a rodada.") : "O computador está pensando...");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, [state]);
  const playTile = useCallback((tileId: string) => {
    const moves = playerMoves.filter((move) => move.tileId === tileId);
    if (moves.length === 1) commitMove(moves[0]); else setSelectedTileId(tileId);
  }, [commitMove, playerMoves]);
  const draw = useCallback(() => {
    if (!state || playerMoves.length) return;
    const next = drawDominoTile(state, "player");
    setState(next); setMessage(next.boneyard.length < state.boneyard.length ? "Você comprou uma peça." : "Monte vazio: você passou.");
  }, [playerMoves.length, state]);
  const newRound = useCallback(() => { const scores = state?.matchWinner ? { player: 0, computer: 0 } : (state?.scores ?? { player: 0, computer: 0 }); const next = createDominoRound(Date.now(), scores); setState(next); setEnded(false); setSelectedTileId(null); setMessage(state?.matchWinner ? "Nova partida: escolha uma peça." : "Nova rodada: escolha uma peça."); }, [state?.matchWinner, state?.scores]);

  if (!userId || lunchState.status === "locked") return <ScreenShell contentStyle={styles.centerPage}><SurfaceCard style={styles.lockCard}><AppText style={styles.heroEmoji}>🁣</AppText><AppText variant="title" style={styles.centerText}>Dominó do almoço</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Disponível depois de bater a saída do almoço.</AppText><Pressable onPress={() => router.replace("/jogo-almoco")} style={[styles.primaryButton, { backgroundColor: colors.deepTeal }]}><AppText variant="small" color="#FFFFFF">Voltar aos jogos</AppText></Pressable></SurfaceCard></ScreenShell>;
  if (ended || lunchState.status === "closed") return <ScreenShell contentStyle={styles.centerPage}><SurfaceCard style={styles.lockCard}><AppText style={styles.heroEmoji}>🌿</AppText><AppText variant="title" style={styles.centerText}>Intervalo encerrado</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Intervalo encerrado. Bom retorno!</AppText></SurfaceCard></ScreenShell>;
  if (!loaded || !state) return <ScreenShell contentStyle={styles.centerPage}><AppText>Preparando o dominó...</AppText></ScreenShell>;

  const activePlayer = state.turn === "player" && !state.roundWinner && !state.matchWinner;
  return <ScreenShell scroll={false} contentStyle={styles.page}><View style={styles.felt}>
    <View style={styles.topbar}><Pressable onPress={() => router.replace("/jogo-almoco")} style={styles.back}><AppText style={styles.backText}>‹</AppText></Pressable><View style={{ flex: 1 }}><AppText variant="tiny" color="#BFE9D6" style={styles.eyebrow}>INTERVALO SOLO</AppText><AppText variant="title" color="#FFF5D8">Dominó</AppText></View><Timer closesAt={lunchState.closesAt ?? new Date().toISOString()} onExpired={closeGame} /></View>
    <View style={styles.scoreboard}><View><AppText variant="tiny" color="#BFE9D6">VOCÊ</AppText><AppText variant="title" color="#FFF5D8">{state.scores.player}</AppText></View><AppText style={styles.vs}>×</AppText><View style={{ alignItems: "flex-end" }}><AppText variant="tiny" color="#BFE9D6">COMPUTADOR</AppText><AppText variant="title" color="#F2C648">{state.scores.computer}</AppText></View></View>
    <View style={styles.chainArea}><AppText variant="tiny" color="#BFE9D6">MESA · {state.boneyard.length} no monte</AppText><View style={styles.chain}>{state.chain.length ? state.chain.map((placed) => <DominoVisual key={`${placed.tile.id}-${placed.left}-${placed.right}`} tile={placed.tile} values={{ a: placed.left, b: placed.right }} compact />) : <AppText variant="small" color="#BFE9D6">A mesa está vazia</AppText>}</View><View style={styles.ends}><View style={styles.endPill}><AppText variant="tiny" color="#F2C648">{ends.left === null ? "" : `◀ ${ends.left}`}</AppText></View><View style={styles.endPill}><AppText variant="tiny" color="#F2C648">{ends.right === null ? "" : `${ends.right} ▶`}</AppText></View></View></View>
    <View style={styles.computerHand}><AppText variant="tiny" color="#BFE9D6">MÃO DO COMPUTADOR · {state.computerHand.length}</AppText><View style={styles.backTiles}>{state.computerHand.map((tile) => <View key={tile.id} style={styles.hiddenTile}><AppText style={styles.hiddenMark}>◆</AppText></View>)}</View></View>
    <View style={styles.message}><AppText variant="small" color="#FFF5D8" style={styles.centerText}>{state.matchWinner ? "Partida encerrada!" : state.roundWinner ? `${state.roundWinner === "draw" ? "Rodada empatada" : state.roundWinner === "player" ? "Você venceu" : "Computador venceu"} · +${state.roundPoints} ponto${state.roundPoints === 1 ? "" : "s"}` : message}</AppText></View>
    <View style={styles.handHeader}><AppText variant="tiny" color="#BFE9D6">SUA MÃO · {state.hand.length}</AppText><AppText variant="tiny" color="#BFE9D6">{activePlayer ? "JOGUE UMA PEÇA" : "AGUARDE"}</AppText></View>
    <View style={styles.hand}>{state.hand.map((tile) => <View key={tile.id} style={styles.handItem}><DominoVisual tile={tile} selected={selectedTileId === tile.id} onPress={() => activePlayer && playTile(tile.id)} disabled={!activePlayer || !playerMoves.some((move) => move.tileId === tile.id)} />{selectedTileId === tile.id && selectedMoves.length > 1 ? <View style={styles.sidePicker}>{selectedMoves.map((move) => <Pressable key={move.side} onPress={() => commitMove(move)} style={styles.sideButton}><AppText variant="tiny" color="#FFF5D8">{move.side === "left" ? `← ${ends.left}` : `${ends.right} →`}</AppText></Pressable>)}</View> : null}</View>)}</View>
    <View style={styles.actions}><Pressable onPress={draw} disabled={!activePlayer || playerMoves.length > 0} style={[styles.action, (!activePlayer || playerMoves.length > 0) && styles.disabled]}><AppText variant="small" color="#FFF5D8">Comprar ({state.boneyard.length})</AppText></Pressable><Pressable onPress={newRound} style={styles.action}><AppText variant="small" color="#FFF5D8">{state.matchWinner ? "Nova partida" : "Nova rodada"}</AppText></Pressable><Pressable onPress={() => router.replace("/jogo-almoco")} style={styles.action}><AppText variant="small" color="#FFF5D8">Voltar</AppText></Pressable></View>
  </View></ScreenShell>;
}

const styles = StyleSheet.create({
  page: { padding: 0 }, felt: { flex: 1, backgroundColor: "#103E35", padding: 14, gap: 10 }, topbar: { flexDirection: "row", alignItems: "center", gap: 10 }, eyebrow: { letterSpacing: 1.5, fontWeight: "800" }, back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#6D4029", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#B87942" }, backText: { fontSize: 32, lineHeight: 34, color: "#FFF5D8" }, timer: { alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: "#082B2B", borderWidth: 1, borderColor: "#D8B45A66" }, scoreboard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: "#BFE9D633" }, vs: { color: "#F2C648", fontSize: 24 }, chainArea: { flex: 1, minHeight: 150, padding: 10, borderRadius: 18, backgroundColor: "#082B2B88", borderWidth: 1, borderColor: "#BFE9D633" }, chain: { flexDirection: "row", flexWrap: "wrap", alignContent: "center", alignItems: "center", justifyContent: "center", gap: 5, flex: 1, paddingVertical: 8 }, ends: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, endPill: { minWidth: 56, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "#6D402966", borderWidth: 1, borderColor: "#F2C64899", alignItems: "center" }, computerHand: { minHeight: 42, gap: 4 }, backTiles: { flexDirection: "row", justifyContent: "center", gap: 4 }, hiddenTile: { width: 25, height: 34, borderRadius: 5, backgroundColor: "#6D4029", borderWidth: 1, borderColor: "#B87942", alignItems: "center", justifyContent: "center" }, hiddenMark: { color: "#F2C648", fontSize: 12 }, message: { minHeight: 30, alignItems: "center", justifyContent: "center" }, centerText: { textAlign: "center" }, handHeader: { flexDirection: "row", justifyContent: "space-between" }, hand: { minHeight: 88, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: 6 }, handItem: { alignItems: "center", minHeight: 78 }, dominoShadow: { width: 56, height: 28, padding: 0, borderRadius: 8, backgroundColor: "#1B4B3C", borderRightWidth: 3, borderBottomWidth: 3, borderColor: "#0A2823", shadowColor: "#061A16", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5, position: "relative" }, dominoCompact: { width: 44, height: 22, borderRightWidth: 2, borderBottomWidth: 2, borderRadius: 6 }, dominoSelected: { borderColor: "#F2C648", backgroundColor: "#765032" }, dominoFace: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 6, backgroundColor: "#FBF7EC", borderWidth: 1, borderColor: "#E6D9B8", overflow: "hidden" }, dominoFaceCompact: { borderRadius: 4 }, divider: { position: "absolute", left: "50%", top: "13%", width: 1, height: "74%", backgroundColor: "#D8CBAE" }, sidePicker: { position: "absolute", top: 33, zIndex: 5, flexDirection: "row", gap: 4 }, sideButton: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, backgroundColor: "#765032", borderWidth: 1, borderColor: "#F2C648" }, actions: { flexDirection: "row", justifyContent: "center", gap: 7, paddingTop: 2 }, action: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 13, backgroundColor: "#6D4029", borderWidth: 2, borderColor: "#B87942" }, disabled: { opacity: 0.45 }, centerPage: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "#E4F5F2" }, lockCard: { alignItems: "center", gap: 13, padding: 24 }, heroEmoji: { fontSize: 52, lineHeight: 62 }, primaryButton: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4 },
});
