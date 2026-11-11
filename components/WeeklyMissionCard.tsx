import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import type { WeeklyMissionSummary } from '@/utils/weekly-mission';

const MAP_WIDTH = 360;
const MAP_HEIGHT = 1200;
const NODE_SIZE = 56;
const IMAGE_SOURCE = require('../assets/images/rest-day-clock-ui.png');

const MAP_NODES = [
  { id: 1, x: 180, y: 1080, title: 'Comece bem', objective: 'Registre sua entrada com atenção.' },
  { id: 2, x: 270, y: 930, title: 'Entrada certa', objective: 'Mantenha o horário de entrada atualizado.' },
  { id: 3, x: 110, y: 780, title: 'Pausa respeitada', objective: 'Registre a saída e a volta do almoço.' },
  { id: 4, x: 260, y: 630, title: 'Ajude um colega', objective: 'Envie um convite ou lembrete para alguém.' },
  { id: 5, x: 110, y: 480, title: 'Revise o espelho', objective: 'Confira suas batidas antes de fechar a semana.' },
  { id: 6, x: 200, y: 330, title: 'Descanso conquistado', objective: 'Complete a jornada e revele a imagem.' },
] as const;

const EDGE_TABS = {
  top: [0, 1, -1, 0, 1, 0],
  right: [1, -1, 0],
  bottom: [0, 1, -1, 0, 1, 0],
  left: [1, -1, 0],
};

type Edge = 'top' | 'right' | 'bottom' | 'left';

function averageY(a: { y: number }, b: { y: number }) {
  return (a.y + b.y) / 2;
}

function curveBetween(from: (typeof MAP_NODES)[number], to: (typeof MAP_NODES)[number]) {
  const middleY = averageY(from, to);
  return `M ${from.x} ${from.y} C ${from.x} ${middleY}, ${to.x} ${middleY}, ${to.x} ${to.y}`;
}

function buildMapPath() {
  return MAP_NODES.slice(0, -1).map((node, index) => curveBetween(node, MAP_NODES[index + 1])).join(' ');
}

function edgeSegment(x: number, y: number, length: number, edge: Edge, tab: number) {
  const sign = tab >= 0 ? 1 : -1;
  const size = 10;
  const center = length / 2;
  const tabPath = `C ${center - 18} ${sign * size}, ${center - 10} ${sign * size}, ${center} ${sign * size} C ${center + 10} ${sign * size}, ${center + 18} ${sign * size}, ${center + 18} 0`;
  if (edge === 'top') return `M ${x} ${y} H ${x + center - 18} ${tabPath.replace('M ', '')} H ${x + length}`;
  if (edge === 'bottom') return `M ${x} ${y} H ${x + center - 18} ${tabPath.replace('M ', '')} H ${x + length}`;
  if (edge === 'left') return `M ${x} ${y} V ${y + center - 18} C ${x + sign * size} ${y + center - 10}, ${x + sign * size} ${y + center}, ${x + sign * size} ${y + center + 10} C ${x + sign * size} ${y + center + 18}, ${x} ${y + center + 18}, ${x} ${y + length}`;
  return `M ${x} ${y} V ${y + center - 18} C ${x + sign * size} ${y + center - 10}, ${x + sign * size} ${y + center}, ${x + sign * size} ${y + center + 10} C ${x + sign * size} ${y + center + 18}, ${x} ${y + center + 18}, ${x} ${y + length}`;
}

function puzzlePath(row: number, column: number, cellWidth: number, cellHeight: number) {
  const x = column * cellWidth;
  const y = row * cellHeight;
  const top = row === 0 ? `M ${x} ${y} H ${x + cellWidth}` : edgeSegment(x, y, cellWidth, 'top', EDGE_TABS.top[column + row]);
  const right = column === 1 ? `L ${x + cellWidth} ${y + cellHeight}` : `L ${x + cellWidth} ${y + cellHeight / 2 - 18} C ${x + cellWidth + 10} ${y + cellHeight / 2 - 10}, ${x + cellWidth + 10} ${y + cellHeight / 2}, ${x + cellWidth + 10} ${y + cellHeight / 2 + 10} C ${x + cellWidth + 10} ${y + cellHeight / 2 + 18}, ${x + cellWidth} ${y + cellHeight / 2 + 18}, ${x + cellWidth} ${y + cellHeight}`;
  const bottom = row === 2 ? `L ${x} ${y + cellHeight} Z` : `L ${x + cellWidth / 2 + 18} ${y + cellHeight} C ${x + cellWidth / 2 + 10} ${y + cellHeight + 10}, ${x + cellWidth / 2} ${y + cellHeight + 10}, ${x + cellWidth / 2 - 10} ${y + cellHeight + 10} C ${x + cellWidth / 2 - 18} ${y + cellHeight + 10}, ${x + cellWidth / 2 - 18} ${y + cellHeight}, ${x} ${y + cellHeight} Z`;
  const left = column === 0 ? '' : `M ${x} ${y + cellHeight} L ${x} ${y + cellHeight / 2 + 18} C ${x - 10} ${y + cellHeight / 2 + 10}, ${x - 10} ${y + cellHeight / 2}, ${x - 10} ${y + cellHeight / 2 - 10} C ${x - 10} ${y + cellHeight / 2 - 18}, ${x} ${y + cellHeight / 2 - 18}, ${x} ${y}`;
  return `${top} ${right} ${bottom} ${left}`;
}

function PuzzleBoard({ placed, tray, colors }: { placed: number[]; tray: number[]; colors: ReturnType<typeof useAppColors> }) {
  const cellWidth = 148;
  const cellHeight = 116;
  return (
    <View style={[styles.boardShell, { backgroundColor: `${colors.deepTeal}12`, borderColor: `${colors.teal}58` }]}>
      <Svg width={296} height={348} viewBox="0 0 296 348">
        <Defs>
          {Array.from({ length: 6 }, (_, index) => <ClipPath key={`clip-${index}`} id={`puzzle-piece-${index}`}><Path d={puzzlePath(Math.floor(index / 2), index % 2, cellWidth, cellHeight)} /></ClipPath>)}
        </Defs>
        <Rect x="0" y="0" width="296" height="348" fill={`${colors.deepTeal}10`} />
        {Array.from({ length: 6 }, (_, index) => {
          const row = Math.floor(index / 2);
          const column = index % 2;
          const path = puzzlePath(row, column, cellWidth, cellHeight);
          const isPlaced = placed.includes(index);
          const isTray = tray.includes(index);
          return (
            <G key={`piece-${index}`}>
              <Path d={path} fill={isPlaced ? 'transparent' : `${colors.card}55`} stroke={isPlaced ? `${colors.teal}AA` : `${colors.muted}55`} strokeWidth={2} />
              {isPlaced ? <SvgImage href={IMAGE_SOURCE} x={0} y={0} width={296} height={348} preserveAspectRatio="xMidYMid slice" opacity={0.92} clipPath={`url(#puzzle-piece-${index})`} /> : null}
              {isTray ? <Path d={path} fill="none" stroke={colors.coral} strokeWidth={2} strokeDasharray="4 4" opacity={0.65} /> : null}
            </G>
          );
        })}
      </Svg>
      {placed.length < 6 ? <View style={styles.boardBlur}><AppText variant="tiny" color="#FFFFFF" style={styles.boardBlurText}>A imagem está se formando</AppText></View> : null}
    </View>
  );
}

function MapAvatar({ phase, animateToNext }: { phase: number; animateToNext: number }) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);
  const from = MAP_NODES[Math.max(0, Math.min(MAP_NODES.length - 1, phase - 1))];
  const to = MAP_NODES[Math.max(0, Math.min(MAP_NODES.length - 1, animateToNext - 1))];

  useEffect(() => {
    progress.value = 0;
    if (animateToNext > phase) progress.value = withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) });
    pulse.value = withRepeat(withSequence(withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true);
  }, [animateToNext, phase, progress, pulse]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const middleY = (from.y + to.y) / 2;
    const firstX = from.x + (to.x - from.x) * 0.18;
    const secondX = from.x + (to.x - from.x) * 0.82;
    const x = (1 - t) ** 3 * from.x + 3 * (1 - t) ** 2 * t * firstX + 3 * (1 - t) * t ** 2 * secondX + t ** 3 * to.x;
    const y = (1 - t) ** 3 * from.y + 3 * (1 - t) ** 2 * t * middleY + 3 * (1 - t) * t ** 2 * middleY + t ** 3 * to.y;
    return { transform: [{ translateX: x - 26 }, { translateY: y - 26 }, { scale: pulse.value }] };
  });

  return <Animated.View pointerEvents="none" style={[styles.avatar, style]}><Image source={require('../assets/images/mascot/clock-base.png')} resizeMode="contain" style={styles.avatarImage} /></Animated.View>;
}

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState(4);
  const [animatedPhase, setAnimatedPhase] = useState(4);
  const [selectedPhase, setSelectedPhase] = useState(4);
  const [placed, setPlaced] = useState([0, 1]);
  const [tray, setTray] = useState([2, 3]);
  const [puzzleVisible, setPuzzleVisible] = useState(false);
  const [revealVisible, setRevealVisible] = useState(false);
  const mapPath = useMemo(() => buildMapPath(), []);
  void summary;

  const completeMission = () => {
    if (phase >= 6) {
      setRevealVisible(true);
      return;
    }
    const nextPhase = phase + 1;
    setAnimatedPhase(nextPhase);
    setPhase(nextPhase);
    setSelectedPhase(nextPhase);
    const nextPiece = placed.length + tray.length;
    if (nextPiece < 6) setTray((current) => [...current, nextPiece]);
    setTimeout(() => setPuzzleVisible(true), 900);
  };

  const reset = () => {
    setPhase(4);
    setAnimatedPhase(4);
    setSelectedPhase(4);
    setPlaced([0, 1]);
    setTray([2, 3]);
    setPuzzleVisible(false);
    setRevealVisible(false);
  };

  const selected = MAP_NODES[selectedPhase - 1];
  return (
    <SurfaceCard style={[styles.container, { borderColor: `${colors.teal}65`, paddingBottom: Math.max(18, insets.bottom) }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.teal}1F` }]}><MaterialCommunityIcons name="map-marker-path" size={23} color={colors.teal} /></View>
        <View style={styles.headerCopy}><AppText variant="tiny" color={colors.teal} style={styles.eyebrow}>JORNADA DE BOAS PRÁTICAS</AppText><AppText variant="small" color={colors.muted}>Avance pelas missões e monte o quadro surpresa.</AppText></View>
        <View style={[styles.phaseBadge, { borderColor: `${colors.coral}65`, backgroundColor: `${colors.coral}15` }]}><AppText variant="tiny" color={colors.coral} style={styles.bold}>FASE {phase}/6</AppText></View>
      </View>

      <View style={styles.sectionTitle}><AppText variant="subtitle">Seu caminho desta semana</AppText><AppText variant="tiny" color={colors.muted}>Toque em uma fase para ver o objetivo.</AppText></View>
      <View style={[styles.mapFrame, { backgroundColor: `${colors.deepTeal}0D`, borderColor: `${colors.teal}40` }]}>
        <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.mapScroll} contentOffset={{ x: 0, y: Math.max(0, MAP_HEIGHT - MAP_NODES[phase - 1].y - 430) }}>
          <View style={styles.mapCanvas}>
            <View style={[styles.hill, styles.hillOne, { backgroundColor: `${colors.teal}16` }]} /><View style={[styles.hill, styles.hillTwo, { backgroundColor: `${colors.coral}0D` }]} />
            <Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} style={StyleSheet.absoluteFill}>
              <Path d={mapPath} fill="none" stroke={`${colors.muted}75`} strokeWidth={12} strokeLinecap="round" strokeDasharray="8 14" />
              <Path d={MAP_NODES.slice(0, Math.max(1, phase - 1)).map((node, index) => curveBetween(node, MAP_NODES[index + 1])).join(' ')} fill="none" stroke={colors.teal} strokeWidth={12} strokeLinecap="round" />
            </Svg>
            <MapAvatar phase={phase} animateToNext={animatedPhase} />
            {MAP_NODES.map((node) => {
              const completed = node.id < phase;
              const current = node.id === phase;
              const selectedNode = node.id === selectedPhase;
              return <Pressable key={node.id} onPress={() => setSelectedPhase(node.id)} accessibilityRole="button" accessibilityLabel={`Fase ${node.id}: ${node.title}`} style={[styles.mapNode, { left: node.x - NODE_SIZE / 2, top: node.y - NODE_SIZE / 2 }]}><View style={[styles.node, { width: current ? 68 : NODE_SIZE, height: current ? 68 : NODE_SIZE, borderRadius: current ? 34 : 28, backgroundColor: completed ? colors.teal : current ? `${colors.coral}22` : `${colors.card}DD`, borderColor: selectedNode || current ? colors.coral : completed ? colors.teal : `${colors.muted}75` }]}>{completed ? <MaterialCommunityIcons name="check" size={24} color="#FFFFFF" /> : current ? <AppText variant="subtitle" color={colors.coral} style={styles.bold}>{node.id}</AppText> : <><MaterialCommunityIcons name="lock-outline" size={17} color={colors.muted} /><AppText variant="tiny" color={colors.muted} style={styles.nodeNumber}>{node.id}</AppText></>}</View></Pressable>;
            })}
          </View>
        </ScrollView>
      </View>

      <View style={[styles.missionPanel, { backgroundColor: `${colors.coral}12`, borderColor: `${colors.coral}58` }]}>
        <View style={styles.missionHeading}><AppText variant="tiny" color={colors.coral} style={styles.eyebrow}>{selected.id === phase ? `VOCÊ ESTÁ NA FASE ${phase}` : `FASE ${selected.id}`}</AppText>{selected.id !== phase ? <MaterialCommunityIcons name="information-outline" size={17} color={colors.muted} /> : null}</View>
        <AppText variant="subtitle" style={styles.missionTitle}>{selected.title}</AppText><AppText variant="small" color={colors.muted}>Objetivo: {selected.objective}</AppText>
      </View>

      <View style={styles.boardHeader}><View><AppText variant="subtitle">Quadro surpresa</AppText><AppText variant="tiny" color={colors.muted}>{placed.length + tray.length}/6 peças conquistadas · {tray.length} na bandeja</AppText></View><Pressable onPress={() => setPuzzleVisible(true)} style={[styles.smallButton, { borderColor: colors.teal }]}><MaterialCommunityIcons name="puzzle-outline" size={17} color={colors.teal} /><AppText variant="tiny" color={colors.teal} style={styles.bold}>ABRIR</AppText></Pressable></View>
      <PuzzleBoard placed={placed} tray={tray} colors={colors} />
      <View style={styles.tray}><AppText variant="tiny" color={colors.muted} style={styles.bold}>BANDEJA</AppText><View style={styles.trayPieces}>{tray.map((piece) => <View key={piece} style={[styles.trayPiece, { borderColor: colors.coral, backgroundColor: `${colors.coral}18` }]}><MaterialCommunityIcons name="puzzle-outline" size={19} color={colors.coral} /><AppText variant="tiny" color={colors.coral} style={styles.bold}>{piece + 1}</AppText></View>)}</View></View>

      <View style={styles.actions}><ActionButton title={phase >= 6 ? 'Revelar imagem' : 'Concluir missão'} variant="primary" onPress={completeMission} icon={<MaterialCommunityIcons name="flag-checkered" size={18} color="#FFFFFF" />} /><ActionButton title="Resetar" variant="outline" onPress={reset} icon={<MaterialCommunityIcons name="restart" size={18} color={colors.deepTeal} />} /></View>
      <ActionButton title="Abrir espelho" variant="secondary" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.deepTeal} />} />

      <Modal visible={puzzleVisible} transparent animationType="fade" onRequestClose={() => setPuzzleVisible(false)}><View style={styles.modalBackdrop}><SurfaceCard style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: Math.max(18, insets.bottom) }]}><View style={styles.modalTitle}><MaterialCommunityIcons name="puzzle-outline" size={24} color={colors.coral} /><AppText variant="subtitle">Bandeja de peças</AppText></View><AppText variant="small" color={colors.muted}>Mock visual: as peças ganhas ficam disponíveis para encaixe no quadro.</AppText><PuzzleBoard placed={placed} tray={tray} colors={colors} /><ActionButton title="Encaixar próxima peça" variant="primary" onPress={() => { if (tray.length) { const [next, ...rest] = tray; setTray(rest); setPlaced((current) => [...current, next]); } else setPuzzleVisible(false); }} icon={<MaterialCommunityIcons name="arrow-collapse" size={18} color="#FFFFFF" />} /><ActionButton title="Fechar" variant="outline" onPress={() => setPuzzleVisible(false)} /></SurfaceCard></View></Modal>
      <Modal visible={revealVisible} transparent animationType="fade" onRequestClose={() => setRevealVisible(false)}><View style={styles.modalBackdrop}><SurfaceCard style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: Math.max(18, insets.bottom) }]}><View style={styles.modalTitle}><MaterialCommunityIcons name="image-check-outline" size={24} color={colors.teal} /><AppText variant="subtitle">Imagem revelada</AppText></View><Image source={IMAGE_SOURCE} resizeMode="cover" style={styles.revealImage} /><AppText variant="small" color={colors.muted} style={styles.centerText}>Você completou as seis fases do caminho.</AppText><ActionButton title="Fechar" variant="outline" onPress={() => setRevealVisible(false)} /></SurfaceCard></View></Modal>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { fontWeight: '800', letterSpacing: 1 },
  bold: { fontWeight: '800' },
  phaseBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  sectionTitle: { gap: 3 },
  mapFrame: { height: 540, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  mapScroll: { paddingVertical: 12 },
  mapCanvas: { width: MAP_WIDTH, height: MAP_HEIGHT, alignSelf: 'center', position: 'relative' },
  hill: { position: 'absolute', borderRadius: 999 },
  hillOne: { width: 240, height: 90, top: 830, left: -60 },
  hillTwo: { width: 260, height: 120, top: 460, right: -100 },
  mapNode: { position: 'absolute', width: 70, height: 70, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  node: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, shadowColor: '#071F1D', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  nodeNumber: { position: 'absolute', bottom: 5, fontWeight: '800' },
  avatar: { position: 'absolute', left: 0, top: 0, width: 52, height: 52, zIndex: 8, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 48, height: 48 },
  missionPanel: { borderWidth: 1, borderRadius: 17, padding: 13, gap: 4 },
  missionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missionTitle: { fontWeight: '800' },
  boardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  smallButton: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', gap: 5, alignItems: 'center' },
  boardShell: { alignSelf: 'center', width: '100%', maxWidth: 330, borderWidth: 1, borderRadius: 20, padding: 10, alignItems: 'center', overflow: 'hidden' },
  boardBlur: { position: 'absolute', left: 10, right: 10, top: 10, bottom: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,22,24,0.25)' },
  boardBlurText: { backgroundColor: 'rgba(4,22,24,0.72)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, fontWeight: '700' },
  tray: { borderRadius: 14, padding: 10, gap: 8, backgroundColor: 'rgba(4,22,24,0.06)' },
  trayPieces: { flexDirection: 'row', gap: 8 },
  trayPiece: { width: 52, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  actions: { flexDirection: 'row', gap: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,22,24,0.82)', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 12, borderRadius: 24 },
  modalTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  revealImage: { width: '100%', height: 260, borderRadius: 18 },
  centerText: { textAlign: 'center' },
});
