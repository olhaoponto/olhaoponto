import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { AppState, Image, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, { SlideInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { AppText, ScreenShell, useAppColors } from "@/components/ui";
import { UserAvatar } from "@/components/UserAvatar";
import { useAppStore } from "@/store/app-store";
import { getAvatar } from "@/utils/avatar-catalog";
import { getLunchGameState } from "@/utils/lunch-game";
import { layoutCorrente } from "@/utils/domino-layout";
import {
  criarConfronto,
  iniciarMao,
  jogar,
  jogadaBot,
  jogadasLegais,
  passar,
  pontas,
  resolverMao,
  type Confronto,
  type EstadoMao,
  type Jogada,
  type Jogador,
  type Lado,
  type Pedra,
} from "@/utils/domino-torneio";

const STORAGE_PREFIX = "olhaponto:";
const STORAGE_SUFFIX = ":lunch-game-domino";
const STORAGE_VERSION = 2;
const STONE_SIDE = 44;
const PLAYER_NAMES: Record<Jogador, string> = { 0: "Você", 1: "Marina", 2: "Rui", 3: "Zeca" };
const BOT_AVATARS: Record<Exclude<Jogador, 0>, string> = { 1: "av-01", 2: "av-08", 3: "av-04" };
const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  0: [], 1: [[12, 12]], 2: [[7, 7], [17, 17]], 3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]], 5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};

type SavedDomino = { version: number; date: string; state: EstadoMao };

function storageKey(uid: string): string { return `${STORAGE_PREFIX}${uid}${STORAGE_SUFFIX}`; }
function todayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function seedFor(date: string): number { return Number(date.replaceAll("-", "")) || 1; }
function tileLabel(pedra: Pedra): string { return `${pedra.a}–${pedra.b}`; }
function jogadorNome(jogador: Jogador | null): string { return jogador === null ? "" : PLAYER_NAMES[jogador]; }

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function resultadoLabel(estado: EstadoMao): string {
  const resultado = estado.resultado;
  if (!resultado) return "";
  if (resultado.motivo === "anulada") return "Jogo anulado: a próxima mão vale 5 pontos.";
  if (resultado.motivo === "buchada") return `Buchada: ${jogadorNome(resultado.jogador)} fechou com uma dupla.`;
  if (resultado.motivo === "lasquine-preso") return `Lasquinê preso: ${jogadorNome(resultado.jogador)} ganhou uma peça.`;
  if (resultado.motivo === "fechado-proposito") return `Fechado de propósito: a dupla ${resultado.vencedor ?? "vencedora"} ganhou uma peça.`;
  if (resultado.motivo === "fechado-ponta") return `Fechado por ponta: a dupla ${resultado.vencedor ?? "vencedora"} levou a mão.`;
  return resultado.jogador === null ? "Batida." : `Batida: ${jogadorNome(resultado.jogador)} encerrou a mão.`;
}

function openingLabel(estado: EstadoMao): string {
  if (estado.aberturaPorBucha) return "Abre com a bucha 1/1";
  return `Abre ${jogadorNome(estado.vez)}`;
}

function PipHalf({ value, side }: { value: number; side: number }) {
  const scale = side / 24;
  return <Svg width={side} height={side} viewBox="0 0 24 24">
    {PIP_POSITIONS[value].map(([cx, cy], index) => <Circle key={`${value}-${index}`} cx={cx} cy={cy} r={Math.max(1.35, 1.8 * scale)} fill="#173B39" />)}
  </Svg>;
}

const DominoStone = memo(function DominoStone({
  pedra,
  values,
  compact = false,
  vertical = false,
  dimmed = false,
  highlighted = false,
  animate = false,
  onPress,
  accessibilityLabel,
}: {
  pedra: Pedra;
  values?: { esquerda: number; direita: number };
  compact?: boolean;
  vertical?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  animate?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const pulse = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const side = compact ? 22 : 28;
  const display = values ?? { esquerda: pedra.a, direita: pedra.b };
  const content = <Animated.View entering={animate ? SlideInDown.springify() : undefined} style={[styles.stone, compact && styles.compactStone, vertical && styles.verticalStone, dimmed && styles.dimmedStone, highlighted && styles.highlightedStone, animatedStyle]}>
    <View style={[styles.stoneFace, compact && styles.compactFace, vertical && styles.verticalFace]}>
      <PipHalf value={display.esquerda} side={side} />
      <View style={[styles.stoneDivider, vertical && styles.verticalDivider]} />
      <PipHalf value={display.direita} side={side} />
    </View>
  </Animated.View>;
  if (!onPress) return content;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `Peça ${tileLabel(pedra)}`} onPress={() => {
    pulse.value = withSequence(withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 150 }));
    onPress();
  }}>{content}</Pressable>;
});

function TimerPill({ closesAt, onExpired }: { closesAt: string | null; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, (closesAt ? Date.parse(closesAt) : 0) - Date.now()));
  const expired = useRef(false);
  useEffect(() => {
    if (!closesAt) return undefined;
    expired.current = false;
    const update = () => {
      const next = Math.max(0, Date.parse(closesAt) - Date.now());
      setRemaining(next);
      if (!next && !expired.current) { expired.current = true; onExpired(); }
    };
    update();
    const interval = setInterval(() => { if (AppState.currentState === "active") update(); }, 1000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") update(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [closesAt, onExpired]);
  return <View style={styles.timerPill}><AppText variant="tiny" color="#BFE9D6">TEMPO DO ALMOÇO</AppText><AppText variant="subtitle" color="#FFF5D8">{formatRemaining(remaining)}</AppText></View>;
}

function ScoreCard({ label, confronto, dupla, accent }: { label: string; confronto: Confronto; dupla: "A" | "B"; accent: string }) {
  const pontos = confronto.pontos[dupla];
  return <View style={[styles.scoreCard, { borderColor: `${accent}99` }]}>
    <View style={styles.scoreHeading}><AppText variant="tiny" color="#D9F2E5" style={styles.scoreLabel}>{label}</AppText><AppText variant="title" color="#FFF5D8">{pontos}</AppText></View>
    <View style={styles.steps}>{[0, 3, 5].map((step) => <View key={step} style={[styles.step, pontos >= step && styles.stepOn, { backgroundColor: pontos >= step ? accent : "#FFFFFF20" }]} />)}</View>
    <View style={styles.pieceDots}><AppText variant="tiny" color="#CDEBDD">PEÇAS</AppText>{[0, 1].map((index) => <View key={index} style={[styles.pieceDot, index < confronto.pecas[dupla] && { backgroundColor: accent, borderColor: accent }]} />)}</View>
  </View>;
}

function AvatarSeat({ jogador, estado, active, accent, positionStyle }: { jogador: Exclude<Jogador, 0>; estado: EstadoMao; active: boolean; accent: string; positionStyle: object }) {
  const avatar = getAvatar(BOT_AVATARS[jogador]);
  return <View style={[styles.seat, positionStyle, active && styles.activeSeat]}>
    <View style={[styles.seatAvatar, { borderColor: accent }]}>{avatar ? <Image source={avatar.source} resizeMode="cover" style={styles.seatImage} /> : null}</View>
    <AppText variant="tiny" color="#FFF5D8" style={styles.seatName}>{PLAYER_NAMES[jogador]}</AppText>
    <View style={styles.miniStones}>{Array.from({ length: estado.maos[jogador].length }, (_, index) => <View key={index} style={styles.miniStone} />)}</View>
  </View>;
}

function YourSeat({ estado }: { estado: EstadoMao }) {
  return <View style={[styles.yourSeat, estado.vez === 0 && styles.activeSeat]}>
    <View style={styles.yourAvatar}><UserAvatar size={48} /></View>
    <AppText variant="tiny" color="#173B39" style={styles.seatName}>Você</AppText>
  </View>;
}

function GradientFelt({ children }: { children: React.ReactNode }) {
  return <View style={styles.feltWrap}><Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none"><Defs><LinearGradient id="feltGradient" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2C8A5B" /><Stop offset="1" stopColor="#16553A" /></LinearGradient></Defs><Path d="M0 0 H1000 V1000 H0 Z" fill="url(#feltGradient)" /></Svg>{children}</View>;
}

export default function DominoLunchScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { width } = useWindowDimensions();
  const userId = useAppStore((state) => state.session?.user.id ?? null);
  const entries = useAppStore((state) => state.entries);
  const today = todayKey(new Date());
  const lunchState = useMemo(() => getLunchGameState(entries), [entries]);
  const [estado, setEstado] = useState<EstadoMao | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [lastPlacedId, setLastPlacedId] = useState<string | null>(null);

  const persist = useCallback((next: EstadoMao) => {
    if (userId) void AsyncStorage.setItem(storageKey(userId), JSON.stringify({ version: STORAGE_VERSION, date: today, state: next })).catch(() => undefined);
  }, [today, userId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) { setLoaded(true); return; }
      const fresh = () => iniciarMao(criarConfronto(seedFor(today)));
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        const saved = raw ? JSON.parse(raw) as SavedDomino : null;
        const next = saved?.version === STORAGE_VERSION && saved.date === today && saved.state?.maos ? saved.state : fresh();
        if (active) setEstado(next);
      } catch { if (active) setEstado(fresh()); }
      if (active) setLoaded(true);
    };
    void load();
    return () => { active = false; };
  }, [today, userId]);

  useEffect(() => { if (loaded && estado) persist(estado); }, [estado, loaded, persist]);

  const currentPlayer = estado?.vez ?? 0;
  useEffect(() => {
    if (!estado || estado.resolvida || estado.confronto.vencedor || currentPlayer === 0 || expired || lunchState.status !== "open") return undefined;
    const timeout = setTimeout(() => {
      const bot = estado.vez;
      const move = jogadaBot(estado, bot);
      let next = move ? jogar(estado, bot, move) : passar(estado, bot);
      if (next.fechado && !next.resolvida) next = resolverMao(next);
      setLastPlacedId(move?.pedraId ?? null);
      setEstado(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timeout);
  }, [currentPlayer, estado, expired, lunchState.status]);

  const legalMoves = useMemo(() => estado && currentPlayer === 0 ? jogadasLegais(estado, 0) : [], [currentPlayer, estado]);
  const ends = useMemo(() => estado ? pontas(estado) : { esquerda: null, direita: null }, [estado]);
  const layoutWidth = Math.max(88, width - 206);
  const chainLayout = useMemo(() => layoutCorrente(estado?.mesa.length ?? 0, layoutWidth, STONE_SIDE), [estado?.mesa.length, layoutWidth]);
  const chainHeight = Math.max(78, (chainLayout.at(-1)?.y ?? 0) + STONE_SIDE + 12);
  const legalAtEnd = useMemo(() => ({
    esquerda: legalMoves.some((move) => move.lado === "esquerda"),
    direita: legalMoves.some((move) => move.lado === "direita"),
  }), [legalMoves]);

  const applyMove = useCallback((move: Jogada) => {
    if (!estado || estado.resolvida || estado.vez !== 0) return;
    const next = jogar(estado, 0, move);
    if (next === estado) return;
    setEstado(next);
    setSelectedTileId(null);
    setLastPlacedId(move.pedraId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, [estado]);

  const chooseTile = useCallback((pedraId: string) => {
    const moves = legalMoves.filter((move) => move.pedraId === pedraId);
    if (moves.length === 1) applyMove(moves[0]);
    else if (moves.length > 1) setSelectedTileId((current) => current === pedraId ? null : pedraId);
  }, [applyMove, legalMoves]);

  const pass = useCallback(() => {
    if (!estado || estado.vez !== 0 || legalMoves.length > 0 || estado.resolvida) return;
    let next = passar(estado, 0);
    if (next.fechado && !next.resolvida) next = resolverMao(next);
    setEstado(next);
  }, [estado, legalMoves.length]);

  const nextHand = useCallback(() => {
    if (!estado || estado.confronto.vencedor) return;
    setEstado(iniciarMao(estado.confronto));
    setSelectedTileId(null);
    setLastPlacedId(null);
  }, [estado]);

  const newMatch = useCallback(() => {
    setEstado(iniciarMao(criarConfronto(Date.now())));
    setSelectedTileId(null);
    setLastPlacedId(null);
    setExpired(false);
  }, []);

  if (!userId || lunchState.status === "locked") return <ScreenShell contentStyle={styles.centerPage}><AppText style={styles.heroEmoji}>🁣</AppText><AppText variant="title" style={styles.centerText}>Dominó do almoço</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Disponível depois de bater a saída do almoço.</AppText><Pressable onPress={() => router.replace("/jogo-almoco")} style={styles.primaryButton}><AppText variant="small" color="#FFFFFF">Voltar aos jogos</AppText></Pressable></ScreenShell>;
  if (expired || lunchState.status === "closed") return <ScreenShell contentStyle={styles.centerPage}><AppText style={styles.heroEmoji}>🌿</AppText><AppText variant="title" style={styles.centerText}>Intervalo encerrado</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Intervalo encerrado. Bom retorno!</AppText></ScreenShell>;
  if (!loaded || !estado) return <ScreenShell contentStyle={styles.centerPage}><AppText>Preparando o dominó...</AppText></ScreenShell>;

  const humanTurn = estado.vez === 0 && !estado.resolvida && !estado.confronto.vencedor;
  const selectedMoves = selectedTileId ? legalMoves.filter((move) => move.pedraId === selectedTileId) : [];
  const winnerName = estado.confronto.vencedor ? (estado.confronto.vencedor === "A" ? "Nós vencemos!" : "Eles venceram!") : null;
  const statusText = estado.resolvida ? resultadoLabel(estado) : humanTurn ? `Sua vez · ${legalMoves.length} jogada${legalMoves.length === 1 ? "" : "s"}` : `Vez de ${jogadorNome(estado.vez)}`;

  return <ScreenShell scroll={false} contentStyle={styles.page}>
    <View style={styles.screen}>
      <View style={styles.header}><Pressable onPress={() => router.replace("/jogo-almoco")} style={styles.back}><AppText style={styles.backText}>‹</AppText></Pressable><View style={styles.titleBlock}><AppText variant="tiny" color="#BFE9D6" style={styles.eyebrow}>DOMINÓ 2 × 2</AppText><AppText variant="title" color="#FFF5D8">Mesa do almoço</AppText></View><TimerPill closesAt={lunchState.closesAt} onExpired={() => setExpired(true)} /></View>
      <View style={styles.scoreRow}><ScoreCard label="NÓS" confronto={estado.confronto} dupla="A" accent="#E7B84B" /><ScoreCard label="ELES" confronto={estado.confronto} dupla="B" accent="#F08A5D" /></View>
      <GradientFelt>
        <AvatarSeat jogador={2} estado={estado} active={estado.vez === 2} accent="#E7B84B" positionStyle={styles.topSeat} />
        <AvatarSeat jogador={1} estado={estado} active={estado.vez === 1} accent="#F08A5D" positionStyle={styles.leftSeat} />
        <AvatarSeat jogador={3} estado={estado} active={estado.vez === 3} accent="#F08A5D" positionStyle={styles.rightSeat} />
        {estado.mesa.length === 0 ? <View style={styles.opening}><AppText variant="tiny" color="#D9F2E5">{openingLabel(estado)}</AppText></View> : null}
        <View style={styles.chainViewport}>
          {estado.mesa.length ? <View style={{ height: chainHeight, width: layoutWidth, position: "relative" }}>{estado.mesa.map((placed, index) => {
            const position = chainLayout[index];
            return <View key={`${placed.pedra.id}-${index}`} style={{ position: "absolute", left: position.x, top: position.y }}><DominoStone pedra={placed.pedra} values={{ esquerda: placed.esquerda, direita: placed.direita }} compact vertical={position.vertical && placed.pedra.a !== placed.pedra.b} animate={placed.pedra.id === lastPlacedId} /></View>;
          })}</View> : <AppText variant="small" color="#D9F2E5">A primeira pedra abre a mesa.</AppText>}
        </View>
        <View style={styles.endsRow}><View style={[styles.endHighlight, legalAtEnd.esquerda && styles.endHighlightOn]}><AppText variant="subtitle" color="#FFF5D8">{ends.esquerda ?? "·"}</AppText><AppText variant="tiny" color="#D9F2E5">PONTA</AppText></View><View style={[styles.endHighlight, legalAtEnd.direita && styles.endHighlightOn]}><AppText variant="subtitle" color="#FFF5D8">{ends.direita ?? "·"}</AppText><AppText variant="tiny" color="#D9F2E5">PONTA</AppText></View></View>
      </GradientFelt>
      <View style={styles.statusRow}><AppText variant="small" color={estado.resolvida ? "#B87333" : "#0B6A63"} style={styles.statusText}>{winnerName ?? statusText}</AppText><View style={styles.inviteChip}><AppText variant="tiny" color="#7C6B59">Convidar colega · em breve</AppText></View></View>
      {estado.resolvida ? <View style={styles.resultCard}><AppText variant="subtitle" color="#173B39">{resultadoLabel(estado)}</AppText>{estado.confronto.vencedor ? <AppText variant="body" color="#0B6A63">{winnerName}</AppText> : null}<Pressable onPress={estado.confronto.vencedor ? newMatch : nextHand} style={styles.primaryButton}><AppText variant="small" color="#FFFFFF">{estado.confronto.vencedor ? "Nova partida" : "Próxima mão"}</AppText></Pressable></View> : null}
      <YourSeat estado={estado} />
      <View style={styles.handHeader}><AppText variant="tiny" color="#0B6A63">SUA MÃO · {estado.maos[0].length}</AppText><AppText variant="tiny" color="#6C7F78">{humanTurn ? "TOQUE NA PONTA PARA JOGAR" : "AGUARDE"}</AppText></View>
      <View style={styles.hand}>{estado.maos[0].map((pedra) => { const moves = legalMoves.filter((move) => move.pedraId === pedra.id); const highlighted = moves.length > 0; return <View key={pedra.id} style={styles.handItem}><DominoStone pedra={pedra} highlighted={highlighted} dimmed={!highlighted} animate={pedra.id === lastPlacedId} onPress={() => chooseTile(pedra.id)} />{selectedTileId === pedra.id && selectedMoves.length > 1 ? <View style={styles.sidePicker}>{selectedMoves.map((move) => <Pressable key={move.lado} onPress={() => applyMove(move)} style={styles.sideButton}><AppText variant="tiny" color="#FFF5D8">{move.lado === "esquerda" ? `← ${ends.esquerda}` : `${ends.direita} →`}</AppText></Pressable>)}</View> : null}</View>; })}</View>
      <Pressable disabled={!humanTurn || legalMoves.length > 0} onPress={pass} style={[styles.passButton, (!humanTurn || legalMoves.length > 0) && styles.disabled]}><AppText variant="small" color="#FFF5D8">Passar</AppText></Pressable>
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  page: { padding: 0, backgroundColor: "#EAF5EE" },
  screen: { flex: 1, padding: 12, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#6D4029", alignItems: "center", justifyContent: "center" },
  backText: { color: "#FFF5D8", fontSize: 30, lineHeight: 32 }, titleBlock: { flex: 1 }, eyebrow: { letterSpacing: 1.4, fontWeight: "800" },
  timerPill: { alignItems: "flex-end", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 13, backgroundColor: "#173B39" },
  scoreRow: { flexDirection: "row", gap: 8 }, scoreCard: { flex: 1, padding: 8, borderRadius: 14, backgroundColor: "#16553A", borderWidth: 1.5 },
  scoreHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, scoreLabel: { fontWeight: "800", letterSpacing: 1 },
  steps: { flexDirection: "row", gap: 3, marginTop: 3 }, step: { flex: 1, height: 5, borderRadius: 3 }, stepOn: { shadowColor: "#FFF5D8", shadowOpacity: 0.55, shadowRadius: 4 },
  pieceDots: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }, pieceDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: "#FFFFFF70", backgroundColor: "#FFFFFF18" },
  feltWrap: { minHeight: 285, flex: 1, overflow: "hidden", borderRadius: 34, borderWidth: 3, borderColor: "#6B4A2B", padding: 10, position: "relative" },
  seat: { position: "absolute", alignItems: "center", width: 74, zIndex: 2, padding: 3, borderRadius: 16 },
  topSeat: { top: 4, left: "50%", marginLeft: -37 }, leftSeat: { left: 2, top: "39%" }, rightSeat: { right: 2, top: "39%" },
  activeSeat: { backgroundColor: "#E7B84B55", shadowColor: "#E7B84B", shadowOpacity: 0.9, shadowRadius: 12 },
  seatAvatar: { width: 48, height: 48, borderRadius: 24, overflow: "hidden", borderWidth: 3 }, seatImage: { width: 48, height: 48 },
  yourSeat: { alignSelf: "center", alignItems: "center", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 16 }, yourAvatar: { borderWidth: 3, borderColor: "#E7B84B", borderRadius: 28, padding: 1 },
  seatName: { fontWeight: "800", marginTop: 1 }, miniStones: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", maxWidth: 65, gap: 2, marginTop: 2 },
  miniStone: { width: 7, height: 12, borderRadius: 2, backgroundColor: "#D9C5A0", borderWidth: 1, borderColor: "#69462E" },
  opening: { alignSelf: "center", marginTop: 66, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: "#0D4933AA" },
  chainViewport: { flex: 1, minHeight: 110, alignItems: "center", justifyContent: "center", overflow: "hidden", marginHorizontal: 80, marginTop: 2, marginBottom: 2 },
  stone: { width: 56, height: 28, borderRadius: 8, backgroundColor: "#1B4B3C", borderRightWidth: 4, borderBottomWidth: 4, borderColor: "#0A2823", shadowColor: "#061A16", shadowOpacity: 0.36, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  compactStone: { width: 44, height: 22, borderRadius: 6, borderRightWidth: 3, borderBottomWidth: 3 }, verticalStone: { width: 22, height: 44 },
  dimmedStone: { opacity: 0.5 }, highlightedStone: { borderColor: "#E7B84B", shadowColor: "#E7B84B", shadowOpacity: 0.8, shadowRadius: 8 },
  stoneFace: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderRadius: 6, backgroundColor: "#FBF7EC", borderWidth: 1, borderColor: "#E6D9B8", overflow: "hidden" },
  compactFace: { borderRadius: 4 }, verticalFace: { flexDirection: "column" }, stoneDivider: { position: "absolute", left: "50%", top: "12%", width: 1, height: "76%", backgroundColor: "#D8CBAE" }, verticalDivider: { left: "12%", top: "50%", width: "76%", height: 1 },
  endsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 80 }, endHighlight: { minWidth: 58, alignItems: "center", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: "#FFFFFF28" },
  endHighlightOn: { borderColor: "#E7B84B", backgroundColor: "#E7B84B35", shadowColor: "#E7B84B", shadowOpacity: 0.8, shadowRadius: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 30, gap: 6 }, statusText: { flex: 1, fontWeight: "700" }, inviteChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: "#D7E8DD" },
  resultCard: { alignItems: "center", gap: 4, padding: 8, borderRadius: 14, backgroundColor: "#FFF6DE", borderWidth: 1, borderColor: "#E7B84B" }, handHeader: { flexDirection: "row", justifyContent: "space-between" },
  hand: { minHeight: 72, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: 5 }, handItem: { alignItems: "center", minHeight: 54 }, sidePicker: { position: "absolute", top: 32, zIndex: 5, flexDirection: "row", gap: 4 },
  sideButton: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, backgroundColor: "#6D4029", borderWidth: 1, borderColor: "#E7B84B" }, passButton: { alignSelf: "center", paddingHorizontal: 26, paddingVertical: 9, borderRadius: 15, backgroundColor: "#6D4029", borderWidth: 2, borderColor: "#B87942" },
  disabled: { opacity: 0.38 }, centerPage: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22, backgroundColor: "#E4F5F2", gap: 10 }, heroEmoji: { fontSize: 52 }, centerText: { textAlign: "center" }, primaryButton: { borderRadius: 13, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: "#0B6A63", marginTop: 3 },
});
