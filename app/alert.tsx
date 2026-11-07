import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, ClockMascot, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { chooseCharge, ChargeIllustration, type AlertLevel } from '@/components/charges';
import { useAppStore } from '@/store/app-store';
import { calculateWorkedMinutes, formatMinutesHHMM, getBahiaDate } from '@/utils/work-time';
import { getWorkScheduleForDate } from '@/utils/work-schedules';

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
  const lunchStart = params.type === 'lunch-start';
  const shiftComplete = params.type === 'shift-complete';
  const charge = chooseCharge(level);
  const today = getBahiaDate(new Date());
  const activeSchedule = getWorkScheduleForDate(profile?.preferencias_alerta, today, profile?.almoco_minutos ?? 60);
  const worked = calculateWorkedMinutes(entries.filter((entry) => entry.data === today));
  const limit = profile?.limite_minutos ?? 600;
  const isCritical = level === '10h';
  const lunchReminder = lunchStart || lunchReturn;
  const headline = shiftComplete ? 'Sua jornada programada terminou' : lunchReturn ? 'Hora de voltar do almoço' : lunchStart ? 'Pausa para o almoço' : ({ '8h': 'Jornada regular concluída', '9h': 'Atenção: hora extra', '9h30': 'Faltam 30 minutos', '9h45': 'Faltam 15 minutos', '9h50': 'Faltam 10 minutos', '10h': 'Limite atingido' } satisfies Record<AlertLevel, string>)[level];
  return (
    <ScreenShell contentStyle={styles.page}>
      <View style={styles.top}><ClockMascot size={62} worried={isCritical} /><AppText variant="tiny" color={isCritical ? colors.error : colors.deepTeal} style={{ letterSpacing: 1.1 }}>{lunchReturn ? 'LEMBRETE DE RETORNO' : lunchStart ? 'LEMBRETE DE PAUSA' : isCritical ? 'ALERTA CRÍTICO' : 'LEMBRETE DE JORNADA'}</AppText></View>
      <SurfaceCard style={{ alignItems: 'center', gap: 15, borderColor: isCritical ? colors.error : colors.border }}>
        {lunchReminder ? <MaterialCommunityIcons name="food-outline" size={52} color={colors.deepTeal} accessibilityLabel="Lembrete de almoço" /> : shiftComplete ? <MaterialCommunityIcons name="calendar-check-outline" size={56} color={colors.deepTeal} accessibilityLabel="Jornada programada concluída" /> : <ChargeIllustration chargeId={charge.id} size={224} />}
        <AppText variant="title" style={{ textAlign: 'center' }}>{isCritical && !lunchReminder ? 'LIMITE ATINGIDO!' : headline}</AppText>
        <AppText variant="body" color={colors.muted} style={{ textAlign: 'center' }}>{shiftComplete ? `Sua jornada está configurada para ${activeSchedule.start_time}–${activeSchedule.end_time}. Registre a saída no relógio da empresa e no app. O alerta de jornada completa é separado do limite de segurança de ${formatMinutesHHMM(limit)} trabalhadas.` : lunchReturn ? 'O intervalo previsto terminou. Registre a volta no relógio da empresa e no app para retomar o contador.' : lunchStart ? `Você já trabalhou ${formatMinutesHHMM(worked)}. Se for iniciar o intervalo, registre a saída no relógio da empresa e no app. O almoço não entra na soma de horas trabalhadas.` : isCritical ? 'Pare de trabalhar e bata o ponto de saída agora.' : `Você já trabalhou ${formatMinutesHHMM(worked)}. Seu limite diário é ${formatMinutesHHMM(limit)}.`}</AppText>
        {!lunchReminder && !shiftComplete ? <AppText variant="small" color={colors.deepTeal} style={{ textAlign: 'center' }}>{charge.caption}</AppText> : null}
        <ActionButton title={isCritical ? 'Voltar para registrar a saída' : shiftComplete ? 'Voltar para o contador' : 'Entendido'} onPress={() => router.replace('/(tabs)')} style={isCritical ? { backgroundColor: colors.error, borderColor: colors.error } : undefined} />
      </SurfaceCard>
      <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Controle pessoal de acompanhamento — não substitui o espelho oficial do empregador.</AppText>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, justifyContent: 'center', gap: 20, paddingVertical: 22 }, top: { alignItems: 'center', gap: 8 } });
