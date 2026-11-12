import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { addMonths, subMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { ActionButton, AppText, PageHeading, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { useAppStore } from '@/store/app-store';
import { loadEntriesByMonth } from '@/services/time-entry-service';
import { calculateDailyTotals, calculatePeriodTotals, formatMinutesHHMM, getBahiaDate } from '@/utils/work-time';
import { getActiveWorkSchedule } from '@/utils/work-schedules';

const ZONE = 'America/Bahia';
const labelMonth = (month: string) => formatInTimeZone(new Date(`${month}-15T12:00:00Z`), ZONE, 'MMMM yyyy');
const labelShortDate = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, day: '2-digit', month: '2-digit' }).format(new Date(`${date}T12:00:00Z`));
const weekday = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, weekday: 'short' }).format(new Date(`${date}T12:00:00Z`)).replace('.', '');

export default function ResumoScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const sessionInitialized = useAppStore((state) => state.sessionInitialized);
  const entries = useAppStore((state) => state.entries);
  const setEntries = useAppStore((state) => state.setEntries);
  const [month, setMonth] = useState(() => formatInTimeZone(new Date(), ZONE, 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncNotice, setSyncNotice] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const userId = session?.user.id;
  const authUnavailable = sessionInitialized && !userId;
  const reportLoading = !sessionInitialized || (!authUnavailable && loading);
  const visibleError = authUnavailable ? 'Sua sessão não está ativa. Entre novamente para consultar o resumo.' : error;

  useEffect(() => {
    let active = true;
    if (!sessionInitialized || !userId) return () => { active = false; };
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true); setError(''); setSyncNotice('');
      try {
        const result = await loadEntriesByMonth(new Date(`${month}-15T12:00:00Z`));
        if (!active) return;
        if (result.data) setEntries(result.data);
        if (result.error && result.data?.length) {
          setSyncNotice('Sem conexão com o Supabase. Exibindo os registros salvos neste aparelho; tente sincronizar novamente.');
          setError('');
        } else if (result.error) {
          setError(result.error.toLowerCase().includes('sessão') ? result.error : 'Não foi possível carregar este mês. Confira sua conexão e tente novamente.');
          setSyncNotice('');
        } else { setError(''); setSyncNotice(''); }
      } catch {
        if (active) { setError('Não foi possível carregar este mês. Confira sua conexão e tente novamente.'); setSyncNotice(''); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [month, userId, sessionInitialized, retryCount, setEntries]);

  const changeMonth = (amount: -1 | 1) => {
    const next = formatInTimeZone(amount < 0 ? subMonths(new Date(`${month}-15T12:00:00Z`), 1) : addMonths(new Date(`${month}-15T12:00:00Z`), 1), ZONE, 'yyyy-MM');
    setLoading(true); setError(''); setSyncNotice(''); setMonth(next);
  };

  const periodEntries = useMemo(() => entries.filter((entry) => entry.data.startsWith(month)), [entries, month]);
  const workSchedule = useMemo(() => getActiveWorkSchedule(profile?.preferencias_alerta, profile?.almoco_minutos ?? 60), [profile?.almoco_minutos, profile?.preferencias_alerta]);
  const totals = useMemo(() => calculatePeriodTotals(periodEntries, new Date(), workSchedule), [periodEntries, workSchedule]);
  const days = useMemo(() => calculateDailyTotals(periodEntries, new Date(), workSchedule), [periodEntries, workSchedule]);
  const completedDays = days.filter((day) => day.workedMinutes > 0);
  const average = completedDays.length ? Math.round(totals.workedMinutes / completedDays.length) : 0;
  const today = getBahiaDate(new Date());
  const lastWeekStart = new Date(`${today}T12:00:00-03:00`);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);
  const weekStart = getBahiaDate(lastWeekStart);
  const weekly = days.filter((day) => day.date >= weekStart && day.date <= today);
  const maxWeek = Math.max(1, ...weekly.map((day) => day.workedMinutes));
  const recent = [...days].slice(-5).reverse();

  return (
    <ScreenShell contentStyle={styles.page}>
      <PageHeading eyebrow="Uma visão tranquila" title="Resumo" subtitle="Como está seu ritmo neste mês." right={<AccountMenuButton />} />
      <TabNavigationCard active="resumo" />
      <SurfaceCard style={styles.monthCard}>
        <Pressable onPress={() => changeMonth(-1)} accessibilityRole="button" accessibilityLabel="Mês anterior"><MaterialCommunityIcons name="chevron-left" size={25} color={colors.deepTeal} /></Pressable>
        <AppText variant="subtitle" style={{ textTransform: 'capitalize', flex: 1, textAlign: 'center' }}>{labelMonth(month)}</AppText>
        <Pressable onPress={() => changeMonth(1)} accessibilityRole="button" accessibilityLabel="Próximo mês"><MaterialCommunityIcons name="chevron-right" size={25} color={colors.deepTeal} /></Pressable>
      </SurfaceCard>
      {reportLoading ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}><ActivityIndicator color={colors.deepTeal} /><AppText variant="small" color={colors.muted}>Carregando dados de {labelMonth(month)}…</AppText></View> : null}
      {syncNotice && !authUnavailable ? <AppText variant="small" color={colors.coral}>{syncNotice}</AppText> : null}
      {visibleError ? <SurfaceCard tone="soft" style={{ gap: 10 }}><AppText variant="body" color={colors.error}>{visibleError}</AppText>{!authUnavailable ? <ActionButton title="Tentar novamente" variant="outline" onPress={() => { setLoading(true); setError(''); setRetryCount((value) => value + 1); }} /> : null}{visibleError.toLowerCase().includes('sessão') ? <ActionButton title="Voltar ao login" onPress={() => router.replace('/login')} /> : null}</SurfaceCard> : null}
      {!reportLoading && !visibleError ? <>
      <View style={styles.cards}>
        <SurfaceCard style={[styles.metricCard, { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal }]}><MaterialCommunityIcons name="clock-outline" size={22} color="#D4F4EC" /><AppText variant="tiny" color="#D4F4EC">Horas trabalhadas</AppText><AppText variant="title" color="#FFFFFF">{formatMinutesHHMM(totals.workedMinutes)}</AppText><AppText variant="tiny" color="#D4F4EC">em {completedDays.length} dia(s) com registros</AppText></SurfaceCard>
        <SurfaceCard style={styles.metricCard}><MaterialCommunityIcons name="chart-line" size={22} color={colors.coral} /><AppText variant="tiny" color={colors.muted}>Média por dia registrado</AppText><AppText variant="title" color={colors.foreground}>{formatMinutesHHMM(average)}</AppText><AppText variant="tiny" color={colors.muted}>dias sem batida não entram na média</AppText></SurfaceCard>
        <SurfaceCard style={styles.metricCard}><MaterialCommunityIcons name="wallet-outline" size={22} color={colors.deepTeal} /><AppText variant="tiny" color={colors.muted}>Banco estimado</AppText><AppText variant="title" color={colors.deepTeal}>{formatMinutesHHMM(totals.overtimeMinutes)}</AppText><AppText variant="tiny" color={colors.muted}>extras acima da jornada do dia</AppText></SurfaceCard>
      </View>
      <ActionButton title="Ver banco de horas acumulado" variant="outline" onPress={() => router.push('/bank-hours')} icon={<MaterialCommunityIcons name="wallet-plus-outline" size={20} color={colors.deepTeal} />} />
      <SurfaceCard style={{ gap: 18 }}>
        <View style={{ gap: 4 }}><AppText variant="subtitle">Últimos 7 dias</AppText><AppText variant="small" color={colors.muted}>Horas registradas em cada dia.</AppText></View>
        {weekly.length ? <View style={styles.chart}>
          {Array.from({ length: 7 }, (_, index) => {
            const dateObj = new Date(`${today}T12:00:00-03:00`); dateObj.setDate(dateObj.getDate() - (6 - index));
            const date = getBahiaDate(dateObj);
            const item = days.find((day) => day.date === date);
            const height = Math.max(6, Math.round(((item?.workedMinutes ?? 0) / maxWeek) * 112));
            return <View key={date} style={styles.barSlot}><AppText variant="tiny" color={colors.muted}>{item ? formatMinutesHHMM(item.workedMinutes) : ''}</AppText><View style={[styles.barTrack, { backgroundColor: colors.input }]}><View style={[styles.bar, { height, backgroundColor: item && item.workedMinutes >= 570 ? colors.coral : colors.teal }]} /></View><AppText variant="tiny" color={colors.muted}>{weekday(date)}</AppText></View>;
          })}
        </View> : <AppText variant="small" color={colors.muted}>Ainda não há registros nos últimos dias.</AppText>}
      </SurfaceCard>
      <SurfaceCard>
        <AppText variant="subtitle">Dias recentes</AppText>
        {recent.length ? recent.map((day) => <View key={day.date} style={[styles.recentRow, { borderBottomColor: colors.border }]}><View style={{ flex: 1, gap: 2 }}><AppText variant="body" style={{ fontWeight: '600' }}>{labelShortDate(day.date)}</AppText><AppText variant="tiny" color={colors.muted}>{weekday(day.date)}</AppText></View><View style={{ alignItems: 'flex-end', gap: 2 }}><AppText variant="subtitle">{day.workedHHMM}</AppText><AppText variant="tiny" color={day.overtimeMinutes ? colors.coral : colors.muted}>{day.overtimeMinutes ? `+${day.overtimeHHMM} extras` : 'sem extra acima da jornada'}</AppText></View></View>) : <AppText variant="small" color={colors.muted}>O resumo aparece assim que você registrar sua primeira batida.</AppText>}
      </SurfaceCard>
      <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>O banco é uma estimativa baseada nas horas acima da jornada configurada para cada dia. Consulte o espelho oficial da empresa para conferência.</AppText></SurfaceCard>
      </> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, paddingTop: 18 },
  monthCard: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flex: 1, minWidth: 145, padding: 15, gap: 5 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, minHeight: 160, alignItems: 'flex-end' },
  barSlot: { flex: 1, alignItems: 'center', gap: 7 },
  barTrack: { width: '100%', height: 116, borderRadius: 10, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 10 },
  recentRow: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
