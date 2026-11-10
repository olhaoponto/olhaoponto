import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import type { WeeklyMissionSummary } from '@/utils/weekly-mission';
import { formatMinutesHHMM } from '@/utils/work-time';

const MAP_STOPS = [
  { label: 'Começo', icon: 'flag-outline' as const, top: 88, left: 23 },
  { label: 'Entrada certa', icon: 'clock-check-outline' as const, top: 68, left: 77 },
  { label: 'Pausa', icon: 'coffee-outline' as const, top: 48, left: 23 },
  { label: 'Espelho revisado', icon: 'file-check-outline' as const, top: 28, left: 77 },
  { label: 'Descanso', icon: 'home-heart' as const, top: 8, left: 23 },
];

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors();
  const ratio = Math.min(1, summary.completed / Math.max(1, summary.goal));
  const complete = summary.completed >= summary.goal;
  const currentStop = Math.min(MAP_STOPS.length - 1, Math.round(ratio * (MAP_STOPS.length - 1)));
  const [levelUp, setLevelUp] = useState(false);
  const [puzzleVisible, setPuzzleVisible] = useState(false);
  const [pulse] = useState(() => new Animated.Value(1));
  const previousCompleted = useRef(summary.completed);

  useEffect(() => {
    if (summary.completed > previousCompleted.current) {
      setLevelUp(true);
      setPuzzleVisible(true);
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.22, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(() => setLevelUp(false), 2400);
      previousCompleted.current = summary.completed;
      return () => clearTimeout(timer);
    }
    previousCompleted.current = summary.completed;
  }, [pulse, summary.completed]);

  return (
    <SurfaceCard style={{ gap: 13, borderColor: `${colors.teal}65`, overflow: 'hidden' }}>
      <ConfettiBurst visible={levelUp} />
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="map-marker-path" size={23} color={colors.deepTeal} /></View>
        <View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800', letterSpacing: 1 }}>MAPA DE BOAS PRÁTICAS</AppText><AppText variant="tiny" color={colors.muted}>Você avança organizando o dia, não trabalhando além da conta.</AppText></View>
        <View style={[styles.phasePill, { backgroundColor: `${colors.coral}18` }]}><AppText variant="tiny" color={colors.coral} style={{ fontWeight: '800' }}>FASE {currentStop + 1}</AppText></View>
      </View>

      <View style={{ gap: 4 }}><AppText variant="subtitle">Seu caminho desta semana</AppText><AppText variant="small" color={colors.muted}>Cada registro correto move o mascote para a próxima placa. Lembretes e convites ajudam o time, mas nunca retiram pontos.</AppText></View>

      <View style={[styles.map, { backgroundColor: `${colors.deepTeal}08`, borderColor: `${colors.teal}30` }]}>
        <View style={[styles.road, { borderColor: `${colors.teal}42` }]} />
        {MAP_STOPS.map((stop, index) => {
          const reached = index <= currentStop;
          const isCurrent = index === currentStop;
          return <View key={stop.label} style={[styles.stop, { top: `${stop.top}%`, left: `${stop.left}%` }]}>
            <Animated.View style={[styles.node, { backgroundColor: reached ? colors.deepTeal : colors.card, borderColor: reached ? colors.deepTeal : colors.border, transform: [{ scale: isCurrent ? pulse : 1 }] }]}><MaterialCommunityIcons name={reached ? 'check' : stop.icon} size={18} color={reached ? '#FFFFFF' : colors.muted} /></Animated.View>
            <View style={[styles.stopLabel, { backgroundColor: colors.card, borderColor: isCurrent ? `${colors.coral}75` : colors.border }]}><AppText variant="tiny" color={isCurrent ? colors.deepTeal : colors.muted} style={isCurrent && { fontWeight: '800' }}>{isCurrent ? 'VOCÊ ESTÁ AQUI' : stop.label}</AppText></View>
          </View>;
        })}
        <View style={[styles.mapHeader, { backgroundColor: colors.card, borderColor: colors.border }]}><MaterialCommunityIcons name={complete ? 'flag-checkered' : 'compass-outline'} size={16} color={colors.coral} /><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800' }}>{complete ? 'FASE CONCLUÍDA' : `PRÓXIMA: ${MAP_STOPS[Math.min(MAP_STOPS.length - 1, currentStop + 1)].label.toUpperCase()}`}</AppText></View>
        {levelUp ? <View style={[styles.levelUp, { backgroundColor: colors.deepTeal }]}><MaterialCommunityIcons name="star-four-points-outline" size={16} color={colors.yellow} /><AppText variant="tiny" color="#FFFFFF" style={{ fontWeight: '800' }}>FASE DESBLOQUEADA</AppText></View> : null}
      </View>

      <View style={{ gap: 7 }}><View style={styles.progressHeader}><AppText variant="small" style={{ fontWeight: '700' }}>Trechos concluídos</AppText><AppText variant="small" color={colors.deepTeal} style={{ fontWeight: '800' }}>{summary.completed}/{summary.goal}</AppText></View><View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: complete ? colors.teal : colors.coral }]} /></View></View>
      <View style={[styles.practiceRow, { borderColor: colors.border }]}><MaterialCommunityIcons name="shield-check-outline" size={19} color={colors.deepTeal} /><AppText variant="tiny" color={colors.muted} style={{ flex: 1 }}>Boas práticas: bater entrada e saída, respeitar a pausa, revisar o espelho e ajudar um colega a não esquecer.</AppText></View>
      {complete ? <AppText variant="small" color={colors.deepTeal}>Você chegou ao descanso. A próxima semana começa sem saldo negativo e sem punição retroativa.</AppText> : <AppText variant="tiny" color={colors.muted}>O próximo trecho aparece ao resolver mais um dia da semana.</AppText>}
      {summary.balanceMinutes < 0 ? <View style={[styles.guidance, { backgroundColor: `${colors.warning}20`, borderColor: `${colors.warning}60` }]}><MaterialCommunityIcons name="hand-heart-outline" size={20} color={colors.deepTeal} /><AppText variant="tiny" style={{ flex: 1 }} color={colors.foreground}>Diferença estimada de {formatMinutesHHMM(Math.abs(summary.balanceMinutes))}. Confira o espelho e combine com o RH; isso não remove sua progressão.</AppText></View> : summary.balanceMinutes > 0 ? <AppText variant="tiny" color={colors.muted}>A diferença estimada não é o saldo oficial da empresa e não dá pontos extras.</AppText> : null}
      <ActionButton title="Revisar meu espelho" variant="outline" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-check-outline" size={18} color={colors.deepTeal} />} />
      <PuzzleRewardModal visible={puzzleVisible} onClose={() => setPuzzleVisible(false)} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  phasePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  map: { height: 330, borderRadius: 24, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  road: { position: 'absolute', width: 2, top: '12%', bottom: '7%', left: '50%', borderLeftWidth: 2, borderStyle: 'dashed' },
  stop: { position: 'absolute', width: 82, alignItems: 'center', gap: 4, transform: [{ translateX: -41 }, { translateY: -20 }] },
  node: { width: 43, height: 43, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#071F1D', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  stopLabel: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  mapHeader: { position: 'absolute', top: 11, left: 11, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  levelUp: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  practiceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderWidth: 1, borderRadius: 13 },
  guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 13, borderWidth: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4, 22, 24, 0.72)', justifyContent: 'center', padding: 20 },
  puzzleModal: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 13 },
  modalTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  puzzleBoard: { height: 270, borderWidth: 1, borderRadius: 20, position: 'relative', overflow: 'hidden' },
  puzzleTarget: { position: 'absolute', top: 46, right: 42, width: 78, height: 78, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  puzzlePiece: { position: 'absolute', top: 0, left: 0, width: 70, height: 70, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

function PuzzleRewardModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useAppColors();
  const [placed, setPlaced] = useState(false);
  const [position] = useState(() => new Animated.ValueXY({ x: 18, y: 180 }));
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !placed,
    onMoveShouldSetPanResponder: () => !placed,
    onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 100 && gesture.dy < -35) {
        setPlaced(true);
        Animated.spring(position, { toValue: { x: 166, y: 50 }, useNativeDriver: false }).start();
      } else Animated.spring(position, { toValue: { x: 18, y: 180 }, useNativeDriver: false }).start();
    },
  });
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><SurfaceCard style={[styles.puzzleModal, { backgroundColor: colors.card }]}>
      <View style={styles.modalTitle}><MaterialCommunityIcons name="puzzle-outline" size={25} color={colors.coral} /><AppText variant="subtitle">Peça desbloqueada!</AppText></View>
      <AppText variant="small" color={colors.muted}>Você avançou uma fase. Arraste a peça até o espaço indicado para montar o seu painel de boas práticas.</AppText>
      <View style={[styles.puzzleBoard, { borderColor: `${colors.teal}55`, backgroundColor: `${colors.deepTeal}0A` }]}>
        <View style={[styles.puzzleTarget, { borderColor: colors.coral }]}><MaterialCommunityIcons name="image-outline" size={28} color={colors.coral} /></View>
        <Animated.View {...panResponder.panHandlers} style={[styles.puzzlePiece, { backgroundColor: colors.deepTeal, transform: position.getTranslateTransform() }]}><MaterialCommunityIcons name="clock-check-outline" size={29} color="#FFFFFF" /></Animated.View>
      </View>
      {placed ? <AppText variant="small" color={colors.deepTeal} style={{ textAlign: 'center', fontWeight: '800' }}>Peça encaixada. Próxima boa prática desbloqueada!</AppText> : <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Arraste para cima e para a direita.</AppText>}
      <ActionButton title={placed ? 'Continuar jornada' : 'Deixar para depois'} variant={placed ? 'secondary' : 'outline'} onPress={onClose} />
    </SurfaceCard></View>
  </Modal>;
}
