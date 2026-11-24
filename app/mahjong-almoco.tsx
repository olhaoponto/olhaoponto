import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { AppText, ScreenShell, SurfaceCard, useAppColors } from "@/components/ui";
import { useAppStore } from "@/store/app-store";
import {
  generateLunchGameBoard,
  getLunchGameBoardMetrics,
  getLunchGamePairCount,
  getLunchGameState,
  hasFreeLunchGameMove,
  isLunchGamePieceFree,
  LUNCH_GAME_BOARD_VERSION,
  LUNCH_GAME_TILE_HEIGHT,
  LUNCH_GAME_TILE_WIDTH,
  reshuffleLunchGameEmojis,
  type LunchGameDifficulty,
  type LunchGamePiece,
} from "@/utils/lunch-game";

const GAME_KEY_PREFIX = "olhaponto:";
const DIFFICULTIES: Array<{ key: LunchGameDifficulty; label: string; pieces: number }> = [
  { key: "easy", label: "Leve", pieces: 24 },
  { key: "medium", label: "Ritmo", pieces: 36 },
  { key: "hard", label: "Desafio", pieces: 48 },
];
type SavedGame = {
  boardVersion: number;
  date: string;
  difficulty: LunchGameDifficulty;
  pieces: LunchGamePiece[];
  removedIds: string[];
  pairsFound: number;
  score: number;
  bestScore: number;
  phase: number;
};

function gameKey(userId: string) {
  return `${GAME_KEY_PREFIX}${userId}:lunch-game`;
}
function todayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}
function difficultyForPhase(phase: number): LunchGameDifficulty {
  return phase <= 2 ? "easy" : phase <= 4 ? "medium" : "hard";
}

function makeGame(date: string, difficulty: LunchGameDifficulty, bestScore = 0, seedOffset = 0, phase = 1, initialScore = 0): SavedGame {
  return {
    boardVersion: LUNCH_GAME_BOARD_VERSION,
    date,
    difficulty,
    pieces: generateLunchGameBoard(difficulty, Number(date.replaceAll("-", "")) + seedOffset),
    removedIds: [],
    pairsFound: 0,
    score: initialScore,
    bestScore,
    phase,
  };
}
function nextPhaseGame(current: SavedGame, date: string): SavedGame {
  const phase = (current.phase || 1) + 1;
  const nextScore = current.score + 250;
  return makeGame(date, difficultyForPhase(phase), Math.max(current.bestScore, nextScore), phase * 997, phase, nextScore);
}
function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function TimerPill({ closesAt, pairsLabel, onExpired }: { closesAt: string | null; pairsLabel: string; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, (closesAt ? Date.parse(closesAt) : 0) - Date.now()));
  const expired = useRef(false);
  useEffect(() => {
    expired.current = false;
    const update = () => {
      const next = Math.max(0, (closesAt ? Date.parse(closesAt) : 0) - Date.now());
      setRemaining(next);
      if (!next && !expired.current) {
        expired.current = true;
        onExpired();
      }
    };
    if (!closesAt) return undefined;
    update();
    const interval = setInterval(() => {
      if (AppState.currentState === "active") update();
    }, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [closesAt, onExpired]);
  return <View style={styles.timerPill}><AppText style={styles.timerLabel}>TEMPO DO ALMOÇO</AppText><AppText variant="subtitle" color="#FFF5D8">{formatRemaining(remaining)}</AppText><AppText variant="tiny" color="#BFE9D6" style={styles.pairsLabel}>{pairsLabel}</AppText></View>;
}

const AnimatedPiece = memo(function AnimatedPiece({
  piece,
  free,
  selected,
  reduceMotion,
  onPress,
  pieceId,
  index,
}: {
  piece: LunchGamePiece;
  free: boolean;
  selected: boolean;
  reduceMotion: boolean;
  onPress: (pieceId: string) => void;
  pieceId: string;
  index: number;
}) {
  const lift = useSharedValue(0);
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      lift.value = selected ? -5 : 0;
      scale.value = selected ? 1.06 : 1;
      glow.value = selected ? 1 : 0;
      return;
    }
    lift.value = withSpring(selected ? -8 : 0, { damping: 14, stiffness: 180 });
    scale.value = withSpring(selected ? 1.06 : 1, { damping: 13, stiffness: 190 });
    glow.value = withTiming(selected ? 1 : 0, { duration: 160 });
  }, [glow, lift, reduceMotion, scale, selected]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
    shadowOpacity: 0.18 + glow.value * 0.22,
    shadowRadius: 5 + glow.value * 8,
  }));
  const handlePress = useCallback(() => onPress(pieceId), [onPress, pieceId]);
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(420, index * 16)).duration(360)}
      exiting={reduceMotion ? undefined : FadeOut.duration(260)}
      style={[
        styles.tilePosition,
        {
          left: piece.column * LUNCH_GAME_TILE_WIDTH - piece.layer * 5,
          top: piece.row * LUNCH_GAME_TILE_HEIGHT - piece.layer * 6,
          zIndex: piece.layer * 100 + index,
          shadowColor: selected ? "#F2C648" : "#071E19",
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ disabled: !free, selected }}
        accessibilityLabel={`${selected ? "Peça selecionada" : "Peça"} ${piece.icon}`}
        style={styles.tileHitbox}
      >
        <View style={styles.tileBack} />
        <View style={[styles.tileFace, selected && styles.tileSelected]}>
          <AppText style={styles.tileEmoji}>{piece.icon}</AppText>
          {!free ? <View pointerEvents="none" style={styles.blockedVeil} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
});

function BurstParticle({ index, color, progress }: { index: number; color: string; progress: ReturnType<typeof useSharedValue<number>> }) {
  const angle = (Math.PI * 2 * index) / 8;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: progress.value * Math.cos(angle) * 66 },
      { translateY: progress.value * Math.sin(angle) * 66 },
      { scale: 1 - progress.value * 0.5 },
    ],
  }));
  return <Animated.View style={[styles.particle, { backgroundColor: index % 2 ? color : "#F2C648" }, style]} />;
}
function Burst({ trigger, color }: { trigger: number; color: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 520 });
  }, [progress, trigger]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 8 }, (_, index) => <BurstParticle key={index} index={index} color={color} progress={progress} />)}
    </View>
  );
}
function ConfettiPiece({ index, progress }: { index: number; progress: ReturnType<typeof useSharedValue<number>> }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateY: progress.value * (210 + index * 11) },
      { rotate: `${progress.value * (index % 2 ? 220 : -220)}deg` },
    ],
  }));
  return <Animated.View style={[styles.confetti, { backgroundColor: ["#EF7967", "#F2C648", "#24B3A2", "#6C63FF"][index % 4], left: `${8 + ((index * 17) % 88)}%` }, style]} />;
}
function VictoryConfetti({ visible }: { visible: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 1300 });
    }
  }, [progress, visible]);
  return visible ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>{Array.from({ length: 12 }, (_, index) => <ConfettiPiece key={index} index={index} progress={progress} />)}</View> : null;
}

function ActionButton({ label, symbol, badge, disabled, onPress }: { label: string; symbol: string; badge: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={[styles.actionButton, disabled && styles.actionDisabled]}>
      <View style={styles.actionBadge}><AppText style={styles.actionBadgeText}>{badge}</AppText></View>
      <AppText style={styles.actionSymbol}>{symbol}</AppText>
      <AppText variant="tiny" color="#FFF5D8" style={styles.actionLabel}>{label}</AppText>
    </Pressable>
  );
}

export default function MahjongLunchScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const userId = useAppStore((state) => state.session?.user.id ?? null);
  const entries = useAppStore((state) => state.entries);
  const { width, height } = useWindowDimensions();
  const [game, setGame] = useState<SavedGame | null>(null);
  const [undoStack, setUndoStack] = useState<SavedGame[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [message, setMessage] = useState("");
  const [combo, setCombo] = useState(0);
  const [burst, setBurst] = useState(0);
  const [victory, setVictory] = useState(false);
  const [ended, setEnded] = useState(false);
  const phaseTransition = useSharedValue(0);
  const nextPhaseScheduled = useRef(false);
  const shuffleSeedRef = useRef(0);
  const shake = useSharedValue(0);
  const today = todayKey(new Date());
  const lunchState = useMemo(() => getLunchGameState(entries), [entries]);
  const remaining = useMemo(() => new Set(game?.removedIds ?? []), [game?.removedIds]);
  const activePieces = useMemo(() => game?.pieces.filter((piece) => !remaining.has(piece.id)) ?? [], [game?.pieces, remaining]);
  const freeIds = useMemo(() => new Set(activePieces.filter((piece) => isLunchGamePieceFree(piece, activePieces)).map((piece) => piece.id)), [activePieces]);
  const selectedPiece = selectedId ? (game?.pieces.find((piece) => piece.id === selectedId) ?? null) : null;
  const metrics = useMemo(() => getLunchGameBoardMetrics(game?.difficulty ?? "medium"), [game?.difficulty]);
  const availableBoardHeight = Math.max(1, height - 410);
  const boardScale = Math.min(1, (width - 28) / metrics.width, availableBoardHeight / metrics.height);
  const boardHeight = metrics.height * boardScale + 12;
  const persist = useCallback(async (next: SavedGame | null) => {
    if (userId && next) await AsyncStorage.setItem(gameKey(userId), JSON.stringify(next)).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) { setLoaded(true); return; }
      try {
        const raw = await AsyncStorage.getItem(gameKey(userId));
        if (!active) return;
        const saved = raw ? (JSON.parse(raw) as Partial<SavedGame>) : null;
        if (saved?.boardVersion === LUNCH_GAME_BOARD_VERSION && saved.date === today && Array.isArray(saved.pieces)) {
          const current = { ...(saved as SavedGame), phase: Number(saved.phase) || 1 };
          const next = Array.isArray(saved.removedIds) && saved.pieces.length > 0 && saved.removedIds.length >= saved.pieces.length ? nextPhaseGame(current, today) : current;
          setGame(next);
          if (next !== current) void persist(next);
        } else {
          setGame(makeGame(today, difficultyForPhase(1), 0, 0, 1));
        }
      } catch {
        if (active) setGame(makeGame(today, difficultyForPhase(1), 0, 0, 1));
      }
      if (active) setLoaded(true);
    };
    void load();
    return () => { active = false; };
  }, [persist, today, userId]);

  const startNextPhase = useCallback(() => {
    if (!game) return;
    const next = nextPhaseGame(game, today);
    setGame(next);
    void persist(next);
    setUndoStack([]); setSelectedId(null); setVictory(false); setCombo(0); setMessage("Nova fase pronta!");
    nextPhaseScheduled.current = false;
  }, [game, persist, today]);

  useEffect(() => {
    if (!victory || !game || nextPhaseScheduled.current) return undefined;
    nextPhaseScheduled.current = true;
    phaseTransition.value = 0;
    phaseTransition.value = withDelay(2200, withTiming(1, { duration: 1 }, (finished) => {
      if (finished) runOnJS(startNextPhase)();
    }));
    return () => { cancelAnimation(phaseTransition); nextPhaseScheduled.current = false; };
  }, [game, phaseTransition, startNextPhase, victory]);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!loaded || (!ended && lunchState.status !== "closed")) return undefined;
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    setEnded(true);
    void persist(game).finally(() => { if (active) timeout = setTimeout(() => router.replace("/(tabs)"), 1300); });
    return () => { active = false; if (timeout) clearTimeout(timeout); };
  }, [ended, game, loaded, lunchState.status, persist, router]);

  const animateWrong = useCallback(() => {
    if (reduceMotion) return;
    shake.value = 0;
    shake.value = withSequence(withTiming(-7, { duration: 45 }), withTiming(7, { duration: 45 }), withTiming(-5, { duration: 45 }), withTiming(0, { duration: 45 }));
  }, [reduceMotion, shake]);
  const chooseDifficulty = useCallback((difficulty: LunchGameDifficulty) => {
    if (!game || game.difficulty === difficulty) return;
    const next = { ...makeGame(today, difficulty, game.bestScore, 0, game.phase), phase: game.phase };
    setGame(next); setUndoStack([]); setSelectedId(null); setVictory(false); setMessage("Novo tabuleiro pronto."); void persist(next);
  }, [game, persist, today]);
  const restart = useCallback(() => {
    if (!game) return;
    const next = makeGame(today, game.difficulty, game.bestScore, Date.now(), game.phase);
    setGame(next); setUndoStack([]); setSelectedId(null); setVictory(false); setCombo(0); setMessage("Partida reiniciada."); void persist(next);
  }, [game, persist, today]);
  const shuffle = useCallback(() => {
    if (!game) return;
    shuffleSeedRef.current += 1;
    const next = { ...game, pieces: reshuffleLunchGameEmojis(game.pieces, game.removedIds, Date.now() + shuffleSeedRef.current) };
    setGame(next); setSelectedId(null); setMessage("Peças embaralhadas."); void persist(next);
  }, [game, persist]);
  const autoShuffle = useCallback(() => {
    if (!game) return;
    shuffleSeedRef.current += 1;
    const next = { ...game, pieces: reshuffleLunchGameEmojis(game.pieces, game.removedIds, Date.now() + shuffleSeedRef.current) };
    setGame(next); setSelectedId(null); setMessage("Sem jogadas: embaralhei para você"); void persist(next);
  }, [game, persist]);
  const undo = useCallback(() => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setGame(previous); setUndoStack((stack) => stack.slice(0, -1)); setSelectedId(null); setVictory(false); setCombo(0); setMessage("Último par desfeito."); void persist(previous);
  }, [persist, undoStack]);
  const choosePiece = useCallback((piece: LunchGamePiece) => {
    if (!game || !freeIds.has(piece.id) || remaining.has(piece.id)) return;
    if (!selectedPiece) {
      setSelectedId(piece.id); setMessage("Escolha a peça igual.");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      return;
    }
    if (selectedPiece.id === piece.id) return;
    if (selectedPiece.icon === piece.icon && freeIds.has(selectedPiece.id)) {
      const removedIds = [...new Set([...game.removedIds, selectedPiece.id, piece.id])];
      const pairsFound = game.pairsFound + 1;
      const score = game.score + 100 + combo * 20;
      const next = { ...game, removedIds, pairsFound, score, bestScore: Math.max(game.bestScore, score) };
      setUndoStack((stack) => [...stack, game]); setGame(next); setSelectedId(null); setCombo((value) => value + 1); setBurst((value) => value + 1); setMessage("Par perfeito!");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (removedIds.length === game.pieces.length) setVictory(true);
      void persist(next);
    } else {
      setSelectedId(null); setCombo(0); setMessage("Quase! Tente outro par."); animateWrong();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
  }, [animateWrong, combo, freeIds, game, persist, remaining, selectedPiece]);
  const handlePiecePress = useCallback((pieceId: string) => {
    const piece = game?.pieces.find((candidate) => candidate.id === pieceId);
    if (piece) choosePiece(piece);
  }, [choosePiece, game?.pieces]);
  const handleTimerExpired = useCallback(() => setEnded(true), []);
  const boardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: boardScale }] }));
  const canPlay = lunchState.status === "open" && loaded && Boolean(game) && !ended;
  const noMoves = canPlay && activePieces.length > 0 && !hasFreeLunchGameMove(activePieces);
  useEffect(() => { if (noMoves) autoShuffle(); }, [autoShuffle, noMoves]);

  if (lunchState.status === "locked" || !userId) {
    return <ScreenShell contentStyle={styles.centerPage}><SurfaceCard style={styles.lockCard}><AppText style={styles.lockEmoji}>🍱</AppText><AppText variant="title" style={styles.centerText}>Mahjong do almoço</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Disponível depois de bater a saída do almoço.</AppText><Pressable onPress={() => router.replace("/(tabs)")} style={[styles.primaryButton, { backgroundColor: colors.deepTeal }]}><AppText variant="small" color="#FFFFFF" style={styles.buttonText}>Voltar para Hoje</AppText></Pressable></SurfaceCard></ScreenShell>;
  }
  if (ended || lunchState.status === "closed") {
    return <ScreenShell contentStyle={styles.centerPage}><SurfaceCard style={styles.lockCard}><AppText style={styles.lockEmoji}>🌿</AppText><AppText variant="title" style={styles.centerText}>Intervalo encerrado</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Intervalo encerrado. Bom retorno!</AppText></SurfaceCard></ScreenShell>;
  }
  return (
    <ScreenShell scroll={false} contentStyle={styles.page}>
      <View style={styles.background}>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 400 900">
          <Defs><LinearGradient id="lunch-felt" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#0C4B3B" /><Stop offset="0.55" stopColor="#103E35" /><Stop offset="1" stopColor="#082B2B" /></LinearGradient></Defs>
          <Rect width="400" height="900" fill="url(#lunch-felt)" />
        </Svg>
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.headerCopy}><AppText variant="tiny" color="#BFE9D6" style={styles.eyebrow}>INTERVALO SOLO · FASE {game?.phase ?? 1}</AppText><AppText variant="title" color="#FFF5D8">Mahjong do almoço</AppText><AppText variant="small" color="#CDEBDD">Combine os pares antes do retorno.</AppText></View>
            <Pressable onPress={() => router.replace("/jogo-almoco")} accessibilityRole="button" accessibilityLabel="Voltar aos jogos" style={styles.closeButton}><AppText style={styles.closeText}>×</AppText></Pressable>
          </View>
          <TimerPill closesAt={lunchState.closesAt} pairsLabel={`${game?.pairsFound ?? 0}/${getLunchGamePairCount(game?.difficulty ?? "medium")} pares`} onExpired={handleTimerExpired} />
          <View style={styles.difficultyRow}>{DIFFICULTIES.map((item) => <Pressable key={item.key} onPress={() => chooseDifficulty(item.key)} accessibilityRole="button" accessibilityState={{ selected: game?.difficulty === item.key }} style={[styles.difficultyButton, game?.difficulty === item.key && styles.difficultySelected]}><AppText variant="tiny" color={game?.difficulty === item.key ? "#FFF5D8" : "#BFE9D6"}>{item.label} · {item.pieces}</AppText></Pressable>)}</View>
          <View style={styles.scoreRow}><View><AppText variant="tiny" color="#BFE9D6">PONTOS</AppText><AppText variant="subtitle" color="#FFF5D8">{game?.score ?? 0}</AppText></View><AppText style={styles.feltMark}>✦</AppText><View style={styles.scoreRight}><AppText variant="tiny" color="#BFE9D6">RECORDE</AppText><AppText variant="subtitle" color="#F2C648">{game?.bestScore ?? 0}</AppText></View></View>
          <View style={[styles.boardViewport, { width: Math.min(width - 28, metrics.width), height: boardHeight }]}>
            <Animated.View style={[styles.boardCanvas, { width: metrics.width, height: metrics.height }, boardStyle]}>
              {activePieces.map((piece, index) => <AnimatedPiece key={piece.id} piece={piece} pieceId={piece.id} index={index} free={freeIds.has(piece.id)} selected={selectedId === piece.id} reduceMotion={reduceMotion} onPress={handlePiecePress} />)}
              <Burst trigger={burst} color="#D8B45A" /><VictoryConfetti visible={victory} />
            </Animated.View>
          </View>
          <View style={styles.feedback}><Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(220)} key={message}><AppText variant="small" color={message === "Quase! Tente outro par." ? "#FFAE87" : "#FFF5D8"} style={styles.centerText}>{message || "Escolha uma peça livre para começar."}</AppText></Animated.View>{combo > 1 ? <Animated.Text entering={reduceMotion ? undefined : FadeInUp.duration(260)} style={styles.combo}>Combo x{combo}!</Animated.Text> : null}{victory ? <Animated.View entering={reduceMotion ? undefined : FadeInUp.springify()} style={styles.phaseCard}><AppText variant="title" color="#F2C648" style={styles.centerText}>Fase {game?.phase ?? 1} concluída!</AppText><AppText variant="small" color="#FFF5D8" style={styles.centerText}>Bônus de fase: +250 pontos</AppText></Animated.View> : null}</View>
          <View style={styles.actionRow}><ActionButton label="Embaralhar" symbol="↝" badge="∞" onPress={shuffle} /><ActionButton label="Dica" symbol="?" badge="∞" onPress={() => { const hint = activePieces.find((piece) => freeIds.has(piece.id)); if (hint) { setSelectedId(hint.id); setMessage("Dica: esta peça está livre."); } }} /><ActionButton label="Desfazer" symbol="↶" badge={String(undoStack.length)} disabled={!undoStack.length} onPress={undo} /></View>
          <Pressable onPress={restart} style={styles.restartButton}><AppText variant="tiny" color="#BFE9D6">Reiniciar partida</AppText></Pressable>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingVertical: 0 },
  background: { flex: 1, backgroundColor: "#103E35" },
  scrollContent: { padding: 14, gap: 12, paddingBottom: 26 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 6 },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { letterSpacing: 1.7, fontWeight: "800" },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#5A3525", borderWidth: 2, borderColor: "#B87942" },
  closeText: { fontSize: 29, lineHeight: 31, color: "#FFF5D8", fontWeight: "300" },
  timerPill: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: "#082B2BDD", borderWidth: 1, borderColor: "#D8B45A66" },
  timerLabel: { color: "#BFE9D6", fontSize: 10, fontWeight: "800", letterSpacing: 1, flex: 1 },
  pairsLabel: { textAlign: "right" },
  difficultyRow: { flexDirection: "row", gap: 7 },
  difficultyButton: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: "#BFE9D655", backgroundColor: "#0B332B" },
  difficultySelected: { backgroundColor: "#765032", borderColor: "#D8B45A" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 },
  scoreRight: { alignItems: "flex-end" },
  feltMark: { color: "#D8B45A", fontSize: 24 },
  boardViewport: { alignSelf: "center", alignItems: "center", justifyContent: "flex-start", overflow: "visible" },
  boardCanvas: { position: "relative", alignSelf: "center", transformOrigin: "center top" },
  tilePosition: { position: "absolute", width: LUNCH_GAME_TILE_WIDTH, height: LUNCH_GAME_TILE_HEIGHT, shadowOffset: { width: 0, height: 5 }, shadowRadius: 5, elevation: 6 },
  tileHitbox: { width: LUNCH_GAME_TILE_WIDTH + 7, height: LUNCH_GAME_TILE_HEIGHT + 7, position: "relative" },
  tileBack: { position: "absolute", left: 5, top: 6, width: LUNCH_GAME_TILE_WIDTH, height: LUNCH_GAME_TILE_HEIGHT, borderRadius: 10, backgroundColor: "#1B4B3C", borderRightWidth: 2, borderBottomWidth: 2, borderColor: "#0A2823" },
  tileFace: { width: LUNCH_GAME_TILE_WIDTH, height: LUNCH_GAME_TILE_HEIGHT, borderRadius: 10, backgroundColor: "#FBF7EC", borderWidth: 2, borderColor: "#E6D9B8", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tileSelected: { borderColor: "#F2C648", borderWidth: 3, shadowColor: "#F2C648", shadowOpacity: 0.65, shadowRadius: 9, elevation: 10 },
  tileEmoji: { fontSize: 34, lineHeight: 40, textAlign: "center" },
  blockedVeil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.2)" },
  feedback: { minHeight: 48, alignItems: "center", justifyContent: "center", gap: 2 },
  phaseCard: { alignItems: "center", gap: 3, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: "#765032", borderWidth: 2, borderColor: "#F2C648", transform: [{ scale: 1.03 }] },
  centerText: { textAlign: "center" },
  combo: { fontSize: 18, lineHeight: 23, fontWeight: "800", color: "#F2C648" },
  actionRow: { flexDirection: "row", justifyContent: "center", gap: 12, paddingTop: 2 },
  actionButton: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#6D4029", borderWidth: 3, borderColor: "#B87942", alignItems: "center", justifyContent: "center", shadowColor: "#061A16", shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  actionDisabled: { backgroundColor: "#49352B", borderColor: "#80634A" },
  actionSymbol: { color: "#FFF5D8", fontSize: 30, lineHeight: 34, fontWeight: "700" },
  actionLabel: { fontWeight: "800", textAlign: "center" },
  actionBadge: { position: "absolute", right: -3, top: -5, minWidth: 25, height: 25, paddingHorizontal: 5, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#C85B43", borderWidth: 2, borderColor: "#F2C648" },
  actionBadgeText: { color: "#FFF5D8", fontSize: 12, fontWeight: "900" },
  restartButton: { alignSelf: "center", paddingHorizontal: 12, paddingVertical: 3 },
  centerPage: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "#E4F5F2" },
  lockCard: { alignItems: "center", gap: 13, padding: 24 },
  lockEmoji: { fontSize: 48, lineHeight: 56 },
  primaryButton: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4 },
  buttonText: { fontWeight: "700" },
  particle: { position: "absolute", width: 8, height: 8, borderRadius: 4, left: "50%", top: "46%" },
  confetti: { position: "absolute", top: -10, width: 8, height: 14, borderRadius: 2 },
});
