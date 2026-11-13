import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { ClipPath, Defs, G, Image as SvgImage, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { advanceJourneyLevel, loadJourney, placeJourneyPiece, type JourneyPiece, type JourneyState } from '@/services/journey-service';
import { getJourneyImage, PUZZLE_COLUMNS, PUZZLE_ROWS, PECAS_POR_QUEBRA_CABECA } from '@/utils/journey-game';
import type { WeeklyMissionSummary } from '@/utils/weekly-mission';

const MAP_WIDTH = 360;
const NODE_GAP = 110;
const MAP_HEIGHT = NODE_GAP * PECAS_POR_QUEBRA_CABECA + 80;
const NODE_SIZE = 48;
const BOARD_WIDTH = 304;
const CELL_WIDTH = BOARD_WIDTH / PUZZLE_COLUMNS;
const CELL_HEIGHT = 70;
const BOARD_HEIGHT = CELL_HEIGHT * PUZZLE_ROWS;
const CENARIOS = [
  require('../assets/mapa/cenario1.webp'),
  require('../assets/mapa/cenario2.webp'),
  require('../assets/mapa/cenario3.webp'),
] as const;
const PUZZLE_IMAGES = {
  'rest-day-clock': require('../assets/images/rest-day-clock-ui.png'),
  'clock-carnival': require('../assets/images/mascot/clock-carnival.png'),
  'clock-junina': require('../assets/images/mascot/clock-junina.png'),
  'clock-christmas': require('../assets/images/mascot/clock-christmas.png'),
  'clock-newyear': require('../assets/images/mascot/clock-newyear.png'),
} as const;

type Node = { index: number; x: number; y: number };
const MAP_NODES: Node[] = Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, index) => ({ index, x: index % 2 === 0 ? 94 : 266, y: MAP_HEIGHT - 52 - index * NODE_GAP }));

function mapCurve(from: Node, to: Node) { const middle = (from.y + to.y) / 2; return `M ${from.x} ${from.y} C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${to.y}`; }
function mapPath(nodes: Node[]) { return nodes.slice(0, -1).map((node, index) => mapCurve(node, nodes[index + 1])).join(' '); }
function piecePath(row: number, column: number) {
  const x = column * CELL_WIDTH; const y = row * CELL_HEIGHT; const side = (row + column) % 2 === 0 ? 1 : -1; const top = -side * 12; const right = side * 12;
  const topEdge = row === 0 ? `M ${x} ${y} H ${x + CELL_WIDTH}` : `M ${x} ${y} H ${x + CELL_WIDTH / 2 - 16} C ${x + CELL_WIDTH / 2 - 10} ${y} ${x + CELL_WIDTH / 2 - 10} ${y + top} ${x + CELL_WIDTH / 2} ${y + top} C ${x + CELL_WIDTH / 2 + 10} ${y + top} ${x + CELL_WIDTH / 2 + 10} ${y} ${x + CELL_WIDTH / 2 + 16} ${y} H ${x + CELL_WIDTH}`;
  const rightEdge = column === PUZZLE_COLUMNS - 1 ? `L ${x + CELL_WIDTH} ${y + CELL_HEIGHT}` : `L ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 - 16} C ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 - 10} ${x + CELL_WIDTH + right} ${y + CELL_HEIGHT / 2 - 10} ${x + CELL_WIDTH + right} ${y + CELL_HEIGHT / 2} C ${x + CELL_WIDTH + right} ${y + CELL_HEIGHT / 2 + 10} ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 + 10} ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 + 16} L ${x + CELL_WIDTH} ${y + CELL_HEIGHT}`;
  const bottomEdge = row === PUZZLE_ROWS - 1 ? `L ${x} ${y + CELL_HEIGHT}` : `L ${x + CELL_WIDTH / 2 + 16} ${y + CELL_HEIGHT} C ${x + CELL_WIDTH / 2 + 10} ${y + CELL_HEIGHT} ${x + CELL_WIDTH / 2 + 10} ${y + CELL_HEIGHT - top} ${x + CELL_WIDTH / 2} ${y + CELL_HEIGHT - top} C ${x + CELL_WIDTH / 2 - 10} ${y + CELL_HEIGHT - top} ${x + CELL_WIDTH / 2 - 10} ${y + CELL_HEIGHT} ${x + CELL_WIDTH / 2 - 16} ${y + CELL_HEIGHT} L ${x} ${y + CELL_HEIGHT}`;
  const leftEdge = column === 0 ? `L ${x} ${y} Z` : `L ${x} ${y + CELL_HEIGHT / 2 + 16} C ${x} ${y + CELL_HEIGHT / 2 + 10} ${x - right} ${y + CELL_HEIGHT / 2 + 10} ${x - right} ${y + CELL_HEIGHT / 2} C ${x - right} ${y + CELL_HEIGHT / 2 - 10} ${x} ${y + CELL_HEIGHT / 2 - 10} ${x} ${y + CELL_HEIGHT / 2 - 16} L ${x} ${y} Z`;
  return `${topEdge} ${rightEdge} ${bottomEdge} ${leftEdge}`;
}

function FallbackScene({ colors }: { colors: ReturnType<typeof useAppColors> }) {
  return <Svg width="100%" height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} style={StyleSheet.absoluteFill}>
    <Defs><LinearGradient id="fallback-sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#557C7A" /><Stop offset="0.55" stopColor="#294E4B" /><Stop offset="1" stopColor="#102A2A" /></LinearGradient></Defs>
    <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#fallback-sky)" />
    <Path d={`M0 ${MAP_HEIGHT - 420} Q90 ${MAP_HEIGHT - 520} 180 ${MAP_HEIGHT - 430} T${MAP_WIDTH} ${MAP_HEIGHT - 460} V${MAP_HEIGHT} H0Z`} fill={`${colors.teal}55`} />
    <Path d={`M0 ${MAP_HEIGHT - 230} Q120 ${MAP_HEIGHT - 330} 240 ${MAP_HEIGHT - 245} T${MAP_WIDTH} ${MAP_HEIGHT - 280} V${MAP_HEIGHT} H0Z`} fill={`${colors.deepTeal}90`} />
  </Svg>;
}

function MapBackground({ level, colors }: { level: number; colors: ReturnType<typeof useAppColors> }) {
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const bandHeight = MAP_HEIGHT / CENARIOS.length;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <FallbackScene colors={colors} />
    {CENARIOS.map((_, band) => <Image key={band} source={CENARIOS[(level - 1 + band) % CENARIOS.length]} resizeMode="cover" onError={() => setFailed((current) => ({ ...current, [band]: true }))} style={[styles.scenarioImage, { top: (CENARIOS.length - 1 - band) * bandHeight, height: bandHeight, opacity: failed[band] ? 0 : 1 }]} />)}
    <View style={styles.mapShade} />
  </View>;
}

function PuzzlePieceVisual({ index, image, colors, selected, onPress }: { index: number; image: number; colors: ReturnType<typeof useAppColors>; selected: boolean; onPress: () => void }) {
  const row = Math.floor(index / PUZZLE_COLUMNS); const column = index % PUZZLE_COLUMNS; const path = piecePath(row, column); const x = column * CELL_WIDTH; const y = row * CELL_HEIGHT;
  return <Pressable onPress={onPress} style={[styles.trayVisual, { borderColor: selected ? colors.teal : `${colors.muted}66`, backgroundColor: `${colors.card}E8` }]} accessibilityRole="button" accessibilityLabel={`Peça ${index + 1}`}>
    <Svg width={72} height={72} viewBox={`${x} ${y} ${CELL_WIDTH} ${CELL_HEIGHT}`}><Defs><ClipPath id={`tray-clip-${index}`}><Path d={path} /></ClipPath></Defs><SvgImage href={image} x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} preserveAspectRatio="xMidYMid slice" clipPath={`url(#tray-clip-${index})`} /><Path d={path} fill="transparent" stroke={selected ? colors.teal : `${colors.muted}88`} strokeWidth={2} /></Svg><View style={[styles.pieceBadge, { backgroundColor: selected ? colors.teal : colors.deepTeal }]}><AppText variant="tiny" color="#FFFFFF" style={styles.bold}>{index + 1}</AppText></View>
  </Pressable>;
}

function PuzzleBoard({ state, colors, onPlace }: { state: JourneyState; colors: ReturnType<typeof useAppColors>; onPlace: (piece: JourneyPiece) => Promise<void> }) {
  const currentPieces = state.pieces.filter((piece) => piece.nivel === state.level.nivel); const placed = new Set(currentPieces.filter((piece) => piece.encaixada).map((piece) => piece.indice));
  const image = PUZZLE_IMAGES[getJourneyImage(state.level.nivel).id as keyof typeof PUZZLE_IMAGES]; const [selected, setSelected] = useState<JourneyPiece | null>(null); const [feedback, setFeedback] = useState<string | null>(null); const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => { if (!selected) return undefined; const animation = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true })])); animation.start(); return () => animation.stop(); }, [selected, pulse]);
  const selectPiece = (piece: JourneyPiece) => { setSelected(piece); setFeedback(`Peça ${piece.indice + 1} selecionada. Toque no espaço com o mesmo número.`); };
  const chooseSlot = async (index: number) => {
    if (!selected) { setFeedback('Primeiro toque em uma peça da bandeja.'); return; }
    if (selected.indice !== index) { setFeedback(`Essa peça vai no espaço com o número ${selected.indice + 1}.`); return; }
    await onPlace(selected); setSelected(null); setFeedback(`Peça ${index + 1} encaixada.`); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };
  return <View style={[styles.boardShell, { borderColor: `${colors.teal}55`, backgroundColor: `${colors.deepTeal}0A` }]}>
    <View style={styles.boardMeta}><AppText variant="tiny" color={colors.muted}>{currentPieces.filter((piece) => piece.encaixada).length}/{PECAS_POR_QUEBRA_CABECA} encaixadas</AppText><AppText variant="tiny" color={colors.muted}>{currentPieces.filter((piece) => !piece.encaixada).length} na bandeja</AppText></View>
    <View style={styles.boardWrap}><Svg width={BOARD_WIDTH} height={BOARD_HEIGHT} viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
      <Defs>{Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, index) => <ClipPath key={index} id={`board-clip-${index}`}><Path d={piecePath(Math.floor(index / PUZZLE_COLUMNS), index % PUZZLE_COLUMNS)} /></ClipPath>)}</Defs>
      {Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, index) => { const isPlaced = placed.has(index); const path = piecePath(Math.floor(index / PUZZLE_COLUMNS), index % PUZZLE_COLUMNS); return <G key={index}>{isPlaced ? <SvgImage href={image} x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} preserveAspectRatio="xMidYMid slice" clipPath={`url(#board-clip-${index})`} /> : null}<Path d={path} fill="rgba(0,0,0,0.01)" stroke={isPlaced ? `${colors.teal}CC` : `${colors.muted}88`} strokeWidth={2} /></G>; })}
    </Svg>{Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, index) => { const isPlaced = placed.has(index); const isTarget = selected?.indice === index; return <Pressable key={index} onPress={() => void chooseSlot(index)} style={[styles.slotHit, { left: (index % PUZZLE_COLUMNS) * CELL_WIDTH, top: Math.floor(index / PUZZLE_COLUMNS) * CELL_HEIGHT, width: CELL_WIDTH, height: CELL_HEIGHT }]} accessibilityRole="button" accessibilityLabel={`Espaço da peça ${index + 1}`}>{!isPlaced ? <Animated.View style={[styles.slotNumber, { borderColor: isTarget ? colors.coral : `${colors.muted}88`, backgroundColor: isTarget ? `${colors.coral}25` : `${colors.deepTeal}55`, transform: isTarget ? [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] : undefined }]}><AppText variant="tiny" color={isTarget ? colors.coral : '#D7E3DD'} style={styles.bold}>{index + 1}</AppText></Animated.View> : null}</Pressable>; })}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayScroll}>{currentPieces.filter((piece) => !piece.encaixada).map((piece) => <PuzzlePieceVisual key={piece.id} index={piece.indice} image={image} colors={colors} selected={selected?.id === piece.id} onPress={() => selectPiece(piece)} />)}{!currentPieces.some((piece) => !piece.encaixada) ? <AppText variant="tiny" color={colors.muted}>Todas as peças foram encaixadas.</AppText> : null}</ScrollView>
    {feedback ? <AppText variant="tiny" color={feedback.includes('encaixada') ? colors.teal : colors.muted} style={styles.feedback}>{feedback}</AppText> : null}
  </View>;
}

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors(); const insets = useSafeAreaInsets(); const journeyVersion = useAppStore((state) => state.journeyVersion); const pieceNotice = useAppStore((state) => state.pieceNotice); const clearPieceNotice = useAppStore((state) => state.clearPieceNotice); const [state, setState] = useState<JourneyState | null>(null); const [mapVisible, setMapVisible] = useState(false); const mapRef = useRef<ScrollView>(null);
  useEffect(() => { void Promise.resolve().then(async () => setState(await loadJourney())); }, [journeyVersion]); useEffect(() => { if (!pieceNotice) return undefined; const timer = setTimeout(clearPieceNotice, 2800); return () => clearTimeout(timer); }, [pieceNotice, clearPieceNotice]);
  const currentPieces = state?.pieces.filter((piece) => piece.nivel === state.level.nivel) ?? []; const earned = currentPieces.length; const nextIndex = Math.min(PECAS_POR_QUEBRA_CABECA - 1, earned); const fullPath = useMemo(() => mapPath(MAP_NODES), []); const traveledPath = useMemo(() => mapPath(MAP_NODES.slice(0, Math.max(2, nextIndex + 1))), [nextIndex]); const level = state?.level.nivel ?? 1; const completed = Boolean(state?.level.concluido_em);
  useEffect(() => { const node = MAP_NODES[nextIndex]; if (node) setTimeout(() => mapRef.current?.scrollTo({ y: Math.max(0, node.y - 210), animated: true }), 100); }, [nextIndex]);
  const place = async (piece: JourneyPiece) => { const next = await placeJourneyPiece(piece.id); if (next) setState(next); };
  return <SurfaceCard style={[styles.container, { borderColor: `${colors.teal}65`, paddingBottom: Math.max(18, insets.bottom) }]}>
    <View style={styles.header}><View style={[styles.headerIcon, { backgroundColor: `${colors.teal}1F` }]}><MaterialCommunityIcons name="map-marker-path" size={23} color={colors.teal} /></View><View style={styles.headerCopy}><AppText variant="tiny" color={colors.teal} style={styles.eyebrow}>JORNADA DE BOAS PRÁTICAS</AppText><AppText variant="subtitle">Seu caminho · Nível {level}</AppText></View><AppText variant="tiny" color={colors.coral} style={styles.bold}>{earned}/{PECAS_POR_QUEBRA_CABECA} peças</AppText></View>
    {pieceNotice ? <View style={[styles.notice, { backgroundColor: `${colors.teal}20`, borderColor: `${colors.teal}66` }]}><MaterialCommunityIcons name="puzzle-plus-outline" size={18} color={colors.teal} /><AppText variant="small" color={colors.deepTeal}>{pieceNotice}</AppText></View> : null}
    <View style={styles.sectionTitle}><AppText variant="subtitle">Seu caminho</AppText><AppText variant="tiny" color={colors.muted}>Cada nó é uma peça. O mascote mostra onde você está.</AppText></View>
    <View style={[styles.mapFrame, { borderColor: `${colors.teal}40` }]}><ScrollView ref={mapRef} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.mapScroll}><View style={styles.mapCanvas}><MapBackground level={level} colors={colors} /><Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} style={StyleSheet.absoluteFill}><Path d={fullPath} fill="none" stroke={`${colors.muted}B0`} strokeWidth={7} strokeDasharray="3 12" strokeLinecap="round" /><Path d={traveledPath} fill="none" stroke={colors.teal} strokeWidth={9} strokeLinecap="round" /></Svg>{MAP_NODES.map((node) => { const won = node.index < earned; const current = node.index === nextIndex; return <View key={node.index} style={[styles.mapNode, { left: node.x - NODE_SIZE / 2, top: node.y - NODE_SIZE / 2 }]}><View style={[styles.node, { width: current ? 64 : NODE_SIZE, height: current ? 64 : NODE_SIZE, borderRadius: 40, backgroundColor: won ? colors.teal : current ? `${colors.coral}E8` : `${colors.card}E8`, borderColor: current ? colors.coral : won ? colors.teal : `${colors.muted}E8` }]}>{won ? <MaterialCommunityIcons name="puzzle-check" size={22} color="#FFFFFF" /> : current ? <MaterialCommunityIcons name="puzzle-outline" size={25} color="#FFFFFF" /> : <MaterialCommunityIcons name="lock-outline" size={16} color={colors.muted} />}<AppText variant="tiny" color={won || current ? '#FFFFFF' : colors.muted} style={styles.nodeNumber}>{node.index + 1}</AppText></View></View>; })}</View></ScrollView><Pressable onPress={() => mapRef.current?.scrollTo({ y: Math.max(0, MAP_NODES[nextIndex].y - 210), animated: true })} style={[styles.whereButton, { borderColor: colors.teal, backgroundColor: colors.card }]}><MaterialCommunityIcons name="crosshairs-gps" size={15} color={colors.teal} /><AppText variant="tiny" color={colors.teal} style={styles.bold}>Onde estou</AppText></Pressable><Pressable onPress={() => setMapVisible(true)} style={[styles.expandButton, { borderColor: colors.teal, backgroundColor: colors.card }]}><MaterialCommunityIcons name="arrow-expand" size={17} color={colors.teal} /></Pressable></View>
    <View style={[styles.missionPanel, { backgroundColor: `${colors.coral}12`, borderColor: `${colors.coral}58` }]}><AppText variant="tiny" color={colors.coral} style={styles.eyebrow}>{earned ? 'PRÓXIMA PEÇA' : 'PRIMEIRO PASSO'}</AppText><AppText variant="subtitle">Peça {nextIndex + 1}</AppText><AppText variant="small" color={colors.muted}>Continue o caminho: {summary.completed}/{summary.goal} missão(ões) da semana concluída(s).</AppText></View>
    {state ? <PuzzleBoard state={state} colors={colors} onPlace={place} /> : <View style={styles.loading}><AppText variant="small" color={colors.muted}>Carregando seu quadro…</AppText></View>}
    {completed ? <ActionButton title="Próximo quebra-cabeça" onPress={async () => { const next = await advanceJourneyLevel(); if (next) setState(next); }} icon={<MaterialCommunityIcons name="image-multiple-outline" size={18} color="#FFFFFF" />} /> : null}
    <ActionButton title="Abrir espelho" variant="secondary" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.deepTeal} />} />
    <Modal visible={mapVisible} transparent animationType="slide" onRequestClose={() => setMapVisible(false)}><View style={styles.fullMapBackdrop}><View style={[styles.fullMapCard, { backgroundColor: colors.card, paddingBottom: Math.max(18, insets.bottom) }]}><View style={styles.modalTitle}><AppText variant="subtitle">Seu caminho · Nível {level}</AppText><Pressable onPress={() => setMapVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.muted} /></Pressable></View><ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}><View style={styles.mapCanvas}><MapBackground level={level} colors={colors} /><Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} style={StyleSheet.absoluteFill}><Path d={fullPath} fill="none" stroke={`${colors.muted}B0`} strokeWidth={7} strokeDasharray="3 12" /><Path d={traveledPath} fill="none" stroke={colors.teal} strokeWidth={9} /></Svg>{MAP_NODES.map((node) => <View key={node.index} style={[styles.mapNode, { left: node.x - NODE_SIZE / 2, top: node.y - NODE_SIZE / 2 }]}><View style={[styles.node, { width: NODE_SIZE, height: NODE_SIZE, borderRadius: 40, backgroundColor: node.index < earned ? colors.teal : `${colors.card}E8`, borderColor: node.index < earned ? colors.teal : colors.muted }]}><AppText variant="tiny" color={node.index < earned ? '#FFFFFF' : colors.muted}>{node.index + 1}</AppText></View></View>)}</View></ScrollView></View></View></Modal>
  </SurfaceCard>;
}

const styles = StyleSheet.create({
  container: { gap: 14, overflow: 'hidden' }, header: { flexDirection: 'row', alignItems: 'center', gap: 10 }, headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, gap: 2 }, eyebrow: { fontWeight: '800', letterSpacing: 1 }, bold: { fontWeight: '800' }, sectionTitle: { gap: 3 }, notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 10 }, mapFrame: { height: 460, borderRadius: 24, borderWidth: 1, overflow: 'hidden', position: 'relative' }, mapScroll: { paddingVertical: 0 }, mapCanvas: { width: '100%', minWidth: MAP_WIDTH, height: MAP_HEIGHT, alignSelf: 'center', position: 'relative', overflow: 'hidden' }, scenarioImage: { position: 'absolute', left: 0, right: 0, width: '100%' }, mapShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,24,24,0.35)' }, mapNode: { position: 'absolute', width: 80, height: 80, alignItems: 'center', justifyContent: 'center', zIndex: 4 }, node: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, shadowColor: '#071F1D', shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }, nodeNumber: { position: 'absolute', bottom: 4, fontWeight: '800' }, whereButton: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 5, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 7, zIndex: 8 }, expandButton: { position: 'absolute', left: 12, bottom: 12, borderWidth: 1, borderRadius: 12, padding: 8, zIndex: 8 }, missionPanel: { borderWidth: 1, borderRadius: 17, padding: 13, gap: 4 }, boardShell: { alignSelf: 'center', width: '100%', borderWidth: 1, borderRadius: 20, padding: 10, alignItems: 'center', gap: 9, overflow: 'hidden' }, boardMeta: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' }, boardWrap: { width: BOARD_WIDTH, height: BOARD_HEIGHT, position: 'relative' }, slotHit: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 3 }, slotNumber: { minWidth: 25, height: 25, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, trayScroll: { width: '100%', gap: 8, alignItems: 'center', paddingHorizontal: 3 }, trayVisual: { width: 78, height: 78, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }, pieceBadge: { position: 'absolute', right: 4, top: 4, width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, feedback: { minHeight: 18, textAlign: 'center' }, loading: { minHeight: 100, alignItems: 'center', justifyContent: 'center' }, modalTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, fullMapBackdrop: { flex: 1, backgroundColor: 'rgba(4,22,24,0.86)', justifyContent: 'flex-end' }, fullMapCard: { height: '92%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, gap: 10 },
});
