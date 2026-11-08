import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { loadEntriesByDate, loadEntriesByMonth, insertTimeEntry, syncPendingEntries } from '@/services/time-entry-service';
import { prepareLocalNotifications } from '@/services/notification-service';
import { calculateWorkedMinutes, calculateWorkedSeconds, formatMinutesHHMM, getBahiaDate, getNextPunch, projectEndTime, validatePunch, type PunchType } from '@/utils/work-time';
import { getLunchReminderMinutes } from '@/utils/alerts';
import type { DayStatus, DayStatusRecord, TimeEntry } from '@/types/app';
import { loadDayStatuses, saveDayStatus, syncPendingDayStatuses } from '@/services/day-status-service';
import { getCivilWeekday, getWeekDateRange } from '@/utils/day-status';
import { getWeeklyMissionSummary } from '@/utils/weekly-mission';
import { WeeklyMissionCard } from '@/components/WeeklyMissionCard';
import { DayOutcomeCard } from '@/components/DayOutcomeCard';
import { getWorkScheduleForDate, getScheduleEndAt } from '@/utils/work-schedules';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { useRouter } from 'expo-router';
import { calculateLunchReturnTimes, getLunchReturnWarningMinutes } from '@/utils/lunch-return';
import { HomeCommunications } from '@/components/HomeCommunications';
// import { AppDownloadShareCard } from '@/components/AppDownloadShareCard';

const ZONE = 'America/Bahia';
const labels: Record<PunchType, string> = { entrada: 'Entrada', saida_almoco: 'Saída para almoço', volta_almoco: 'Volta do almoço', saida: 'Saída' };
const order: PunchType[] = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
function elapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 3600)).padStart(2, '0')}:${String(Math.floor((safe % 3600) / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
function friendlyDate(value: Date) { return new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(value); }
function localTime(value: string) { return formatInTimeZone(new Date(value), ZONE, 'HH:mm'); }
export default function HomeScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const storeEntries = useAppStore((state) => state.entries);
  const setEntries = useAppStore((state) => state.setEntries);
  const upsertEntry = useAppStore((state) => state.upsertEntry);
  const setOffline = useAppStore((state) => state.setOffline);
  const offline = useAppStore((state) => state.offline);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualTime, setManualTime] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [celebrated, setCelebrated] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<{ granted: boolean; exactAlarms: boolean } | null>(null);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [dayStatuses, setDayStatuses] = useState<DayStatusRecord[]>([]);
  const [dayStatusModal, setDayStatusModal] = useState(false);
  const [savingDayStatus, setSavingDayStatus] = useState(false);
  const [dayStatusNotice, setDayStatusNotice] = useState('');
  const [sharingLunch, setSharingLunch] = useState(false);
  const { width, height } = useWindowDimensions();
  const rotationEnabled = profile?.preferencias_alerta?.rotacao_contador !== false;
  const today = getBahiaDate(now);
  const todayEntries = useMemo(() => storeEntries.filter((entry) => entry.data === today), [storeEntries, today]);
  const todayStatus = useMemo(() => dayStatuses.find((item) => item.data === today) ?? null, [dayStatuses, today]);
  const weekday = getCivilWeekday(today);
  const weekendNeedsChoice = (weekday === 0 || weekday === 6) && !todayStatus && todayEntries.length === 0;
  const shouldShowOutcome = weekendNeedsChoice || Boolean(todayStatus && todayStatus.status !== 'working');
  const rotationForTimer = rotationEnabled && !shouldShowOutcome;
  const landscape = Platform.OS !== 'web' && rotationForTimer && width > height;
  const nextPunch = getNextPunch(todayEntries);
  const limit = profile?.limite_minutos ?? 600;
  const selectedSchedule = getWorkScheduleForDate(profile?.preferencias_alerta, today, profile?.almoco_minutos ?? 60);
  const activeSchedule = todayStatus?.status === 'working' && weekday >= 0 && !selectedSchedule.work_days.includes(weekday)
    ? { ...selectedSchedule, work_days: [...selectedSchedule.work_days, weekday] }
    : selectedSchedule;
  const lunchMinutes = activeSchedule.lunch_minutes;
  const lunchReminderMinutes = getLunchReminderMinutes(profile?.preferencias_alerta?.lunch_reminder_minutes);
  const lunchReturnWarningMinutes = getLunchReturnWarningMinutes(profile?.preferencias_alerta?.lunch_return_warning_minutes);
  const lunchOutEntry = todayEntries.find((entry) => entry.tipo === 'saida_almoco');
  const lunchReturnTiming = lunchOutEntry ? calculateLunchReturnTimes(lunchOutEntry.registrado_em, lunchMinutes, lunchReturnWarningMinutes) : null;
  const workedSeconds = calculateWorkedSeconds(todayEntries, now);
  const workedMinutes = calculateWorkedMinutes(todayEntries, now);
  const remainingMinutes = Math.max(0, limit - workedMinutes);
  const lunchInProgress = todayEntries.some((entry) => entry.tipo === 'saida_almoco') && !todayEntries.some((entry) => entry.tipo === 'volta_almoco');
  const lunchStarted = todayEntries.some((entry) => entry.tipo === 'saida_almoco');
  const ended = todayEntries.some((entry) => entry.tipo === 'saida');
  const progress = Math.min(1, workedMinutes / Math.max(1, limit));
  const alertColor = ended ? colors.teal : workedMinutes >= limit || workedMinutes >= 570 ? colors.error : workedMinutes >= 540 ? colors.coral : workedMinutes >= 480 ? colors.warning : colors.teal;
  const eta = projectEndTime(todayEntries, limit, lunchMinutes);
  const scheduledEnd = todayEntries.some((entry) => entry.tipo === 'entrada') ? getScheduleEndAt(today, activeSchedule, profile?.fuso || ZONE) : null;
  const shiftComplete = Boolean(!ended && scheduledEnd && now >= scheduledEnd);
  const dateLabel = friendlyDate(now);
  const weekRange = getWeekDateRange(today);
  const weeklyMission = useMemo(() => getWeeklyMissionSummary(today, weekEntries, dayStatuses, profile?.preferencias_alerta, profile?.almoco_minutos ?? 60), [today, weekEntries, dayStatuses, profile?.preferencias_alerta, profile?.almoco_minutos]);

  const refreshDay = useCallback(async () => {
    if (!session?.user.id) return;
    const result = await loadEntriesByDate(new Date());
    if (result.data) {
      setEntries(result.data);
      const currentDate = getBahiaDate(new Date());
      setWeekEntries((current) => [...current.filter((entry) => entry.data !== currentDate), ...result.data!].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)));
    }
    setOffline(Boolean(result.error));
    if (result.error && !result.data?.length) setError('Sem conexão no momento. As batidas salvas neste aparelho continuam disponíveis.');
  }, [session?.user.id, setEntries, setOffline]);

  const refreshWeek = useCallback(async () => {
    if (!session?.user.id) return;
    const months = [...new Set([weekRange.startDate.slice(0, 7), weekRange.endDate.slice(0, 7)])];
    const [entryResults, statusResult] = await Promise.all([
      Promise.all(months.map((month) => loadEntriesByMonth(`${month}-01`))),
      loadDayStatuses(weekRange.startDate, weekRange.endDate),
    ]);
    const byId = new Map<string, TimeEntry>();
    for (const result of entryResults) for (const entry of result.data ?? []) byId.set(entry.id, entry);
    setWeekEntries([...byId.values()].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)));
    if (statusResult.data) setDayStatuses(statusResult.data);
  }, [session?.user.id, weekRange.startDate, weekRange.endDate]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') { setNow(new Date()); void syncPendingEntries(); void refreshDay(); void syncPendingDayStatuses().finally(() => refreshWeek()); } });
    const networkListener = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncPendingEntries().finally(() => refreshDay());
        void syncPendingDayStatuses().finally(() => refreshWeek());
      }
    });
    void prepareLocalNotifications().then(setNotificationStatus).catch(() => setNotificationStatus({ granted: false, exactAlarms: false }));
    void Promise.resolve().then(refreshDay);
    return () => { clearInterval(timer); listener.remove(); networkListener.remove(); };
  }, [refreshDay, refreshWeek]);

  useEffect(() => { void Promise.resolve().then(refreshWeek); }, [refreshWeek]);

  const handlePunch = async () => {
    if (!profile || !nextPunch) return;
    setLoading(true); setError(''); setSuccess('');
    let stamp: string;
    if (manual) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(manualTime)) { setError('Informe o horário no formato HH:mm.'); setLoading(false); return; }
      stamp = fromZonedTime(`${today}T${manualTime}:00`, profile.fuso || ZONE).toISOString();
    } else {
      stamp = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    }
    const candidate = { tipo: nextPunch, registrado_em: stamp, data: today };
    const validation = validatePunch(todayEntries, candidate, now, limit);
    if (!validation.valid) { setError(validation.message || 'Essa batida não pode ser registrada.'); setLoading(false); return; }
    const result = await insertTimeEntry({ tipo: nextPunch, registrado_em: stamp, horario_informado_manual: manual });
    setLoading(false);
    if (result.error || !result.data) { setError(result.error || 'Não foi possível salvar a batida.'); return; }
    const updated = [...todayEntries.filter((entry) => entry.id !== result.data!.id), result.data].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em));
    setEntries(updated);
    setWeekEntries((current) => [...current.filter((entry) => entry.data !== today || entry.id !== result.data!.id), result.data!].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)));
    upsertEntry(result.data);
    if (manual) setManualTime('');
    setManual(false);
    const finishedWithinLimit = nextPunch === 'saida' && validation.workedMinutes !== undefined && validation.workedMinutes <= limit;
    if (profile.preferencias_alerta?.vibracao !== false) {
      const feedback = finishedWithinLimit
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void feedback.catch(() => undefined);
    }
    if (finishedWithinLimit) {
      setCelebrated(true);
      setSuccess('Dia encerrado dentro do limite. Bom descanso!');
    } else if ((result.data as TimeEntry & { _pending?: boolean })._pending) {
      setSuccess('Batida guardada neste aparelho. Será sincronizada quando a conexão voltar.');
    } else {
      setSuccess(`${labels[nextPunch]} registrada às ${localTime(stamp)}.`);
    }
  };

  const handleChooseDayStatus = async (status: DayStatus) => {
    if (status !== 'working' && todayEntries.length > 0) {
      setError('Há batidas registradas hoje. Para preservar o histórico, não é possível marcar folga, falta ou atestado depois de iniciar a jornada.');
      setDayStatusModal(false);
      return;
    }
    setSavingDayStatus(true); setError(''); setDayStatusNotice('');
    const result = await saveDayStatus(today, status);
    setSavingDayStatus(false);
    if (!result.data) { setError(result.error || 'Não foi possível registrar a situação do dia.'); return; }
    setDayStatuses((current) => [...current.filter((item) => item.data !== today), result.data!].sort((a, b) => a.data.localeCompare(b.data)));
    setDayStatusModal(false);
    setDayStatusNotice(result.error ? 'Situação guardada neste aparelho; a sincronização com a conta está pendente.' : 'Situação do dia atualizada.');
  };

  const shareLunch = async (useCurrentTime: boolean) => {
    const out = timeFor('saida_almoco');
    const departure = out ? new Date(out.registrado_em) : new Date();
    const returnDate = new Date(departure.getTime() + lunchMinutes * 60_000);
    const departureLabel = localTime(departure.toISOString());
    const returnLabel = localTime(returnDate.toISOString());
    const message = out
      ? `Já saí para o almoço às ${departureLabel} e volto às ${returnLabel} (${lunchMinutes} min).`
      : useCurrentTime
        ? `Estou indo almoçar agora, às ${departureLabel}. Se você precisar de algo, me avise. Volto por volta das ${returnLabel} (${lunchMinutes} min).`
        : `Se eu sair para o almoço agora, às ${departureLabel}, volto por volta das ${returnLabel} (${lunchMinutes} min).`;
    setSharingLunch(true);
    try { await Share.share({ title: 'Horário de almoço', message: `${message}

Enviado pelo Olha o Ponto.` }); }
    catch { setError('Não foi possível abrir as opções de compartilhamento.'); }
    finally { setSharingLunch(false); }
  };

  const timeFor = (type: PunchType) => todayEntries.find((entry) => entry.tipo === type);
  const projectedLabel = eta ? formatInTimeZone(new Date(eta), profile?.fuso || ZONE, 'HH:mm') : '—';
  const lunchReturnLabel = lunchReturnTiming ? formatInTimeZone(lunchReturnTiming.returnAt, profile?.fuso || ZONE, 'HH:mm') : null;
  const pendingCount = todayEntries.filter((entry) => Boolean((entry as TimeEntry & { _pending?: boolean })._pending)).length;
  const pendingStatusCount = dayStatuses.filter((item) => Boolean(item._pending)).length;
  const name = profile?.nome?.trim().split(/\s+/)[0] || 'por aí';

  if (landscape) {
    return (
      <ScreenShell scroll={false} edges={[]} contentStyle={styles.landscapeShell}>
        <View style={styles.landscapeWrap}>
          <SurfaceCard style={[styles.landscapeTimerCard, { borderColor: `${alertColor}75` }]}>
            <AppText variant="tiny" color={colors.muted} style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>Seu contador hoje</AppText>
            <AppText variant="hero" style={[styles.landscapeClock, { color: alertColor }]} accessibilityLabel={`Tempo trabalhado ${elapsed(workedSeconds)}`}>{elapsed(workedSeconds)}</AppText>
            <View style={styles.landscapeDetails}><StatusPill tone={ended ? 'teal' : lunchInProgress ? 'yellow' : shiftComplete ? 'danger' : 'teal'}>{ended ? 'FINALIZADO' : lunchInProgress ? 'PAUSADO · ALMOÇO' : shiftComplete ? 'JORNADA PREVISTA CONCLUÍDA' : 'AO VIVO'}</StatusPill><AppText variant="subtitle">{formatMinutesHHMM(workedMinutes)} trabalhadas</AppText></View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: alertColor }]} /></View>
            <AppText variant="small" color={colors.muted}>{ended && timeFor('saida') ? `Saída registrada às ${localTime(timeFor('saida')!.registrado_em)}` : `Jornada ${activeSchedule.start_time}–${activeSchedule.end_time} · almoço ${activeSchedule.lunch_minutes} min`}</AppText>
          </SurfaceCard>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell contentStyle={styles.page}>
      <PageHeading eyebrow="Seu acompanhamento diário" title={`Olá, ${name}!`} subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} right={<AccountMenuButton />} />

      <TabNavigationCard />

      {offline || pendingCount > 0 || pendingStatusCount > 0 ? <View style={[styles.offlineBanner, { backgroundColor: `${colors.warning}2B`, borderColor: `${colors.warning}70` }]}><MaterialCommunityIcons name="cloud-off-outline" size={20} color={colors.foreground} /><AppText variant="small" style={{ flex: 1 }}>{pendingCount || pendingStatusCount ? `${pendingCount ? `${pendingCount} batida(s)` : ''}${pendingCount && pendingStatusCount ? ' e ' : ''}${pendingStatusCount ? `${pendingStatusCount} situação(ões) do dia` : ''} aguardando sincronização.` : 'Modo offline: mostrando seus dados salvos neste aparelho.'}</AppText><StatusPill tone="yellow">OFFLINE</StatusPill></View> : null}
      {notificationStatus && (!notificationStatus.granted || !notificationStatus.exactAlarms) ? <SurfaceCard tone="soft" style={{ gap: 8 }}><AppText variant="small" color={colors.foreground}>{!notificationStatus.granted ? 'Ative as notificações para receber avisos quando o app estiver fechado.' : 'Notificações estão ativas, mas o Android pode entregar os alarmes com atraso enquanto Alarmes e lembretes não estiver liberado.'}</AppText>{Platform.OS !== 'web' ? <Pressable onPress={() => { void Linking.openSettings().catch(() => undefined); }} accessibilityRole="button"><AppText variant="small" color={colors.deepTeal}>Abrir configurações do aplicativo</AppText></Pressable> : null}</SurfaceCard> : null}

      {shouldShowOutcome ? <DayOutcomeCard status={todayStatus?.status ?? null} weekendPrompt={weekendNeedsChoice} busy={savingDayStatus} dateLabel={dateLabel} onChoose={(status) => void handleChooseDayStatus(status)} onManage={() => setDayStatusModal(true)} /> : <>
        <SurfaceCard style={[styles.timerCard, { borderColor: `${alertColor}65` }]}>
          <View style={styles.timerHeader}><View style={{ gap: 4, flex: 1 }}><AppText variant="small" color={colors.muted}>Seu contador de hoje</AppText><AppText variant="subtitle">{lunchInProgress ? 'Pausa para o almoço' : ended ? 'Jornada encerrada' : 'Jornada em andamento'}</AppText></View><StatusPill tone={ended ? 'teal' : workedMinutes >= 570 ? 'danger' : workedMinutes >= 480 ? 'yellow' : 'teal'}>{lunchInProgress ? 'PAUSADO' : ended ? 'FINALIZADO' : 'AO VIVO'}</StatusPill></View>
          <AppText variant="hero" style={[styles.clock, { color: alertColor }]} accessibilityLabel={`Tempo trabalhado ${elapsed(workedSeconds)}`}>{elapsed(workedSeconds)}</AppText>
          <View style={styles.metricRow}><View style={{ flex: 1, gap: 3 }}><AppText variant="small" color={colors.muted}>Você já trabalhou</AppText><AppText variant="subtitle">{formatMinutesHHMM(workedMinutes)} hoje</AppText></View><View style={[styles.metricDivider, { backgroundColor: colors.border }]} /><View style={{ flex: 1, gap: 3 }}><AppText variant="small" color={colors.muted}>Faltam para o limite</AppText><AppText variant="subtitle" color={remainingMinutes <= 30 ? colors.error : colors.deepTeal}>{formatMinutesHHMM(remainingMinutes)}</AppText></View></View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: alertColor }]} /></View>
          <View style={styles.etaRow}><MaterialCommunityIcons name="flag-checkered" size={18} color={colors.deepTeal} /><AppText variant="small" style={{ flex: 1 }}>{ended ? 'Saída registrada' : 'Horário-limite de saída projetado'}</AppText><AppText variant="subtitle" color={colors.deepTeal}>{ended && timeFor('saida') ? localTime(timeFor('saida')!.registrado_em) : projectedLabel}</AppText></View>
          {workedMinutes >= 480 && workedMinutes < 570 ? <View style={[styles.alertBanner, { backgroundColor: workedMinutes >= 540 ? `${colors.coral}20` : `${colors.warning}2B` }]}><MaterialCommunityIcons name={workedMinutes >= 540 ? 'alert-circle-outline' : 'check-circle-outline'} size={21} color={workedMinutes >= 540 ? colors.error : colors.deepTeal} /><AppText variant="small" style={{ flex: 1, fontWeight: '600' }}>{workedMinutes >= 540 ? 'Você já está em hora extra. Planeje sua saída.' : 'Jornada normal completa. A partir daqui é hora extra!'}</AppText></View> : null}
          {shiftComplete ? <View style={[styles.alertBanner, { backgroundColor: `${colors.coral}20` }]}><MaterialCommunityIcons name="calendar-check-outline" size={21} color={colors.error} /><AppText variant="small" style={{ flex: 1, fontWeight: '700' }}>Sua jornada programada terminou às {activeSchedule.end_time}. Registre a saída no relógio da empresa e no aplicativo.</AppText></View> : null}
        </SurfaceCard>

          {profile?.preferencias_alerta?.alerta_pausa_almoco === true && workedMinutes >= lunchReminderMinutes && workedMinutes < 480 && !lunchStarted && !ended ? <SurfaceCard tone="soft" style={styles.lunchCard}><MaterialCommunityIcons name="food-outline" size={22} color={colors.deepTeal} /><View style={{ flex: 1, gap: 3 }}><AppText variant="subtitle">Lembrete de pausa</AppText><AppText variant="small" color={colors.muted}>Você já trabalhou {formatMinutesHHMM(lunchReminderMinutes)}. Se for fazer o intervalo, registre a saída no relógio da empresa e no app.</AppText></View></SurfaceCard> : null}
        <SurfaceCard>
          <View style={styles.sectionHeading}><View style={{ flex: 1, gap: 3 }}><AppText variant="subtitle">Batidas de hoje</AppText><AppText variant="small" color={colors.muted}>Próxima: {nextPunch ? labels[nextPunch] : 'Jornada encerrada'}</AppText></View><StatusPill tone={ended ? 'teal' : 'neutral'}>{todayEntries.length}/4</StatusPill></View>
          <View style={{ gap: 2 }}>{order.map((type, index) => {
            const entry = timeFor(type);
            const active = nextPunch === type;
            const pending = entry && Boolean((entry as TimeEntry & { _pending?: boolean })._pending);
            return <View key={type} style={[styles.punchRow, { borderBottomColor: colors.border }]}><View style={[styles.punchDot, { backgroundColor: entry ? colors.teal : active ? colors.yellow : colors.border }]}><AppText variant="tiny" color={entry || active ? '#FFFFFF' : colors.muted}>{entry ? '✓' : String(index + 1)}</AppText></View><View style={{ flex: 1, gap: 2 }}><AppText variant="body" style={{ fontWeight: active ? '700' : '500' }}>{labels[type]}</AppText>{entry?.horario_informado_manual ? <AppText variant="tiny" color={colors.muted}>Horário informado manualmente</AppText> : null}</View><AppText variant="subtitle" color={entry ? colors.foreground : colors.muted}>{entry ? localTime(entry.registrado_em) : '— — : — —'}</AppText>{pending ? <MaterialCommunityIcons name="cloud-upload-outline" size={17} color={colors.warning} style={{ marginLeft: 4 }} /> : null}</View>;
          })}</View>
          {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
          {success ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{success}</AppText> : null}
          {celebrated ? <View style={[styles.celebration, { backgroundColor: `${colors.teal}19` }]}><AppText variant="subtitle" color={colors.deepTeal}>Dia fechado com cuidado.</AppText><AppText variant="small" color={colors.muted}>Seu tempo pessoal começa agora. Bom descanso!</AppText></View> : null}
          <ActionButton title={ended ? 'Jornada de hoje encerrada' : `BATER - ${nextPunch ? labels[nextPunch].toUpperCase() : ''}`} onPress={handlePunch} loading={loading} disabled={!nextPunch || !profile} icon={<MaterialCommunityIcons name={nextPunch === 'saida' ? 'door-open' : 'clock-check-outline'} size={21} color="#FFFFFF" />} style={{ minHeight: 62, borderRadius: 19, backgroundColor: ended ? colors.deepTeal : workedMinutes >= limit || workedMinutes >= 570 ? colors.error : colors.deepTeal }} />
          <Pressable onPress={() => { setManual((value) => !value); setError(''); }} accessibilityRole="button" style={styles.manualToggle}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>{manual ? 'Fechar horário manual' : 'Informar horário exato'}</AppText></Pressable>
          {manual && nextPunch ? <View style={{ gap: 12 }}><TextField label="Horário da batida (HH:mm)" value={manualTime} onChangeText={setManualTime} placeholder="Ex.: 08:00" keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Horário exato da batida" /><AppText variant="tiny" color={colors.muted}>A data de hoje é usada automaticamente. Horários futuros, fora de ordem ou que ultrapassem o limite não serão registrados.</AppText></View> : null}
          {todayEntries.length === 0 ? <Pressable onPress={() => setDayStatusModal(true)} accessibilityRole="button" style={styles.manualToggle}><MaterialCommunityIcons name="calendar-alert" size={18} color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>Marcar falta, atestado ou folga</AppText></Pressable> : null}
        </SurfaceCard>

        {lunchInProgress ? <SurfaceCard tone="soft" style={styles.lunchCard}><MaterialCommunityIcons name="food-outline" size={22} color={colors.deepTeal} /><View style={{ flex: 1, gap: 3 }}><AppText variant="subtitle">Bom almoço!</AppText><AppText variant="small" color={colors.muted}>{lunchReturnLabel ? `O intervalo de ${lunchMinutes} min termina às ${lunchReturnLabel}. O aviso será enviado ${lunchReturnWarningMinutes} min antes.` : `O contador está pausado durante o intervalo de ${lunchMinutes} minutos.`}</AppText></View></SurfaceCard> : null}
        <SurfaceCard style={{ gap: 10 }}>
          <View style={styles.sectionHeading}><MaterialCommunityIcons name="food-apple-outline" size={23} color={colors.deepTeal} /><AppText variant="subtitle" style={{ flex: 1 }}>Combine o horário do almoço</AppText></View>
          <AppText variant="small" color={colors.muted}>Compartilhe pelo WhatsApp, mensagem ou outro app. Você escolhe o contato e confirma o envio; o Olha o Ponto não envia nada sozinho.</AppText>
          <ActionButton title="Avisar que estou saindo para almoçar" variant="secondary" onPress={() => void shareLunch(true)} loading={sharingLunch} icon={<MaterialCommunityIcons name="send-outline" size={18} color="#FFFFFF" />} />
          <ActionButton title="Compartilhar previsão a partir de agora" variant="outline" onPress={() => void shareLunch(false)} loading={sharingLunch} icon={<MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.deepTeal} />} />
          <AppText variant="tiny" color={colors.muted}>Sem horário fixo: após bater a saída, o retorno é calculado pela hora real registrada mais {lunchMinutes} min de intervalo.</AppText>
        </SurfaceCard>
        <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Controle pessoal de acompanhamento — não substitui o espelho oficial do empregador.</AppText>
      </>}
      {shouldShowOutcome && error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
      {dayStatusNotice ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{dayStatusNotice}</AppText> : null}
      <HomeCommunications lunchMinutes={lunchMinutes} lunchStarted={lunchStarted} ended={ended} />
      {/* Compartilhamento da instalação fica oculto temporariamente; o componente permanece preservado para reativação futura. */}
      {/* <AppDownloadShareCard /> */}
      <WeeklyMissionCard summary={weeklyMission} onOpenMirror={() => router.replace('/(tabs)/espelho')} />
      <ConfettiBurst visible={celebrated} />
      <Modal visible={dayStatusModal} transparent animationType="fade" onRequestClose={() => setDayStatusModal(false)}>
        <View style={styles.accountMenuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDayStatusModal(false)} accessibilityRole="button" accessibilityLabel="Fechar situação do dia" />
          <SurfaceCard style={styles.accountMenuCard}>
            <View style={styles.accountMenuHeading}><View style={{ flex: 1, gap: 3 }}><AppText variant="subtitle">Como registrar hoje?</AppText><AppText variant="small" color={colors.muted}>Essa informação é privada e não pede diagnóstico.</AppText></View><Pressable onPress={() => setDayStatusModal(false)} accessibilityRole="button" accessibilityLabel="Fechar"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View>
            <ActionButton title="Trabalhei ou vou trabalhar" variant="secondary" onPress={() => void handleChooseDayStatus('working')} loading={savingDayStatus} />
            <ActionButton title="Dia de folga" variant="outline" onPress={() => void handleChooseDayStatus('rest')} loading={savingDayStatus} disabled={savingDayStatus || todayEntries.length > 0} />
            <ActionButton title="Falta / ausência" variant="outline" onPress={() => void handleChooseDayStatus('absence')} loading={savingDayStatus} disabled={savingDayStatus || todayEntries.length > 0} />
            <ActionButton title="Atestado" variant="outline" onPress={() => void handleChooseDayStatus('medical_leave')} loading={savingDayStatus} disabled={savingDayStatus || todayEntries.length > 0} />
            <ActionButton title="Cancelar" variant="ghost" onPress={() => setDayStatusModal(false)} disabled={savingDayStatus} />
          </SurfaceCard>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 18, paddingTop: 18 },
  landscapeShell: { justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 8 },
  landscapeWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  landscapeTimerCard: { width: '100%', maxWidth: 860, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 8 },
  landscapeClock: { fontSize: 70, lineHeight: 82, fontVariant: ['tabular-nums'], letterSpacing: -1.8, textAlign: 'center', marginVertical: -4 },
  landscapeDetails: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  accountMenuBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#1024218A' },
  accountMenuCard: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12 },
  accountMenuHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  offlineBanner: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerCard: { padding: 20, gap: 17 },
  timerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clock: { fontVariant: ['tabular-nums'], letterSpacing: -1.3, textAlign: 'center', marginVertical: 2 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  metricDivider: { width: 1, height: 42 },
  progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  alertBanner: { borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  punchRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  punchDot: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  manualToggle: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, padding: 4 },
  lunchCard: { flexDirection: 'row', alignItems: 'center' },
  celebration: { borderRadius: 16, padding: 14, gap: 3, alignItems: 'center' },
});
