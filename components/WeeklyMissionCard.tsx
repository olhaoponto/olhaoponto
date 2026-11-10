import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, PanResponder, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { useAppStore } from '@/store/app-store';
import type { WeeklyMissionSummary } from '@/utils/weekly-mission';
import { formatMinutesHHMM } from '@/utils/work-time';

const MAP_STOPS = [
  { label: 'Começo', icon: 'flag-outline' as const },
  { label: 'Entrada certa', icon: 'clock-check-outline' as const },
  { label: 'Pausa respeitada', icon: 'coffee-outline' as const },
  { label: 'Ajuda um colega', icon: 'account-heart-outline' as const },
  { label: 'Espelho revisado', icon: 'file-check-outline' as const },
  { label: 'Descanso', icon: 'home-heart' as const },
];
const PUZZLE_KEY = (userId: string) => `olhaponto:${userId}:puzzle-pieces`;

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors();
  const userId = useAppStore((state) => state.session?.user.id ?? null);
  const ratio = Math.min(1, summary.completed / Math.max(1, summary.goal));
  const complete = summary.completed >= summary.goal;
  const currentStop = Math.min(MAP_STOPS.length - 1, Math.round(ratio * (MAP_STOPS.length - 1)));
  const [levelUp, setLevelUp] = useState(false);
  const [puzzleVisible, setPuzzleVisible] = useState(false);
  const [placedPieces, setPlacedPieces] = useState(0);
  const [puzzleLoaded, setPuzzleLoaded] = useState(!userId);
  const [pulse] = useState(() => new Animated.Value(1));
  const previousCompleted = useRef(summary.completed);

  useEffect(() => {
    if (!userId) return;
    void AsyncStorage.getItem(PUZZLE_KEY(userId)).then((value) => {
      const count = Number(value ?? 0);
      setPlacedPieces(Number.isFinite(count) ? Math.max(0, Math.min(6, count)) : 0);
      setPuzzleLoaded(true);
    }).catch(() => setPuzzleLoaded(true));
  }, [userId]);

  useEffect(() => {
    if (!puzzleLoaded) return;
    if (summary.completed > previousCompleted.current) {
      setLevelUp(true);
      if (summary.completed > placedPieces) setTimeout(() => setPuzzleVisible(true), 0);
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.2, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(() => setLevelUp(false), 2400);
      previousCompleted.current = summary.completed;
      return () => clearTimeout(timer);
    }
    previousCompleted.current = summary.completed;
  }, [placedPieces, pulse, puzzleLoaded, summary.completed]);

  const completePiece = async () => {
    const next = Math.min(6, placedPieces + 1);
    setPlacedPieces(next);
    if (userId) await AsyncStorage.setItem(PUZZLE_KEY(userId), String(next)).catch(() => undefined);
    setPuzzleVisible(false);
  };

  return (
    <SurfaceCard style={{ gap: 13, borderColor: `${colors.teal}65`, overflow: 'hidden' }}>
      <ConfettiBurst visible={levelUp} />
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="map-marker-path" size={23} color={colors.deepTeal} /></View>
        <View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800', letterSpacing: 1 }}>MAPA DE BOAS PRÁTICAS</AppText><AppText variant="tiny" color={colors.muted}>Cada fase cuida do seu tempo e ajuda o time.</AppText></View>
        <View style={[styles.phasePill, { backgroundColor: `${colors.coral}18` }]}><AppText variant="tiny" color={colors.coral} style={{ fontWeight: '800' }}>FASE {currentStop + 1}</AppText></View>
      </View>
      <View style={{ gap: 4 }}><AppText variant="subtitle">Seu caminho desta semana</AppText><AppText variant="small" color={colors.muted}>Avance com registros corretos, pausa respeitada, convite ou lembrete enviado e revisão do espelho. Nada de saldo negativo ou hora extra para passar de fase.</AppText></View>

      <View style={[styles.map, { backgroundColor: `${colors.deepTeal}08`, borderColor: `${colors.teal}30` }]}>
        <View style={[styles.road, { borderColor: `${colors.teal}42` }]} />
        {MAP_STOPS.map((stop, index) => {
          const reached = index <= currentStop;
          const isCurrent = index === currentStop;
          const top = 16 + index * 15.5;
          const left = index % 2 === 0 ? 25 : 75;
          return <View key={stop.label} style={[styles.stop, { top: `${top}%`, left: `${left}%` }]}>
            <Animated.View style={[styles.node, { backgroundColor: reached ? colors.deepTeal : colors.card, borderColor: reached ? colors.deepTeal : colors.border, transform: [{ scale: isCurrent ? pulse : 1 }] }]}><MaterialCommunityIcons name={reached ? 'check' : stop.icon} size={18} color={reached ? '#FFFFFF' : colors.muted} /></Animated.View>
            <View style={[styles.stopLabel, { backgroundColor: colors.card, borderColor: isCurrent ? `${colors.coral}75` : colors.border }]}><AppText variant="tiny" color={isCurrent ? colors.deepTeal : colors.muted} style={isCurrent ? { fontWeight: '800' } : undefined}>{isCurrent ? 'VOCÊ ESTÁ AQUI' : stop.label}</AppText></View>
          </View>;
        })}
        <View style={[styles.mapHeader, { backgroundColor: colors.card, borderColor: colors.border }]}><MaterialCommunityIcons name={complete ? 'flag-checkered' : 'compass-outline'} size={16} color={colors.coral} /><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800' }}>{complete ? 'MAPA CONCLUÍDO' : `PRÓXIMA: ${MAP_STOPS[Math.min(MAP_STOPS.length - 1, currentStop + 1)].label.toUpperCase()}`}</AppText></View>
        {levelUp ? <View style={[styles.levelUp, { backgroundColor: colors.deepTeal }]}><MaterialCommunityIcons name="puzzle-outline" size={16} color={colors.yellow} /><AppText variant="tiny" color="#FFFFFF" style={{ fontWeight: '800' }}>PEÇA DESBLOQUEADA</AppText></View> : null}
      </View>

      <View style={styles.puzzleSummary}>
        <View style={[styles.previewFrame, { borderColor: `${colors.teal}45`, backgroundColor: `${colors.deepTeal}08` }]}><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.previewImage} /><View style={styles.previewShade} /><MaterialCommunityIcons name="puzzle-outline" size={20} color="#FFFFFF" /></View>
        <View style={{ flex: 1, gap: 3 }}><AppText variant="small" style={{ fontWeight: '800' }}>Quadro do descanso</AppText><AppText variant="tiny" color={colors.muted}>{placedPieces}/6 peças montadas. A próxima peça só aparece quando uma nova fase for concluída.</AppText></View>
      </View>

      <View style={{ gap: 7 }}><View style={styles.progressHeader}><AppText variant="small" style={{ fontWeight: '700' }}>Fases concluídas</AppText><AppText variant="small" color={colors.deepTeal} style={{ fontWeight: '800' }}>{summary.completed}/{summary.goal}</AppText></View><View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: complete ? colors.teal : colors.coral }]} /></View></View>
      <View style={[styles.practiceRow, { borderColor: colors.border }]}><MaterialCommunityIcons name="shield-check-outline" size={19} color={colors.deepTeal} /><AppText variant="tiny" color={colors.muted} style={{ flex: 1 }}>Boas práticas: bater entrada e saída, respeitar a pausa, revisar o espelho e ajudar sem pressionar colegas.</AppText></View>
      {summary.balanceMinutes < 0 ? <View style={[styles.guidance, { backgroundColor: `${colors.warning}20`, borderColor: `${colors.warning}60` }]}><MaterialCommunityIcons name="hand-heart-outline" size={20} color={colors.deepTeal} /><AppText variant="tiny" style={{ flex: 1 }} color={colors.foreground}>Diferença estimada de {formatMinutesHHMM(Math.abs(summary.balanceMinutes))}. Confira o espelho; isso não remove sua progressão.</AppText></View> : null}
      <ActionButton title="Revisar meu espelho" variant="outline" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-check-outline" size={18} color={colors.deepTeal} />} />
      <PuzzleRewardModal visible={puzzleVisible} pieceIndex={placedPieces} onClose={() => setPuzzleVisible(false)} onPlaced={() => void completePiece()} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  phasePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  map: { height: 390, borderRadius: 24, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  road: { position: 'absolute', width: 2, top: '12%', bottom: '8%', left: '50%', borderLeftWidth: 2, borderStyle: 'dashed' },
  stop: { position: 'absolute', width: 118, alignItems: 'center', gap: 4, transform: [{ translateX: -59 }, { translateY: -20 }] },
  node: { width: 45, height: 45, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#071F1D', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  stopLabel: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 5 },
  mapHeader: { position: 'absolute', top: 11, left: 11, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  levelUp: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  practiceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderWidth: 1, borderRadius: 13 },
  guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 13, borderWidth: 1 },
  puzzleSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewFrame: { width: 64, height: 54, borderRadius: 14, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewImage: { ...StyleSheet.absoluteFill, width: 64, height: 54 },
  previewShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,22,24,0.38)' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4, 22, 24, 0.72)', justifyContent: 'center', padding: 20 },
  puzzleModal: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 13 },
  modalTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  puzzleBoard: { height: 270, borderWidth: 1, borderRadius: 20, position: 'relative', overflow: 'hidden' },
  boardImage: { position: 'absolute', left: 0, top: 0, width: 280, height: 220, opacity: 0.24 },
  puzzleTarget: { position: 'absolute', top: 48, right: 34, width: 76, height: 76, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  targetImage: { position: 'absolute', width: 280, height: 220, left: -170, top: -48 },
  puzzlePiece: { position: 'absolute', top: 0, left: 0, width: 76, height: 76, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pieceImage: { position: 'absolute', width: 280, height: 220, left: -170, top: -48 },
});

function PuzzleRewardModal({ visible, pieceIndex, onClose, onPlaced }: { visible: boolean; pieceIndex: number; onClose: () => void; onPlaced: () => void }) {
  const colors = useAppColors();
  const [placed, setPlaced] = useState(false);
  const [position] = useState(() => new Animated.ValueXY({ x: 22, y: 178 }));
  const start = useRef({ x: 22, y: 178 });
  const current = useRef({ x: 22, y: 178 });
  const placedRef = useRef(false);
  // PanResponder precisa ser criado uma vez para manter o gesto contínuo durante o arraste.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !placedRef.current,
    onStartShouldSetPanResponderCapture: () => !placedRef.current,
    onMoveShouldSetPanResponder: () => !placedRef.current,
    onMoveShouldSetPanResponderCapture: () => !placedRef.current,
    onPanResponderGrant: () => { start.current = { ...current.current }; },
    onPanResponderMove: (_, gesture) => { current.current = { x: start.current.x + gesture.dx, y: start.current.y + gesture.dy }; position.setValue(current.current); },
    onPanResponderRelease: (_, gesture) => {
      const x = start.current.x + gesture.dx;
      const y = start.current.y + gesture.dy;
      if (x > 145 && y < 110) {
        placedRef.current = true;
        setPlaced(true);
        current.current = { x: 170, y: 48 };
        Animated.spring(position, { toValue: current.current, useNativeDriver: false }).start();
      } else { current.current = { x: 22, y: 178 }; Animated.spring(position, { toValue: current.current, useNativeDriver: false }).start(); }
    },
  }));
  useEffect(() => { if (!visible) { placedRef.current = false; current.current = { x: 22, y: 178 }; position.setValue(current.current); setTimeout(() => setPlaced(false), 0); } }, [position, visible]);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><SurfaceCard style={[styles.puzzleModal, { backgroundColor: colors.card }]}>
      <View style={styles.modalTitle}><MaterialCommunityIcons name="puzzle-outline" size={25} color={colors.coral} /><AppText variant="subtitle">Peça {pieceIndex + 1} desbloqueada!</AppText></View>
      <AppText variant="small" color={colors.muted}>Esta peça faz parte do quadro “Descanso na praia”. Arraste com o dedo até o encaixe tracejado. Ela fica montada e não será mostrada novamente.</AppText>
      <View style={[styles.puzzleBoard, { borderColor: `${colors.teal}55`, backgroundColor: `${colors.deepTeal}0A` }]}>
        <Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.boardImage} />
        <View style={[styles.puzzleTarget, { borderColor: colors.coral }]}><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.targetImage} /></View>
        <Animated.View {...panResponder.panHandlers} style={[styles.puzzlePiece, { backgroundColor: colors.deepTeal, transform: position.getTranslateTransform() }]}><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.pieceImage} /><View style={styles.previewShade} /><MaterialCommunityIcons name="puzzle-outline" size={25} color="#FFFFFF" /></Animated.View>
      </View>
      {placed ? <AppText variant="small" color={colors.deepTeal} style={{ textAlign: 'center', fontWeight: '800' }}>Peça encaixada no quadro. Próxima peça virá com o próximo desafio.</AppText> : <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Toque e arraste a peça para cima e para a direita.</AppText>}
      <ActionButton title={placed ? 'Montar peça no quadro' : 'Deixar para depois'} variant={placed ? 'secondary' : 'outline'} onPress={placed ? onPlaced : onClose} />
    </SurfaceCard></View>
  </Modal>;
}
