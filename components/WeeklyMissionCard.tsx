import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { ClipPath, Defs, G, Image as SvgImage, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { loadJourney, placeJourneyPiece, advanceJourneyLevel, type JourneyState, type JourneyPiece } from '@/services/journey-service';
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
const JOURNEY_IMAGE_SOURCES = {
  'rest-day-clock': require('../assets/images/rest-day-clock-ui.png'),
  'clock-carnival': require('../assets/images/mascot/clock-carnival.png'),
  'clock-junina': require('../assets/images/mascot/clock-junina.png'),
  'clock-christmas': require('../assets/images/mascot/clock-christmas.png'),
  'clock-newyear': require('../assets/images/mascot/clock-newyear.png'),
} as const;

type Node = { index: number; x: number; y: number };
const MAP_NODES: Node[] = Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, index) => ({
  index,
  x: index % 2 === 0 ? 94 : 266,
  y: MAP_HEIGHT - 52 - index * NODE_GAP,
}));

function mapCurve(from: Node, to: Node) {
  const middle = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${to.y}`;
}
function mapPath(nodes: Node[]) { return nodes.slice(0, -1).map((node, index) => mapCurve(node, nodes[index + 1])).join(' '); }
function piecePath(row: number, column: number) {
  const x = column * CELL_WIDTH;
  const y = row * CELL_HEIGHT;
  const rightTab = (row + column) % 2 === 0 ? 1 : -1;
  const bottomTab = (row + column) % 2 === 0 ? -1 : 1;
  const topBump = -bottomTab * 12;
  const top = row === 0 ? `M ${x} ${y} H ${x + CELL_WIDTH}` : `M ${x} ${y} H ${x + CELL_WIDTH / 2 - 16} C ${x + CELL_WIDTH / 2 - 10} ${y} ${x + CELL_WIDTH / 2 - 10} ${y + topBump} ${x + CELL_WIDTH / 2} ${y + topBump} C ${x + CELL_WIDTH / 2 + 10} ${y + topBump} ${x + CELL_WIDTH / 2 + 10} ${y} ${x + CELL_WIDTH / 2 + 16} ${y} H ${x + CELL_WIDTH}`;
  const right = column === PUZZLE_COLUMNS - 1 ? `L ${x + CELL_WIDTH} ${y + CELL_HEIGHT}` : `L ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 - 16} C ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 - 9} ${x + CELL_WIDTH + rightTab * 12} ${y + CELL_HEIGHT / 2 - 9} ${x + CELL_WIDTH + rightTab * 12} ${y + CELL_HEIGHT / 2} C ${x + CELL_WIDTH + rightTab * 12} ${y + CELL_HEIGHT / 2 + 9} ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 + 9} ${x + CELL_WIDTH} ${y + CELL_HEIGHT / 2 + 16} L ${x + CELL_WIDTH} ${y + CELL_HEIGHT}`;
  const bottom = row === PUZZLE_ROWS - 1 ? `L ${x} ${y + CELL_HEIGHT}` : `L ${x + CELL_WIDTH / 2 + 16} ${y + CELL_HEIGHT} C ${x + CELL_WIDTH / 2 + 9} ${y + CELL_HEIGHT} ${x + CELL_WIDTH / 2 + 9} ${y + CELL_HEIGHT + bottomTab * 12} ${x + CELL_WIDTH / 2} ${y + CELL_HEIGHT + bottomTab * 12} C ${x + CELL_WIDTH / 2 - 9} ${y + CELL_HEIGHT + bottomTab * 12} ${x + CELL_WIDTH / 2 - 9} ${y + CELL_HEIGHT} ${x + CELL_WIDTH / 2 - 16} ${y + CELL_HEIGHT} L ${x} ${y + CELL_HEIGHT}`;
  const left = column === 0 ? `L ${x} ${y} Z` : `L ${x} ${y + CELL_HEIGHT / 2 + 16} C ${x} ${y + CELL_HEIGHT / 2 + 9} ${x - rightTab * 12} ${y + CELL_HEIGHT / 2 + 9} ${x - rightTab * 12} ${y + CELL_HEIGHT / 2} C ${x - rightTab * 12} ${y + CELL_HEIGHT / 2 - 9} ${x} ${y + CELL_HEIGHT / 2 - 9} ${x} ${y + CELL_HEIGHT / 2 - 16} L ${x} ${y} Z`;
  return `${top} ${right} ${bottom} ${left}`;
}

function Scene({ colors }: { colors: ReturnType<typeof useAppColors> }) {
  return <Svg width="100%" height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} style={StyleSheet.absoluteFill}>
    <Defs><LinearGradient id="journey-sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#132E35" /><Stop offset="0.52" stopColor="#1E4444" /><Stop offset="1" stopColor="#2E4A45" /></LinearGradient></Defs>
    <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#journey-sky)" />
    <Path d={`M 0 ${MAP_HEIGHT - 340} Q 90 ${MAP_HEIGHT - 440} 180 ${MAP_HEIGHT - 350} T ${MAP_WIDTH} ${MAP_HEIGHT - 380} V ${MAP_HEIGHT} H 0 Z`} fill={`${colors.teal}20`} />
    <Path d={`M 0 ${MAP_HEIGHT - 220} Q 120 ${MAP_HEIGHT - 320} 240 ${MAP_HEIGHT - 230} T ${MAP_WIDTH} ${MAP_HEIGHT - 260} V ${MAP_HEIGHT} H 0 Z`} fill={`${colors.coral}10`} />
    {Array.from({ length: 12 }, (_, index) => <G key={`star-${index}`} opacity={0.36}><Path d={`M ${24 + (index * 67) % 320} ${36 + (index * 91) % (MAP_HEIGHT - 160)} h 2`} stroke="#D4F4EC" strokeWidth="2" strokeLinecap="round" /></G>)}
  </Svg>;
}

function PuzzleBoard({ state, colors, onPlace }: { state: JourneyState; colors: ReturnType<typeof useAppColors>; onPlace: (piece: JourneyPiece) => void }) {
  const currentPieces = state.pieces.filter((piece) => piece.nivel === state.level.nivel);
  const placed = new Set(currentPieces.filter((piece) => piece.encaixada).map((piece) => piece.indice));
  const image = getJourneyImage(state.level.nivel);
  const [selected, setSelected] = useState<JourneyPiece | null>(null);
  const drag = useRef(new Animated.ValueXY()).current;
  const dragPiece = useRef<JourneyPiece | null>(null);
  /* eslint-disable react-hooks/refs -- PanResponder requires stable imperative Animated refs. */
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(dragPiece.current),
    onPanResponderGrant: () => drag.setValue({ x: 0, y: 0 }),
    onPanResponderMove: Animated.event([null, { dx: drag.x, dy: drag.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      const piece = dragPiece.current;
      dragPiece.current = null;
      if (piece && gesture.dy < -90) onPlace(piece);
      Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  }), [drag, onPlace]);
  /* eslint-enable react-hooks/refs */
  return <View style={[styles.boardShell, { borderColor: `${colors.teal}55`, backgroundColor: `${colors.deepTeal}12` }]}>
    <AppText variant="tiny" color={colors.muted} style={styles.boardProgress}>{currentPieces.filter((piece) => piece.encaixada).length}/{PECAS_POR_QUEBRA_CABECA} encaixadas</AppText>
    <View style={styles.boardWrap}><Svg width={BOARD_WIDTH} height={BOARD_HEIGHT} viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
      <Defs>{Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, index) => <ClipPath key={index} id={`journey-piece-${index}`}><Path d={piecePath(Math.floor(index / PUZZLE_COLUMNS), index % PUZZLE_COLUMNS)} /></ClipPath>)}</Defs>
      <Rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill={`${colors.card}70`} />
      {Array.from({ length: PECAS_POR_QUEBRA_CABECA }, (_, index) => {
        const isPlaced = placed.has(index);
        const path = piecePath(Math.floor(index / PUZZLE_COLUMNS), index % PUZZLE_COLUMNS);
        return <G key={index}><Path d={path} fill={isPlaced ? 'transparent' : `${colors.muted}16`} stroke={isPlaced ? `${colors.teal}CC` : `${colors.muted}60`} strokeWidth={2} />{isPlaced ? <SvgImage href={JOURNEY_IMAGE_SOURCES[image.id as keyof typeof JOURNEY_IMAGE_SOURCES]} x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} preserveAspectRatio="xMidYMid slice" clipPath={`url(#journey-piece-${index})`} /> : null}</G>;
      })}
    </Svg></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayScroll}>
      {currentPieces.filter((piece) => !piece.encaixada).map((piece) => <Animated.View key={piece.id} {...responder.panHandlers} style={[styles.trayPiece, { borderColor: colors.coral, backgroundColor: `${colors.coral}18` }]}>
        <Pressable onPress={() => setSelected(piece)} onLongPress={() => { dragPiece.current = piece; }} style={styles.trayTouch}><MaterialCommunityIcons name="puzzle-outline" size={19} color={colors.coral} /><AppText variant="tiny" color={colors.coral} style={styles.bold}>{piece.indice + 1}</AppText></Pressable>
      </Animated.View>)}
      {!currentPieces.some((piece) => !piece.encaixada) ? <AppText variant="tiny" color={colors.muted}>Bata o ponto para ganhar peças.</AppText> : null}
    </ScrollView>
    {selected ? <View style={styles.accessibilityRow}><AppText variant="tiny" color={colors.muted}>Peça {selected.indice + 1} selecionada. Toque no espaço correspondente para encaixar.</AppText><Pressable onPress={() => { onPlace(selected); setSelected(null); }}><AppText variant="tiny" color={colors.teal} style={styles.bold}>ENCAIXAR</AppText></Pressable></View> : null}
  </View>;
}

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const journeyVersion = useAppStore((state) => state.journeyVersion);
  const pieceNotice = useAppStore((state) => state.pieceNotice);
  const clearPieceNotice = useAppStore((state) => state.clearPieceNotice);
  const [state, setState] = useState<JourneyState | null>(null);
  const [selectedNode, setSelectedNode] = useState(0);
  const [mapVisible, setMapVisible] = useState(false);
  const [boardVisible, setBoardVisible] = useState(false);
  const mapRef = useRef<ScrollView>(null);
  const load = async () => setState(await loadJourney());
  useEffect(() => { void Promise.resolve().then(load); }, [journeyVersion]);
  useEffect(() => { if (pieceNotice) { const timer = setTimeout(clearPieceNotice, 2800); return () => clearTimeout(timer); } return undefined; }, [pieceNotice, clearPieceNotice]);
  const currentPieces = state?.pieces.filter((piece) => piece.nivel === state.level.nivel) ?? [];
  const earned = currentPieces.length;
  const nextIndex = Math.min(PECAS_POR_QUEBRA_CABECA - 1, earned);
  const activeNode = MAP_NODES[selectedNode] ?? MAP_NODES[nextIndex];
  const fullPath = useMemo(() => mapPath(MAP_NODES), []);
  const traveledPath = useMemo(() => mapPath(MAP_NODES.slice(0, Math.max(2, nextIndex + 1))), [nextIndex]);
  useEffect(() => { const node = MAP_NODES[nextIndex]; if (node) setTimeout(() => mapRef.current?.scrollTo({ y: Math.max(0, node.y - 210), animated: true }), 100); }, [nextIndex]);
  const place = async (piece: JourneyPiece) => { const next = await placeJourneyPiece(piece.id); if (next) setState(next); };
  const completed = Boolean(state?.level.concluido_em);
  return <SurfaceCard style={[styles.container, { borderColor: `${colors.teal}65`, paddingBottom: Math.max(18, insets.bottom) }]}>
    <View style={styles.header}><View style={[styles.headerIcon, { backgroundColor: `${colors.teal}1F` }]}><MaterialCommunityIcons name="map-marker-path" size={23} color={colors.teal} /></View><View style={styles.headerCopy}><AppText variant="tiny" color={colors.teal} style={styles.eyebrow}>JORNADA DE BOAS PRÁTICAS</AppText><AppText variant="subtitle">Seu caminho · Nível {state?.level.nivel ?? 1}</AppText></View><AppText variant="tiny" color={colors.coral} style={styles.bold}>{earned}/{PECAS_POR_QUEBRA_CABECA} peças</AppText></View>
    {pieceNotice ? <View style={[styles.notice, { backgroundColor: `${colors.teal}20`, borderColor: `${colors.teal}66` }]}><MaterialCommunityIcons name="puzzle-plus-outline" size={18} color={colors.teal} /><AppText variant="small" color={colors.deepTeal}>{pieceNotice}</AppText></View> : null}
    <View style={styles.sectionTitle}><AppText variant="subtitle">Seu caminho</AppText><AppText variant="tiny" color={colors.muted}>Cada nó é uma peça. O mascote mostra onde você está.</AppText></View>
    <View style={[styles.mapFrame, { borderColor: `${colors.teal}40` }]}><ScrollView ref={mapRef} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.mapScroll}><View style={styles.mapCanvas}><Scene colors={colors} /><Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} style={StyleSheet.absoluteFill}><Path d={fullPath} fill="none" stroke={`${colors.muted}70`} strokeWidth={7} strokeDasharray="3 12" strokeLinecap="round" /><Path d={traveledPath} fill="none" stroke={colors.teal} strokeWidth={9} strokeLinecap="round" /></Svg>{MAP_NODES.map((node) => { const won = node.index < earned; const current = node.index === nextIndex; return <Pressable key={node.index} onPress={() => setSelectedNode(node.index)} accessibilityRole="button" style={[styles.mapNode, { left: node.x - NODE_SIZE / 2, top: node.y - NODE_SIZE / 2 }]}><View style={[styles.node, { width: current ? 64 : NODE_SIZE, height: current ? 64 : NODE_SIZE, borderRadius: 40, backgroundColor: won ? colors.teal : current ? `${colors.coral}32` : `${colors.card}E6`, borderColor: current ? colors.coral : won ? colors.teal : `${colors.muted}88` }]}>{won ? <MaterialCommunityIcons name="puzzle-check" size={22} color="#FFFFFF" /> : current ? <MaterialCommunityIcons name="puzzle-outline" size={25} color={colors.coral} /> : <MaterialCommunityIcons name="lock-outline" size={16} color={colors.muted} />}<AppText variant="tiny" color={won ? '#FFFFFF' : current ? colors.coral : colors.muted} style={styles.nodeNumber}>{node.index + 1}</AppText></View>{node.index % 4 === 3 ? <AppText variant="tiny" color={colors.muted} style={styles.flag}>{['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][Math.floor(node.index / 4)] ?? 'Dia'}</AppText> : null}</Pressable>; })}</View></ScrollView><Pressable onPress={() => mapRef.current?.scrollTo({ y: Math.max(0, MAP_NODES[nextIndex].y - 210), animated: true })} style={[styles.whereButton, { borderColor: colors.teal, backgroundColor: colors.card }]}><MaterialCommunityIcons name="crosshairs-gps" size={15} color={colors.teal} /><AppText variant="tiny" color={colors.teal} style={styles.bold}>Onde estou</AppText></Pressable><Pressable onPress={() => setMapVisible(true)} style={[styles.expandButton, { borderColor: colors.teal, backgroundColor: colors.card }]}><MaterialCommunityIcons name="arrow-expand" size={17} color={colors.teal} /></Pressable></View>
    <View style={[styles.missionPanel, { backgroundColor: `${colors.coral}12`, borderColor: `${colors.coral}58` }]}><AppText variant="tiny" color={colors.coral} style={styles.eyebrow}>{activeNode.index < earned ? 'PEÇA CONQUISTADA' : 'PRÓXIMA PEÇA'}</AppText><AppText variant="subtitle">Peça {activeNode.index + 1}</AppText><AppText variant="small" color={colors.muted}>{activeNode.index < earned ? 'Ela está disponível na bandeja ou já foi encaixada.' : `Continue o caminho: ${summary.completed}/${summary.goal} missão(ões) da semana concluída(s).`}</AppText></View>
    <View style={styles.boardHeader}><View><AppText variant="subtitle">Quadro surpresa</AppText><AppText variant="tiny" color={colors.muted}>{currentPieces.filter((piece) => piece.encaixada).length}/{PECAS_POR_QUEBRA_CABECA} encaixadas · {currentPieces.filter((piece) => !piece.encaixada).length} na bandeja</AppText></View><Pressable onPress={() => setBoardVisible(true)} style={[styles.smallButton, { borderColor: colors.teal }]}><MaterialCommunityIcons name="puzzle-outline" size={17} color={colors.teal} /><AppText variant="tiny" color={colors.teal} style={styles.bold}>ABRIR</AppText></Pressable></View>
    {state ? <PuzzleBoard state={state} colors={colors} onPlace={place} /> : <View style={styles.loading}><AppText variant="small" color={colors.muted}>Carregando seu quadro…</AppText></View>}
    {completed ? <View style={styles.actions}><ActionButton title="Próximo quebra-cabeça" onPress={async () => { const next = await advanceJourneyLevel(); if (next) setState(next); }} icon={<MaterialCommunityIcons name="image-multiple-outline" size={18} color="#FFFFFF" />} /></View> : null}
    <ActionButton title="Abrir espelho" variant="secondary" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.deepTeal} />} />
    <Modal visible={boardVisible} transparent animationType="fade" onRequestClose={() => setBoardVisible(false)}><View style={styles.modalBackdrop}><SurfaceCard style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: Math.max(18, insets.bottom) }]}><View style={styles.modalTitle}><MaterialCommunityIcons name="puzzle-outline" size={24} color={colors.coral} /><AppText variant="subtitle">Quadro surpresa · {state?.level.nivel ? `Nível ${state.level.nivel}` : ''}</AppText></View>{state ? <PuzzleBoard state={state} colors={colors} onPlace={place} /> : null}<ActionButton title="Fechar" variant="outline" onPress={() => setBoardVisible(false)} /></SurfaceCard></View></Modal>
    <Modal visible={mapVisible} transparent animationType="slide" onRequestClose={() => setMapVisible(false)}><View style={styles.fullMapBackdrop}><View style={[styles.fullMapCard, { backgroundColor: colors.card, paddingBottom: Math.max(18, insets.bottom) }]}><View style={styles.modalTitle}><AppText variant="subtitle">Seu caminho · Nível {state?.level.nivel ?? 1}</AppText><Pressable onPress={() => setMapVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.muted} /></Pressable></View><ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}><View style={styles.mapCanvas}><Scene colors={colors} /><Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} style={StyleSheet.absoluteFill}><Path d={fullPath} fill="none" stroke={`${colors.muted}70`} strokeWidth={7} strokeDasharray="3 12" /><Path d={traveledPath} fill="none" stroke={colors.teal} strokeWidth={9} /></Svg>{MAP_NODES.map((node) => <View key={node.index} style={[styles.mapNode, { left: node.x - NODE_SIZE / 2, top: node.y - NODE_SIZE / 2 }]}><View style={[styles.node, { width: NODE_SIZE, height: NODE_SIZE, borderRadius: 40, backgroundColor: node.index < earned ? colors.teal : `${colors.card}E6`, borderColor: node.index < earned ? colors.teal : colors.muted }]}><AppText variant="tiny" color={node.index < earned ? '#FFFFFF' : colors.muted}>{node.index + 1}</AppText></View></View>)}</View></ScrollView></View></View></Modal>
  </SurfaceCard>;
}

const styles = StyleSheet.create({
  container: { gap: 14, overflow: 'hidden' }, header: { flexDirection: 'row', alignItems: 'center', gap: 10 }, headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, gap: 2 }, eyebrow: { fontWeight: '800', letterSpacing: 1 }, bold: { fontWeight: '800' }, sectionTitle: { gap: 3 }, notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 10 }, mapFrame: { height: 460, borderRadius: 24, borderWidth: 1, overflow: 'hidden', position: 'relative' }, mapScroll: { paddingVertical: 12 }, mapCanvas: { width: MAP_WIDTH, height: MAP_HEIGHT, alignSelf: 'center', position: 'relative' }, mapNode: { position: 'absolute', width: 80, height: 80, alignItems: 'center', justifyContent: 'center', zIndex: 4 }, node: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, shadowColor: '#071F1D', shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }, nodeNumber: { position: 'absolute', bottom: 4, fontWeight: '800' }, flag: { position: 'absolute', left: 44, width: 42 }, whereButton: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 5, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 7 }, expandButton: { position: 'absolute', left: 12, bottom: 12, borderWidth: 1, borderRadius: 12, padding: 8 }, missionPanel: { borderWidth: 1, borderRadius: 17, padding: 13, gap: 4 }, boardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, smallButton: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', gap: 5, alignItems: 'center' }, boardShell: { alignSelf: 'center', width: '100%', borderWidth: 1, borderRadius: 20, padding: 10, alignItems: 'center', gap: 9, overflow: 'hidden' }, boardProgress: { alignSelf: 'flex-start' }, boardWrap: { width: BOARD_WIDTH, height: BOARD_HEIGHT }, trayScroll: { width: '100%', gap: 8, alignItems: 'center' }, trayPiece: { width: 58, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, trayTouch: { flexDirection: 'row', gap: 3, alignItems: 'center', padding: 10 }, accessibilityRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }, actions: { flexDirection: 'row', gap: 8 }, loading: { minHeight: 100, alignItems: 'center', justifyContent: 'center' }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,22,24,0.82)', justifyContent: 'center', padding: 14 }, modalCard: { width: '100%', maxWidth: 430, alignSelf: 'center', gap: 12, borderRadius: 24 }, modalTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, fullMapBackdrop: { flex: 1, backgroundColor: 'rgba(4,22,24,0.86)', justifyContent: 'flex-end' }, fullMapCard: { height: '92%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, gap: 10 },
});
