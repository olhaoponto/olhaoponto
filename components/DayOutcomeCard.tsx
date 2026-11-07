import { Image, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import type { DayStatus } from '@/types/app';

const labels: Record<DayStatus, string> = {
  working: 'trabalho',
  rest: 'folga',
  absence: 'ausência',
  medical_leave: 'atestado',
};

export function DayOutcomeCard({
  status,
  weekendPrompt,
  busy,
  dateLabel,
  onChoose,
  onManage,
}: {
  status: DayStatus | null;
  weekendPrompt: boolean;
  busy: boolean;
  dateLabel: string;
  onChoose: (status: DayStatus) => void;
  onManage: () => void;
}) {
  const colors = useAppColors();
  if (weekendPrompt) {
    return (
      <SurfaceCard style={styles.card}>
        <View style={styles.heading}>
          <View style={[styles.icon, { backgroundColor: `${colors.yellow}38` }]}><MaterialCommunityIcons name="calendar-weekend-outline" size={23} color={colors.deepTeal} /></View>
          <View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={styles.kicker}>ESCOLHA DE HOJE</AppText><AppText variant="subtitle">Você vai trabalhar {dateLabel}?</AppText></View>
        </View>
        <AppText variant="small" color={colors.muted}>Escolha para iniciar o contador ou deixar o relógio descansar. Você pode alterar a situação depois, antes de registrar uma batida.</AppText>
        <View style={styles.actions}>
          <ActionButton title="Sim, vou trabalhar" variant="secondary" onPress={() => onChoose('working')} loading={busy} />
          <ActionButton title="Hoje é folga" variant="outline" onPress={() => onChoose('rest')} loading={busy} />
        </View>
        <Pressable onPress={onManage} accessibilityRole="button" style={styles.secondaryAction}><AppText variant="small" color={colors.deepTeal}>Marcar ausência ou atestado</AppText></Pressable>
      </SurfaceCard>
    );
  }
  if (!status || status === 'working') return null;
  const isRest = status === 'rest';
  const title = isRest ? 'Hoje, o relógio também descansa.' : status === 'medical_leave' ? 'Atestado registrado para hoje' : 'Falta/ausência registrada para hoje';
  const description = isRest
    ? 'A jornada ficou pausada. Aproveite sua folga — ela não entra como hora negativa neste desafio.'
    : status === 'medical_leave'
      ? 'A situação foi salva sem pedir diagnóstico médico. Seu contador não vai cobrar horas neste dia.'
      : 'A situação foi registrada para seu acompanhamento pessoal. Seu contador não vai cobrar horas neste dia.';
  return (
    <SurfaceCard style={[styles.card, isRest ? styles.restCard : null]}>
      {isRest ? <Image source={require('../assets/images/rest-day-clock-ui.png')} resizeMode="contain" accessibilityLabel="Ilustração de um relógio descansando em uma cadeira na praia" style={styles.illustration} /> : <View style={[styles.icon, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name={status === 'medical_leave' ? 'medical-bag' : 'account-alert-outline'} size={25} color={colors.deepTeal} /></View>}
      <AppText variant="tiny" color={colors.deepTeal} style={styles.kicker}>{isRest ? 'DIA DE DESCANSO' : 'SITUAÇÃO DO DIA'}</AppText>
      <AppText variant="title" style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText variant="small" color={colors.muted} style={styles.description}>{description}</AppText>
      <ActionButton title="Alterar situação do dia" variant="outline" onPress={onManage} disabled={busy} />
    </SurfaceCard>
  );
}

export function dayStatusLabel(status: DayStatus): string { return labels[status]; }

const styles = StyleSheet.create({
  card: { gap: 13, alignItems: 'stretch' },
  restCard: { alignItems: 'center', paddingTop: 15 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontWeight: '800', letterSpacing: 1 },
  actions: { gap: 9 },
  secondaryAction: { padding: 6, alignSelf: 'center' },
  illustration: { width: '100%', maxWidth: 310, height: 175 },
  description: { textAlign: 'center' },
});
