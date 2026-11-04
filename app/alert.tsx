import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ActionButton, AppText, ClockMascot, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { chooseCharge, ChargeIllustration, type AlertLevel } from '@/components/charges';
import { useAppStore } from '@/store/app-store';
import { calculateWorkedMinutes, formatMinutesHHMM, getBahiaDate } from '@/utils/work-time';

function normalize(value: string | string[] | undefined): AlertLevel {
  const candidate = Array.isArray(value) ? value[0] : value;
  return (['8h', '9h', '9h30', '9h45', '9h50', '10h'].includes(candidate || '') ? candidate : '8h') as AlertLevel;
}

export default function AlertScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string; type?: string }>();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const entries = useAppStore((state) => state.entries);
  const level = normalize(params.level);
  const lunchReturn = params.type === 'lunch-return';
  const charge = chooseCharge(level);
  const today = getBahiaDate(new Date());
  const worked = calculateWorkedMinutes(entries.filter((entry) => entry.data === today));
  const limit = profile?.limite_minutos ?? 600;
  const isCritical = level === '10h';
  return (
    <ScreenShell contentStyle={styles.page}>
      <View style={styles.top}><ClockMascot size={62} worried={isCritical} /><AppText variant="tiny" color={isCritical ? colors.error : colors.deepTeal} style={{ letterSpacing: 1.1 }}>{lunchReturn ? 'LEMBRETE DE ALMOÇO' : isCritical ? 'ALERTA CRÍTICO' : 'LEMBRETE DE JORNADA'}</AppText></View>
      <SurfaceCard style={{ alignItems: 'center', gap: 15, borderColor: isCritical ? colors.error : colors.border }}>
        <ChargeIllustration chargeId={charge.id} size={224} />
        <AppText variant="title" style={{ textAlign: 'center' }}>{lunchReturn ? 'Hora de voltar do almoço' : isCritical ? 'LIMITE ATINGIDO!' : charge.caption}</AppText>
        <AppText variant="body" color={colors.muted} style={{ textAlign: 'center' }}>{lunchReturn ? 'Seu intervalo terminou. Registre a volta no relógio da empresa e toque em “Bater ponto” para retomar o contador.' : isCritical ? 'Pare de trabalhar e bata o ponto de saída agora.' : `Você já trabalhou ${formatMinutesHHMM(worked)}. Seu limite diário é ${formatMinutesHHMM(limit)}.`}</AppText>
        <AppText variant="small" color={colors.deepTeal} style={{ textAlign: 'center' }}>{charge.caption}</AppText>
        <ActionButton title={isCritical ? 'Voltar para registrar a saída' : lunchReturn ? 'Entendido, já vou!' : 'Entendido, já vou!'} onPress={() => router.replace('/(tabs)')} style={isCritical ? { backgroundColor: colors.error, borderColor: colors.error } : undefined} />
      </SurfaceCard>
      <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Controle pessoal de acompanhamento — não substitui o espelho oficial do empregador.</AppText>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, justifyContent: 'center', gap: 20, paddingVertical: 22 }, top: { alignItems: 'center', gap: 8 } });
