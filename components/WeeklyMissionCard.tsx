import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { useAppStore } from '@/store/app-store';
import type { WeeklyMissionSummary } from '@/utils/weekly-mission';
import { formatMinutesHHMM } from '@/utils/work-time';

const MAP_STOPS = [
  { title: 'Saída', objective: 'Comece registrando seu ponto', icon: 'flag-outline' as const },
  { title: 'Entrada certa', objective: 'Registre a entrada no horário', icon: 'clock-check-outline' as const },
  { title: 'Pausa respeitada', objective: 'Registre saída e volta do almoço', icon: 'coffee-outline' as const },
  { title: 'Ajude um colega', objective: 'Envie um convite ou lembrete', icon: 'account-heart-outline' as const },
  { title: 'Revise o espelho', objective: 'Confira e confirme seu espelho', icon: 'file-check-outline' as const },
  { title: 'Descanso conquistado', objective: 'Complete a jornada da semana', icon: 'home-heart' as const },
];
const PUZZLE_KEY = (userId: string) => `olhaponto:${userId}:puzzle-pieces`;
const MIRROR_KEY = (userId: string, week: string) => `olhaponto:${userId}:mirror-reviewed:${week}`;

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors();
  const userId = useAppStore((state) => state.session?.user.id ?? null);
  const ratio = Math.min(1, summary.completed / Math.max(1, summary.goal));
  const complete = summary.completed >= summary.goal;
  const currentStop = Math.min(MAP_STOPS.length - 1, Math.round(ratio * (MAP_STOPS.length - 1)));
  const [levelUp, setLevelUp] = useState(false);
  const [puzzleVisible, setPuzzleVisible] = useState(false);
  const [boardVisible, setBoardVisible] = useState(false);
  const [placedPieces, setPlacedPieces] = useState(0);
  const [mirrorReviewed, setMirrorReviewed] = useState(false);
  const [puzzleLoaded, setPuzzleLoaded] = useState(!userId);
  const [pulse] = useState(() => new Animated.Value(1));
  const previousCompleted = useRef(summary.completed);
  const weekKey = summary.startDate;

  useEffect(() => {
    if (!userId) return;
    Promise.all([AsyncStorage.getItem(PUZZLE_KEY(userId)), AsyncStorage.getItem(MIRROR_KEY(userId, weekKey))]).then(([pieces, reviewed]) => {
      const count = Number(pieces ?? 0);
      setPlacedPieces(Number.isFinite(count) ? Math.max(0, Math.min(6, count)) : 0);
      setMirrorReviewed(reviewed === 'true');
      setPuzzleLoaded(true);
    }).catch(() => setPuzzleLoaded(true));
  }, [userId, weekKey]);

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

  const confirmMirrorReview = async () => {
    setMirrorReviewed(true);
    if (userId) await AsyncStorage.setItem(MIRROR_KEY(userId, weekKey), 'true').catch(() => undefined);
    if (placedPieces < 6) setPuzzleVisible(true);
  };

  return (
    <SurfaceCard style={{ gap: 13, borderColor: `${colors.teal}65`, overflow: 'hidden' }}>
      <ConfettiBurst visible={levelUp} />
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="map-marker-path" size={23} color={colors.deepTeal} /></View>
        <View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800', letterSpacing: 1 }}>JORNADA DE BOAS PRÁTICAS</AppText><AppText variant="tiny" color={colors.muted}>Complete tarefas reais para avançar de fase.</AppText></View>
        <View style={[styles.phasePill, { backgroundColor: `${colors.coral}18` }]}><AppText variant="tiny" color={colors.coral} style={{ fontWeight: '800' }}>FASE {currentStop + 1}</AppText></View>
      </View>

      <View style={{ gap: 4 }}><AppText variant="subtitle">Seu caminho desta semana</AppText><AppText variant="small" color={colors.muted}>Você não está apenas vendo um marcador: está na fase abaixo. Cada objetivo concluído abre o próximo trecho e libera uma peça do quadro.</AppText></View>

      <View style={[styles.map, { backgroundColor: `${colors.deepTeal}08`, borderColor: `${colors.teal}35` }]}>
        <View style={[styles.mapTop, { backgroundColor: colors.card, borderColor: colors.border }]}><MaterialCommunityIcons name="map-outline" size={17} color={colors.coral} /><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800' }}>{complete ? 'JORNADA CONCLUÍDA' : `OBJETIVO ATUAL: ${MAP_STOPS[currentStop].title.toUpperCase()}`}</AppText></View>
        <View style={[styles.routeLine, { borderColor: `${colors.teal}55` }]} />
        {MAP_STOPS.map((stop, index) => {
          const reached = index < currentStop;
          const isCurrent = index === currentStop;
          const left = index % 2 === 0 ? '27%' : '73%';
          const top = `${15 + index * 15.2}%` as `${number}%`;
          return <View key={stop.title} style={[styles.mapStop, { left, top }]}>
            <View style={[styles.node, { backgroundColor: reached ? colors.deepTeal : colors.card, borderColor: isCurrent ? colors.coral : reached ? colors.deepTeal : colors.border, transform: [{ scale: isCurrent ? pulse : 1 }] }]}>
              {isCurrent ? <Image source={require('../assets/images/mascot/clock-base.png')} resizeMode="contain" style={styles.mascotOnMap} /> : <MaterialCommunityIcons name={reached ? 'check' : stop.icon} size={19} color={reached ? '#FFFFFF' : colors.muted} />}
            </View>
            <View style={[styles.stopCard, { backgroundColor: colors.card, borderColor: isCurrent ? `${colors.coral}80` : colors.border }]}>
              <AppText variant="tiny" color={isCurrent ? colors.deepTeal : colors.muted} style={{ fontWeight: '800' }}>{`FASE ${index + 1}${isCurrent ? ' • VOCÊ ESTÁ AQUI' : ''}`}</AppText>
              <AppText variant="small" style={{ fontWeight: isCurrent ? '800' : '600' }}>{stop.title}</AppText>
              <AppText variant="tiny" color={colors.muted}>{stop.objective}</AppText>
            </View>
          </View>;
        })}
        {levelUp ? <View style={[styles.levelUp, { backgroundColor: colors.deepTeal }]}><MaterialCommunityIcons name="puzzle-outline" size={16} color={colors.yellow} /><AppText variant="tiny" color="#FFFFFF" style={{ fontWeight: '800' }}>NOVA FASE! PEÇA DESBLOQUEADA</AppText></View> : null}
      </View>

      <View style={[styles.currentMission, { backgroundColor: `${colors.coral}10`, borderColor: `${colors.coral}55` }]}><Image source={require('../assets/images/mascot/clock-base.png')} resizeMode="contain" style={styles.missionMascot} /><View style={{ flex: 1, gap: 3 }}><AppText variant="tiny" color={colors.coral} style={{ fontWeight: '800' }}>VOCÊ ESTÁ NA FASE {currentStop + 1}</AppText><AppText variant="small" style={{ fontWeight: '800' }}>{MAP_STOPS[currentStop].title}</AppText><AppText variant="tiny" color={colors.muted}>Objetivo: {MAP_STOPS[currentStop].objective}.</AppText></View></View>

      <View style={styles.puzzleSummary}>
        <View style={[styles.previewFrame, { borderColor: `${colors.teal}45`, backgroundColor: `${colors.deepTeal}08` }]}><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.previewImage} /><View style={styles.previewShade} /><MaterialCommunityIcons name="puzzle-outline" size={20} color="#FFFFFF" /></View>
        <View style={{ flex: 1, gap: 3 }}><AppText variant="small" style={{ fontWeight: '800' }}>Quadro do descanso</AppText><AppText variant="tiny" color={colors.muted}>{placedPieces}/6 peças montadas. {mirrorReviewed ? 'Espelho confirmado nesta semana.' : 'A peça vem depois da tarefa ser confirmada.'}</AppText></View>
        {placedPieces > 0 ? <Pressable onPress={() => setBoardVisible(true)} accessibilityRole="button" accessibilityLabel="Visualizar quadro montado" style={[styles.viewBoardButton, { borderColor: colors.deepTeal }]}><MaterialCommunityIcons name="image-search-outline" size={18} color={colors.deepTeal} /><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800' }}>VER QUADRO</AppText></Pressable> : null}
      </View>

      <View style={{ gap: 7 }}><View style={styles.progressHeader}><AppText variant="small" style={{ fontWeight: '700' }}>Fases do acompanhamento</AppText><AppText variant="small" color={colors.deepTeal} style={{ fontWeight: '800' }}>{summary.completed}/{summary.goal}</AppText></View><View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: complete ? colors.teal : colors.coral }]} /></View></View>

      <View style={[styles.mirrorMission, { borderColor: mirrorReviewed ? `${colors.teal}70` : colors.border, backgroundColor: mirrorReviewed ? `${colors.teal}10` : colors.card }]}><MaterialCommunityIcons name={mirrorReviewed ? 'check-circle' : 'file-search-outline'} size={22} color={mirrorReviewed ? colors.teal : colors.coral} /><View style={{ flex: 1, gap: 3 }}><AppText variant="small" style={{ fontWeight: '800' }}>{mirrorReviewed ? 'Espelho revisado nesta semana' : 'Missão atual: revisar o espelho'}</AppText><AppText variant="tiny" color={colors.muted}>{mirrorReviewed ? 'Você confirmou esta etapa e a recompensa já foi liberada.' : 'Abra o espelho, confira suas batidas e depois confirme aqui para liberar uma peça.'}</AppText></View></View>
      <View style={styles.actionRow}><ActionButton title="Abrir espelho" variant="outline" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.deepTeal} />} /><ActionButton title={mirrorReviewed ? 'Peça já liberada' : 'Conferi e ganhar peça'} variant={mirrorReviewed ? 'secondary' : 'primary'} onPress={() => void confirmMirrorReview()} disabled={mirrorReviewed} icon={<MaterialCommunityIcons name={mirrorReviewed ? 'check' : 'puzzle-outline'} size={18} color={mirrorReviewed ? colors.deepTeal : '#FFFFFF'} />} /></View>
      {summary.balanceMinutes < 0 ? <View style={[styles.guidance, { backgroundColor: `${colors.warning}20`, borderColor: `${colors.warning}60` }]}><MaterialCommunityIcons name="hand-heart-outline" size={20} color={colors.deepTeal} /><AppText variant="tiny" style={{ flex: 1 }} color={colors.foreground}>Diferença estimada de {formatMinutesHHMM(Math.abs(summary.balanceMinutes))}. Confira o espelho; isso não remove sua progressão.</AppText></View> : null}
      <PuzzleRewardModal visible={puzzleVisible} pieceIndex={placedPieces} onClose={() => setPuzzleVisible(false)} onPlaced={() => void completePiece()} />
      <BoardPreviewModal visible={boardVisible} onClose={() => setBoardVisible(false)} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  phasePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  map: { height: 500, borderRadius: 24, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  mapTop: { position: 'absolute', top: 11, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, zIndex: 3 },
  routeLine: { position: 'absolute', width: 2, top: '12%', bottom: '8%', left: '50%', borderLeftWidth: 2, borderStyle: 'dashed' },
  mapStop: { position: 'absolute', width: 148, alignItems: 'center', transform: [{ translateX: -74 }, { translateY: -20 }], gap: 5, zIndex: 2 },
  node: { width: 48, height: 48, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#071F1D', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  mascotOnMap: { width: 39, height: 39 },
  stopCard: { width: 142, borderRadius: 13, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 7, gap: 2 },
  levelUp: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, zIndex: 4 },
  currentMission: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 15, borderWidth: 1 },
  missionMascot: { width: 45, height: 45 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  puzzleSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewFrame: { width: 64, height: 54, borderRadius: 14, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewImage: { ...StyleSheet.absoluteFill, width: 64, height: 54 },
  previewShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,22,24,0.38)' },
  viewBoardButton: { alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 11, paddingHorizontal: 8, paddingVertical: 7 },
  mirrorMission: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 14, borderWidth: 1 },
  actionRow: { flexDirection: 'row', gap: 8 },
  guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 13, borderWidth: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4, 22, 24, 0.72)', justifyContent: 'center', padding: 20 },
  puzzleModal: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 13 },
  modalTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  puzzleBoard: { height: 270, borderWidth: 1, borderRadius: 20, position: 'relative', overflow: 'hidden' },
  boardImage: { position: 'absolute', left: 0, top: 0, width: 280, height: 220, opacity: 0.24 },
  puzzleTarget: { position: 'absolute', top: 48, right: 34, width: 76, height: 76, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  targetImage: { position: 'absolute', width: 280, height: 220, left: -170, top: -48 },
  puzzlePiece: { position: 'absolute', top: 0, left: 0, width: 76, height: 76, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pieceImage: { position: 'absolute', width: 280, height: 220, left: -170, top: -48 },
  boardModal: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 13, alignItems: 'center' },
  boardLargeImage: { width: '100%', height: 350, borderRadius: 20 },
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
      if (x > 145 && y < 110) { placedRef.current = true; setPlaced(true); current.current = { x: 170, y: 48 }; Animated.spring(position, { toValue: current.current, useNativeDriver: false }).start(); }
      else { current.current = { x: 22, y: 178 }; Animated.spring(position, { toValue: current.current, useNativeDriver: false }).start(); }
    },
  }));
  useEffect(() => { if (!visible) { placedRef.current = false; current.current = { x: 22, y: 178 }; position.setValue(current.current); setTimeout(() => setPlaced(false), 0); } }, [position, visible]);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><SurfaceCard style={[styles.puzzleModal, { backgroundColor: colors.card }]}><View style={styles.modalTitle}><MaterialCommunityIcons name="puzzle-outline" size={25} color={colors.coral} /><AppText variant="subtitle">Peça {pieceIndex + 1} desbloqueada!</AppText></View><AppText variant="small" color={colors.muted}>Arraste a peça até o encaixe tracejado. Depois confirme para guardar a recompensa no quadro.</AppText><View style={[styles.puzzleBoard, { borderColor: `${colors.teal}55`, backgroundColor: `${colors.deepTeal}0A` }]}><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.boardImage} /><View style={[styles.puzzleTarget, { borderColor: colors.coral }]}><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.targetImage} /></View><Animated.View {...panResponder.panHandlers} style={[styles.puzzlePiece, { backgroundColor: colors.deepTeal, transform: position.getTranslateTransform() }]}><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="cover" style={styles.pieceImage} /><View style={styles.previewShade} /><MaterialCommunityIcons name="puzzle-outline" size={25} color="#FFFFFF" /></Animated.View></View>{placed ? <AppText variant="small" color={colors.deepTeal} style={{ textAlign: 'center', fontWeight: '800' }}>Peça encaixada. Ela ficará salva no seu quadro.</AppText> : <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Toque e arraste a peça para cima e para a direita.</AppText>}<ActionButton title={placed ? 'Montar peça no quadro' : 'Deixar para depois'} variant={placed ? 'secondary' : 'outline'} onPress={placed ? onPlaced : onClose} /></SurfaceCard></View></Modal>;
}

function BoardPreviewModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useAppColors();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><SurfaceCard style={[styles.boardModal, { backgroundColor: colors.card }]}><View style={styles.modalTitle}><MaterialCommunityIcons name="image-search-outline" size={25} color={colors.deepTeal} /><AppText variant="subtitle">Seu quadro montado</AppText></View><Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="contain" style={styles.boardLargeImage} /><AppText variant="small" color={colors.muted} style={{ textAlign: 'center' }}>Continue cumprindo as missões para completar a imagem do descanso.</AppText><ActionButton title="Fechar quadro" variant="outline" onPress={onClose} /></SurfaceCard></View></Modal>;
}
