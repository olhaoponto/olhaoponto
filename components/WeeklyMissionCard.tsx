import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import type { WeeklyMissionSummary } from '@/utils/weekly-mission';
import { formatMinutesHHMM } from '@/utils/work-time';

const MAP_STOPS = [
  { label: 'Partida', icon: 'flag-outline' as const },
  { label: 'Ritmo', icon: 'run-fast' as const },
  { label: 'Pausa', icon: 'coffee-outline' as const },
  { label: 'Constância', icon: 'star-outline' as const },
  { label: 'Descanso', icon: 'home-heart' as const },
];

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors();
  const ratio = Math.min(1, summary.completed / Math.max(1, summary.goal));
  const complete = summary.completed >= summary.goal;
  const currentStop = Math.min(MAP_STOPS.length - 1, Math.round(ratio * (MAP_STOPS.length - 1)));
  const nextStop = complete ? 'Missão concluída' : `Próximo: ${MAP_STOPS[Math.min(MAP_STOPS.length - 1, currentStop + 1)].label}`;

  return (
    <SurfaceCard style={{ gap: 12, borderColor: `${colors.teal}65` }}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="map-marker-path" size={23} color={colors.deepTeal} /></View>
        <View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800', letterSpacing: 1 }}>MISSÃO DA SEMANA</AppText><AppText variant="tiny" color={colors.muted}>Um caminho leve, sem corrida e sem punição</AppText></View>
        <MaterialCommunityIcons name={complete ? 'flag-checkered' : 'compass-outline'} size={22} color={colors.coral} />
      </View>
      <View style={{ gap: 3 }}><AppText variant="subtitle">Seu caminho está tomando forma.</AppText><AppText variant="small" color={colors.muted}>Cada dia resolvido move o mascote para o próximo trecho. O objetivo é organizar os registros, não trabalhar mais horas.</AppText></View>

      <View style={[styles.map, { backgroundColor: `${colors.teal}08`, borderColor: `${colors.teal}30` }]}>
        <View style={[styles.road, { borderColor: `${colors.teal}55` }]} />
        {MAP_STOPS.map((stop, index) => {
          const reached = index <= currentStop;
          const isCurrent = index === currentStop;
          const left = `${8 + index * 21}%` as `${number}%`;
          const top = index % 2 === 0 ? 70 : 27;
          return <View key={stop.label} style={[styles.stop, { left, top }]}>
            <View style={[styles.node, { backgroundColor: reached ? colors.deepTeal : colors.card, borderColor: reached ? colors.deepTeal : colors.border, transform: [{ scale: isCurrent ? 1.12 : 1 }] }]}><MaterialCommunityIcons name={reached ? 'check' : stop.icon} size={17} color={reached ? '#FFFFFF' : colors.muted} /></View>
            <AppText variant="tiny" color={isCurrent ? colors.deepTeal : colors.muted} style={[styles.stopLabel, isCurrent && { fontWeight: '800' }]}>{isCurrent ? 'Você está aqui' : stop.label}</AppText>
          </View>;
        })}
        <View style={[styles.mapBadge, { backgroundColor: colors.card, borderColor: colors.border }]}><MaterialCommunityIcons name={complete ? 'party-popper' : 'map-marker-radius-outline'} size={15} color={colors.coral} /><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800' }}>{nextStop}</AppText></View>
      </View>

      <View style={{ gap: 7 }}><View style={styles.progressHeader}><AppText variant="small" style={{ fontWeight: '700' }}>Trechos concluídos</AppText><AppText variant="small" color={colors.deepTeal} style={{ fontWeight: '800' }}>{summary.completed}/{summary.goal}</AppText></View><View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: complete ? colors.teal : colors.coral }]} /></View></View>
      {complete ? <AppText variant="small" color={colors.deepTeal}>Você chegou ao descanso. Folgas, atestados e ausências também contam como dias organizados.</AppText> : <AppText variant="tiny" color={colors.muted}>O próximo trecho aparece quando você resolver mais um dia da semana.</AppText>}
      {summary.balanceMinutes < 0 ? <View style={[styles.guidance, { backgroundColor: `${colors.warning}20`, borderColor: `${colors.warning}60` }]}><MaterialCommunityIcons name="hand-heart-outline" size={20} color={colors.deepTeal} /><AppText variant="tiny" style={{ flex: 1 }} color={colors.foreground}>Diferença estimada de {formatMinutesHHMM(Math.abs(summary.balanceMinutes))} nos dias completos. Confira o espelho e combine com o RH; não estenda a jornada sem orientação.</AppText></View> : summary.balanceMinutes > 0 ? <AppText variant="tiny" color={colors.muted}>Diferença estimada apenas em dias com quatro batidas completas; não é o saldo oficial da empresa.</AppText> : null}
      <ActionButton title="Revisar meu espelho" variant="outline" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-check-outline" size={18} color={colors.deepTeal} />} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  map: { height: 154, borderRadius: 22, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  road: { position: 'absolute', left: '7%', right: '7%', top: 45, height: 62, borderWidth: 3, borderStyle: 'dashed', borderRadius: 45, transform: [{ rotate: '-3deg' }] },
  stop: { position: 'absolute', width: 74, alignItems: 'center', gap: 3, transform: [{ translateX: -37 }] },
  node: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stopLabel: { textAlign: 'center', maxWidth: 76 },
  mapBadge: { position: 'absolute', right: 9, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 13, borderWidth: 1 },
});
