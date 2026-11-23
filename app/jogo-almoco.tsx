import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  AppText,
  ScreenShell,
  SurfaceCard,
  useAppColors,
} from "@/components/ui";
import { useAppStore } from "@/store/app-store";
import {
  generateLunchGameBoard,
  getLunchGamePairCount,
  getLunchGameState,
  isLunchGamePieceFree,
  type LunchGameDifficulty,
  type LunchGamePiece,
} from "@/utils/lunch-game";

const GAME_KEY_PREFIX = "olhaponto:";
const TILE_WIDTH = 48;
const TILE_HEIGHT = 58;
const COLUMN_STEP = 27;
const ROW_STEP = 61;
const DIFFICULTIES: Array<{
  key: LunchGameDifficulty;
  label: string;
  pieces: number;
}> = [
  { key: "easy", label: "Leve", pieces: 24 },
  { key: "medium", label: "Ritmo", pieces: 36 },
  { key: "hard", label: "Desafio", pieces: 48 },
];

type SavedGame = {
  date: string;
  difficulty: LunchGameDifficulty;
  pieces: LunchGamePiece[];
  removedIds: string[];
  pairsFound: number;
  score: number;
  bestScore: number;
};

function gameKey(userId: string) {
  return `${GAME_KEY_PREFIX}${userId}:lunch-game`;
}
function todayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function makeGame(
  date: string,
  difficulty: LunchGameDifficulty,
  bestScore = 0,
): SavedGame {
  return {
    date,
    difficulty,
    pieces: generateLunchGameBoard(
      difficulty,
      Number(date.replaceAll("-", "")),
    ),
    removedIds: [],
    pairsFound: 0,
    score: 0,
    bestScore,
  };
}
function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

const AnimatedPiece = memo(function AnimatedPiece({
  piece,
  free,
  selected,
  removed,
  reduceMotion,
  onPress,
  index,
}: {
  piece: LunchGamePiece;
  free: boolean;
  selected: boolean;
  removed: boolean;
  reduceMotion: boolean;
  onPress: () => void;
  index: number;
}) {
  const lift = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      lift.value = selected ? -5 : 0;
      glow.value = selected ? 1 : 0;
      return;
    }
    lift.value = withSpring(selected ? -8 : 0, { damping: 14, stiffness: 180 });
    glow.value = withTiming(selected ? 1 : 0, { duration: 160 });
  }, [glow, lift, reduceMotion, selected]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: 1 + glow.value * 0.06 }],
    opacity: removed ? withTiming(0, { duration: reduceMotion ? 0 : 360 }) : 1,
  }));
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.delay(Math.min(420, index * 16)).duration(360)
      }
      layout={reduceMotion ? undefined : Layout.springify()}
      style={[
        styles.tilePosition,
        {
          left: piece.column * COLUMN_STEP + piece.layer * 6,
          top: piece.row * ROW_STEP + piece.layer * 10,
          zIndex: piece.layer * 100 + index,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={!free || removed}
        accessibilityRole="button"
        accessibilityState={{ disabled: !free || removed, selected }}
        accessibilityLabel={`${selected ? "Peça selecionada" : "Peça"} ${piece.icon}`}
        style={[
          styles.tile,
          {
            borderColor: selected ? "#FFFFFF" : `${piece.color}AA`,
            backgroundColor: `${piece.color}E8`,
            shadowColor: selected ? "#FFFFFF" : piece.color,
          },
          !free && !removed ? styles.tileBlocked : undefined,
        ]}
      >
        <View style={styles.tileTop}>
          <MaterialCommunityIcons
            name={piece.icon as never}
            size={25}
            color="#FFFFFF"
          />
          <View style={[styles.tileShine, { backgroundColor: piece.color }]} />
        </View>
        <View style={styles.tileBase}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={11}
            color="#FFFFFFAA"
          />
        </View>
      </Pressable>
    </Animated.View>
  );
});

function BurstParticle({
  index,
  color,
  progress,
}: {
  index: number;
  color: string;
  progress: ReturnType<typeof useSharedValue<number>>;
}) {
  const angle = (Math.PI * 2 * index) / 8;
  const x = Math.cos(angle) * 66;
  const y = Math.sin(angle) * 66;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: progress.value * x },
      { translateY: progress.value * y },
      { scale: 1 - progress.value * 0.5 },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: index % 2 ? color : "#F2C648" },
        style,
      ]}
    />
  );
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
      {Array.from({ length: 8 }, (_, index) => (
        <BurstParticle
          key={index}
          index={index}
          color={color}
          progress={progress}
        />
      ))}
    </View>
  );
}

function ConfettiPiece({
  index,
  progress,
}: {
  index: number;
  progress: ReturnType<typeof useSharedValue<number>>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateY: progress.value * (210 + index * 11) },
      { rotate: `${progress.value * (index % 2 ? 220 : -220)}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          backgroundColor: ["#EF7967", "#F2C648", "#24B3A2", "#6C63FF"][
            index % 4
          ],
          left: `${8 + ((index * 17) % 88)}%`,
        },
        style,
      ]}
    />
  );
}

function VictoryConfetti({ visible }: { visible: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 1300 });
    }
  }, [progress, visible]);
  return visible ? (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 12 }, (_, index) => (
        <ConfettiPiece key={index} index={index} progress={progress} />
      ))}
    </View>
  ) : null;
}

export default function LunchGameScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const userId = useAppStore((state) => state.session?.user.id ?? null);
  const entries = useAppStore((state) => state.entries);
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [game, setGame] = useState<SavedGame | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [message, setMessage] = useState("");
  const [combo, setCombo] = useState(0);
  const [burst, setBurst] = useState(0);
  const [victory, setVictory] = useState(false);
  const [ended, setEnded] = useState(false);
  const shake = useSharedValue(0);
  const today = todayKey(now);
  const lunchState = useMemo(
    () => getLunchGameState(entries, now),
    [entries, now],
  );
  const remaining = useMemo(
    () => new Set(game?.removedIds ?? []),
    [game?.removedIds],
  );
  const activePieces = useMemo(
    () => game?.pieces.filter((piece) => !remaining.has(piece.id)) ?? [],
    [game?.pieces, remaining],
  );
  const freeIds = useMemo(
    () =>
      new Set(
        activePieces
          .filter((piece) => isLunchGamePieceFree(piece, activePieces))
          .map((piece) => piece.id),
      ),
    [activePieces],
  );
  const selectedPiece = selectedId
    ? (game?.pieces.find((piece) => piece.id === selectedId) ?? null)
    : null;
  const boardScale = Math.min(1, Math.max(0.78, (width - 30) / 360));
  const persist = useCallback(
    async (next: SavedGame | null) => {
      if (userId && next)
        await AsyncStorage.setItem(gameKey(userId), JSON.stringify(next)).catch(
          () => undefined,
        );
    },
    [userId],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) {
        setLoaded(true);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(gameKey(userId));
        if (!active) return;
        const saved = raw ? (JSON.parse(raw) as SavedGame) : null;
        if (saved?.date === today && Array.isArray(saved.pieces))
          setGame(saved);
        else setGame(makeGame(today, "medium", saved?.bestScore ?? 0));
      } catch {
        if (active) setGame(makeGame(today, "medium"));
      }
      if (active) setLoaded(true);
    };
    void load();
    return () => {
      active = false;
    };
  }, [today, userId]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (lunchState.status !== "open" || ended) return undefined;
    const update = () => {
      if (AppState.currentState === "active") setNow(new Date());
    };
    update();
    const interval = setInterval(update, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [ended, lunchState.status]);

  useEffect(() => {
    if (!loaded || ended || lunchState.status !== "closed") return undefined;
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    setEnded(true);
    void persist(game).finally(() => {
      if (active) timeout = setTimeout(() => router.replace("/(tabs)"), 1300);
    });
    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [ended, game, loaded, lunchState.status, persist, router]);

  const animateWrong = useCallback(() => {
    if (reduceMotion) return;
    shake.value = 0;
    shake.value = withSequence(
      withTiming(-7, { duration: 45 }),
      withTiming(7, { duration: 45 }),
      withTiming(-5, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [reduceMotion, shake]);

  const chooseDifficulty = useCallback(
    (difficulty: LunchGameDifficulty) => {
      if (!game || game.difficulty === difficulty) return;
      const next = makeGame(today, difficulty, game.bestScore);
      setGame(next);
      setSelectedId(null);
      setMessage("Novo tabuleiro pronto.");
      void persist(next);
    },
    [game, persist, today],
  );

  const restart = useCallback(() => {
    if (!game) return;
    const next = makeGame(today, game.difficulty, game.bestScore);
    setGame(next);
    setSelectedId(null);
    setVictory(false);
    setMessage("Partida reiniciada.");
    void persist(next);
  }, [game, persist, today]);

  const shuffle = useCallback(() => {
    if (!game) return;
    const next = makeGame(today, game.difficulty, game.bestScore);
    setGame(next);
    setSelectedId(null);
    setMessage("Peças embaralhadas.");
    void persist(next);
  }, [game, persist, today]);

  const choosePiece = useCallback(
    (piece: LunchGamePiece) => {
      if (!game || !freeIds.has(piece.id) || remaining.has(piece.id)) return;
      if (!selectedPiece) {
        setSelectedId(piece.id);
        setMessage("Escolha a peça igual.");
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined,
        );
        return;
      }
      if (selectedPiece.id === piece.id) return;
      if (
        selectedPiece.pairId === piece.pairId &&
        freeIds.has(selectedPiece.id)
      ) {
        const removedIds = [
          ...new Set([...game.removedIds, selectedPiece.id, piece.id]),
        ];
        const pairsFound = game.pairsFound + 1;
        const score = game.score + 100 + combo * 20;
        const bestScore = Math.max(game.bestScore, score);
        const next = { ...game, removedIds, pairsFound, score, bestScore };
        setGame(next);
        setSelectedId(null);
        setCombo((value) => value + 1);
        setBurst((value) => value + 1);
        setMessage("Par perfeito!");
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
        if (removedIds.length === game.pieces.length) setVictory(true);
        void persist(next);
      } else {
        setSelectedId(null);
        setCombo(0);
        setMessage("Quase! Tente outro par.");
        animateWrong();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
          () => undefined,
        );
      }
    },
    [animateWrong, combo, freeIds, game, persist, remaining, selectedPiece],
  );

  const boardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boardScale }, { translateX: shake.value }],
  }));
  const canPlay =
    lunchState.status === "open" && loaded && Boolean(game) && !ended;
  const noMoves = canPlay && activePieces.length > 0 && freeIds.size === 0;

  useEffect(() => {
    if (noMoves) shuffle();
  }, [noMoves, shuffle]);

  if (lunchState.status === "locked" || !userId) {
    return (
      <ScreenShell contentStyle={styles.centerPage}>
        <SurfaceCard style={styles.lockCard}>
          <MaterialCommunityIcons
            name="food-off-outline"
            size={52}
            color={colors.coral}
          />
          <AppText variant="title" style={styles.centerText}>
            Mahjong do almoço
          </AppText>
          <AppText
            variant="body"
            color={colors.muted}
            style={styles.centerText}
          >
            Disponível depois de bater a saída do almoço.
          </AppText>
          <Pressable
            onPress={() => router.replace("/(tabs)")}
            style={[styles.primaryButton, { backgroundColor: colors.deepTeal }]}
          >
            <AppText variant="small" color="#FFFFFF" style={styles.buttonText}>
              Voltar para Hoje
            </AppText>
          </Pressable>
        </SurfaceCard>
      </ScreenShell>
    );
  }

  if (ended || lunchState.status === "closed") {
    return (
      <ScreenShell contentStyle={styles.centerPage}>
        <SurfaceCard style={styles.lockCard}>
          <MaterialCommunityIcons
            name="clock-check-outline"
            size={52}
            color={colors.teal}
          />
          <AppText variant="title" style={styles.centerText}>
            Intervalo encerrado
          </AppText>
          <AppText
            variant="body"
            color={colors.muted}
            style={styles.centerText}
          >
            Intervalo encerrado. Bom retorno!
          </AppText>
        </SurfaceCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell scroll={false} contentStyle={styles.page}>
      <View style={styles.background}>
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          viewBox="0 0 400 900"
        >
          <Defs>
            <LinearGradient id="lunch-bg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.deepTeal} />
              <Stop offset="0.52" stopColor="#245B68" />
              <Stop offset="1" stopColor="#6C63FF" />
            </LinearGradient>
          </Defs>
          <Rect width="400" height="900" fill="url(#lunch-bg)" />
        </Svg>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="tiny" color="#D5FFF3" style={styles.eyebrow}>
                INTERVALO SOLO
              </AppText>
              <AppText variant="title" color="#FFFFFF">
                Mahjong do almoço
              </AppText>
              <AppText variant="small" color="#E6FFFA">
                Combine os pares antes do retorno.
              </AppText>
            </View>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              accessibilityRole="button"
              accessibilityLabel="Fechar Mahjong"
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.timerPill}>
            <MaterialCommunityIcons
              name="timer-sand"
              size={19}
              color="#F2C648"
            />
            <AppText variant="subtitle" color="#FFFFFF">
              {formatRemaining(lunchState.remainingMs)}
            </AppText>
            <AppText variant="tiny" color="#D5FFF3" style={{ flex: 1 }}>
              tempo do almoço
            </AppText>
            <AppText variant="tiny" color="#FFFFFF">
              {game?.pairsFound ?? 0}/
              {getLunchGamePairCount(game?.difficulty ?? "medium")} pares
            </AppText>
          </View>
          <View style={styles.difficultyRow}>
            {DIFFICULTIES.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => chooseDifficulty(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: game?.difficulty === item.key }}
                style={[
                  styles.difficultyButton,
                  game?.difficulty === item.key && styles.difficultySelected,
                ]}
              >
                <AppText
                  variant="tiny"
                  color={game?.difficulty === item.key ? "#FFFFFF" : "#D5FFF3"}
                >
                  {item.label} · {item.pieces}
                </AppText>
              </Pressable>
            ))}
          </View>
          <SurfaceCard style={styles.gameCard}>
            <View style={styles.scoreRow}>
              <View>
                <AppText variant="tiny" color={colors.muted}>
                  PONTOS
                </AppText>
                <AppText variant="subtitle" color={colors.deepTeal}>
                  {game?.score ?? 0}
                </AppText>
              </View>
              <View style={styles.scoreCenter}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={24}
                  color={colors.teal}
                />
                <AppText variant="tiny" color={colors.muted}>
                  MASCOTE
                </AppText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <AppText variant="tiny" color={colors.muted}>
                  RECORDE
                </AppText>
                <AppText variant="subtitle" color={colors.coral}>
                  {game?.bestScore ?? 0}
                </AppText>
              </View>
            </View>
            <Animated.View
              style={[
                styles.board,
                {
                  width: 360,
                  height: 430,
                },
                boardStyle,
              ]}
            >
              {game?.pieces.map((piece, index) => (
                <AnimatedPiece
                  key={piece.id}
                  piece={piece}
                  index={index}
                  free={freeIds.has(piece.id)}
                  selected={selectedId === piece.id}
                  removed={remaining.has(piece.id)}
                  reduceMotion={reduceMotion}
                  onPress={() => choosePiece(piece)}
                />
              ))}
              <Burst trigger={burst} color={colors.teal} />
              <VictoryConfetti visible={victory} />
            </Animated.View>
            <View style={styles.feedback}>
              <Animated.View
                entering={reduceMotion ? undefined : FadeInUp.duration(220)}
                key={message}
              >
                <AppText
                  variant="small"
                  color={
                    message === "Quase! Tente outro par."
                      ? colors.coral
                      : colors.deepTeal
                  }
                  style={styles.centerText}
                >
                  {message || "Escolha uma peça livre para começar."}
                </AppText>
              </Animated.View>
              {combo > 1 ? (
                <Animated.Text
                  entering={reduceMotion ? undefined : FadeInUp.duration(260)}
                  style={[styles.combo, { color: colors.coral }]}
                >
                  Combo x{combo}!
                </Animated.Text>
              ) : null}
              {victory ? (
                <AppText
                  variant="subtitle"
                  color={colors.teal}
                  style={styles.centerText}
                >
                  Tabuleiro limpo! Você venceu.
                </AppText>
              ) : null}
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => {
                  const hint = activePieces.find((piece) =>
                    freeIds.has(piece.id),
                  );
                  if (hint) {
                    setSelectedId(hint.id);
                    setMessage("Dica: esta peça está livre.");
                  }
                }}
                style={styles.actionButton}
              >
                <MaterialCommunityIcons
                  name="lightbulb-on-outline"
                  size={18}
                  color={colors.yellow}
                />
                <AppText variant="small" color={colors.deepTeal}>
                  Dica
                </AppText>
              </Pressable>
              <Pressable onPress={shuffle} style={styles.actionButton}>
                <MaterialCommunityIcons
                  name="shuffle-variant"
                  size={18}
                  color={colors.teal}
                />
                <AppText variant="small" color={colors.deepTeal}>
                  Embaralhar
                </AppText>
              </Pressable>
              <Pressable onPress={restart} style={styles.actionButton}>
                <MaterialCommunityIcons
                  name="restart"
                  size={18}
                  color={colors.coral}
                />
                <AppText variant="small" color={colors.deepTeal}>
                  Reiniciar
                </AppText>
              </Pressable>
            </View>
          </SurfaceCard>
          <AppText variant="tiny" color="#E6FFFA" style={styles.ruleText}>
            Uma peça fica livre quando não há outra por cima e pelo menos um
            lado está aberto.
          </AppText>
        </ScrollView>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingVertical: 0 },
  background: { flex: 1, backgroundColor: "#245B68" },
  scrollContent: { padding: 18, gap: 14, paddingBottom: 28 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 8,
  },
  eyebrow: { letterSpacing: 1.7, fontWeight: "800" },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF22",
    borderWidth: 1,
    borderColor: "#FFFFFF40",
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 17,
    backgroundColor: "#071F1D55",
    borderWidth: 1,
    borderColor: "#FFFFFF35",
  },
  difficultyRow: { flexDirection: "row", gap: 7 },
  difficultyButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#FFFFFF42",
    backgroundColor: "#FFFFFF15",
  },
  difficultySelected: { backgroundColor: "#EF7967", borderColor: "#FFFFFFAA" },
  gameCard: {
    padding: 13,
    gap: 12,
    backgroundColor: "#FAF8EFD9",
    borderColor: "#FFFFFF80",
    overflow: "hidden",
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreCenter: { alignItems: "center", gap: 2 },
  board: {
    alignSelf: "center",
    position: "relative",
    transformOrigin: "center",
  },
  tilePosition: {
    position: "absolute",
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 5,
    paddingBottom: 4,
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  tileBlocked: { opacity: 0.72 },
  tileTop: { alignItems: "center", justifyContent: "center", flex: 1 },
  tileShine: {
    position: "absolute",
    width: 19,
    height: 4,
    borderRadius: 2,
    opacity: 0.42,
    top: 1,
    left: -4,
  },
  tileBase: {
    width: 32,
    height: 8,
    borderRadius: 5,
    backgroundColor: "#0B4F5C55",
    alignItems: "center",
    justifyContent: "center",
  },
  feedback: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    position: "relative",
  },
  combo: { fontSize: 18, lineHeight: 23, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 7 },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFFAA",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: "#FFFFFF90",
  },
  ruleText: { textAlign: "center", lineHeight: 17 },
  centerPage: {
    flex: 1,
    justifyContent: "center",
    padding: 22,
    backgroundColor: "#E4F5F2",
  },
  lockCard: { alignItems: "center", gap: 13, padding: 24 },
  centerText: { textAlign: "center" },
  primaryButton: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 4,
  },
  buttonText: { fontWeight: "700" },
  particle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    left: "50%",
    top: "46%",
  },
  confetti: {
    position: "absolute",
    top: -10,
    width: 8,
    height: 14,
    borderRadius: 2,
  },
});
