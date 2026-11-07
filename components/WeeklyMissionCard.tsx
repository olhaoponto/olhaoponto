import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import type { WeeklyMissionSummary } from '@/utils/weekly-mission';
import { formatMinutesHHMM } from '@/utils/work-time';

export function WeeklyMissionCard({ summary, onOpenMirror }: { summary: WeeklyMissionSummary; onOpenMirror: () => void }) {
  const colors = useAppColors();
  const ratio = Math.min(1, summary.completed / Math.max(1, summary.goal));
  const complete = summary.completed >= summary.goal;
  return (
    <SurfaceCard style={{ gap: 12, borderColor: `${colors.teal}65` }}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="flag-variant-outline" size={23} color={colors.deepTeal} /></View>
        <View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800', letterSpacing: 1 }}>MISSÃO DA SEMANA</AppText><AppText variant="tiny" color={colors.muted}>Desafio leve · zero punições</AppText></View>
        <MaterialCommunityIcons name="star-outline" size={20} color={colors.coral} />
      </View>
      <AppText variant="subtitle">Organize seus registros, no seu ritmo.</AppText>
      <AppText variant="small" color={colors.muted}>Missão opcional: deixe {summary.goal} dia(s) desta semana com o registro resolvido — quatro batidas nos dias trabalhados ou a situação correta nos demais.</AppText>
      <View style={{ gap: 7 }}>
        <View style={styles.progressHeader}><AppText variant="small" style={{ fontWeight: '700' }}>Dias organizados</AppText><AppText variant="small" color={colors.deepTeal} style={{ fontWeight: '800' }}>{summary.completed}/{summary.goal}</AppText></View>
        <View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: complete ? colors.teal : colors.coral }]} /></View>
      </View>
      {complete ? <AppText variant="small" color={colors.deepTeal}>Missão concluída. Folgas, atestados e ausências também contam como dias registrados.</AppText> : <AppText variant="tiny" color={colors.muted}>Sem sequência perdida e sem pontos por trabalhar mais horas.</AppText>}
      {summary.balanceMinutes < 0 ? <View style={[styles.guidance, { backgroundColor: `${colors.warning}20`, borderColor: `${colors.warning}60` }]}><MaterialCommunityIcons name="hand-heart-outline" size={20} color={colors.deepTeal} /><AppText variant="tiny" style={{ flex: 1 }} color={colors.foreground}>Diferença estimada de {formatMinutesHHMM(Math.abs(summary.balanceMinutes))} nos dias completos. Confira o espelho e combine com o RH como regularizar; não estenda a jornada sem orientação da empresa.</AppText></View> : summary.balanceMinutes > 0 ? <AppText variant="tiny" color={colors.muted}>Diferença estimada calculada apenas em dias com quatro batidas completas; não é o saldo oficial da empresa.</AppText> : null}
      <ActionButton title="Revisar meu espelho" variant="outline" onPress={onOpenMirror} icon={<MaterialCommunityIcons name="calendar-check-outline" size={18} color={colors.deepTeal} />} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 13, borderWidth: 1 },
});
