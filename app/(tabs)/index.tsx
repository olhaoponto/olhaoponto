import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { loadEntriesByDate, insertTimeEntry, syncPendingEntries } from '@/services/time-entry-service';
import { prepareLocalNotifications } from '@/services/notification-service';
import { calculateWorkedMinutes, calculateWorkedSeconds, formatMinutesHHMM, getBahiaDate, getNextPunch, projectEndTime, validatePunch, type PunchType } from '@/utils/work-time';
import { LUNCH_REMINDER_MINUTES } from '@/utils/alerts';
import type { TimeEntry } from '@/types/app';
import { getWorkScheduleForDate, getScheduleEndAt } from '@/utils/work-schedules';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { useRouter } from 'expo-router';
import { logout } from '@/services/auth-service';

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
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [accountMenuError, setAccountMenuError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const { width, height } = useWindowDimensions();
  const rotationEnabled = profile?.preferencias_alerta?.rotacao_contador !== false;
  const landscape = Platform.OS !== 'web' && rotationEnabled && width > height;
  const today = getBahiaDate(now);
  const todayEntries = useMemo(() => storeEntries.filter((entry) => entry.data === today), [storeEntries, today]);
  const nextPunch = getNextPunch(todayEntries);
  const limit = profile?.limite_minutos ?? 600;
  const activeSchedule = getWorkScheduleForDate(profile?.preferencias_alerta, today, profile?.almoco_minutos ?? 60);
  const lunchMinutes = activeSchedule.lunch_minutes;
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

  const refreshDay = useCallback(async () => {
    if (!session?.user.id) return;
    const result = await loadEntriesByDate(new Date());
    if (result.data) setEntries(result.data);
    setOffline(Boolean(result.error));
    if (result.error && !result.data?.length) setError('Sem conexão no momento. As batidas salvas neste aparelho continuam disponíveis.');
  }, [session?.user.id, setEntries, setOffline]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') { setNow(new Date()); void syncPendingEntries(); void refreshDay(); } });
    const networkListener = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncPendingEntries().finally(() => refreshDay());
    });
    void prepareLocalNotifications().then(setNotificationStatus).catch(() => setNotificationStatus({ granted: false, exactAlarms: false }));
    void Promise.resolve().then(refreshDay);
    return () => { clearInterval(timer); listener.remove(); networkListener.remove(); };
  }, [refreshDay]);

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

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true); setAccountMenuError('');
    try {
      const synced = await syncPendingEntries();
      if (!synced.data || synced.data.failed > 0) {
        setAccountMenuError(synced.error || 'Há batidas aguardando sincronização. Conecte-se à internet e tente novamente antes de sair.');
        return;
      }
      await logout();
      setAccountMenuVisible(false);
      router.replace('/login');
    } catch (reason) {
      setAccountMenuError(reason instanceof Error ? reason.message : 'Não foi possível sair agora. Tente novamente.');
    } finally { setSigningOut(false); }
  };

  const timeFor = (type: PunchType) => todayEntries.find((entry) => entry.tipo === type);
  const projectedLabel = eta ? formatInTimeZone(new Date(eta), profile?.fuso || ZONE, 'HH:mm') : '—';
  const pendingCount = todayEntries.filter((entry) => Boolean((entry as TimeEntry & { _pending?: boolean })._pending)).length;
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
      <PageHeading eyebrow="Seu acompanhamento diário" title={`Olá, ${name}!`} subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} right={<Pressable onPress={() => { setAccountMenuError(''); setAccountMenuVisible(true); }} accessibilityRole="button" accessibilityLabel="Abrir configurações e sair da conta" style={[styles.avatar, { backgroundColor: `${colors.teal}25` }]}><AppText variant="subtitle" color={colors.deepTeal}>{(profile?.nome || 'OP').split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</AppText></Pressable>} />

      <TabNavigationCard />

      {offline || pendingCount > 0 ? <View style={[styles.offlineBanner, { backgroundColor: `${colors.warning}2B`, borderColor: `${colors.warning}70` }]}><MaterialCommunityIcons name="cloud-off-outline" size={20} color={colors.foreground} /><AppText variant="small" style={{ flex: 1 }}>{pendingCount ? `${pendingCount} batida(s) aguardando sincronização.` : 'Modo offline: mostrando seus dados salvos neste aparelho.'}</AppText><StatusPill tone="yellow">OFFLINE</StatusPill></View> : null}
      {notificationStatus && (!notificationStatus.granted || !notificationStatus.exactAlarms) ? <SurfaceCard tone="soft" style={{ gap: 8 }}><AppText variant="small" color={colors.foreground}>{!notificationStatus.granted ? 'Ative as notificações para receber avisos quando o app estiver fechado.' : 'Notificações estão ativas, mas o Android pode entregar os alarmes com atraso enquanto Alarmes e lembretes não estiver liberado.'}</AppText>{Platform.OS !== 'web' ? <Pressable onPress={() => { void Linking.openSettings().catch(() => undefined); }} accessibilityRole="button"><AppText variant="small" color={colors.deepTeal}>Abrir configurações do aplicativo</AppText></Pressable> : null}</SurfaceCard> : null}

      <SurfaceCard style={[styles.timerCard, { borderColor: `${alertColor}65` }]}>
        <View style={styles.timerHeader}><View style={{ gap: 4, flex: 1 }}><AppText variant="small" color={colors.muted}>Seu contador de hoje</AppText><AppText variant="subtitle">{lunchInProgress ? 'Pausa para o almoço' : ended ? 'Jornada encerrada' : 'Jornada em andamento'}</AppText></View><StatusPill tone={ended ? 'teal' : workedMinutes >= 570 ? 'danger' : workedMinutes >= 480 ? 'yellow' : 'teal'}>{lunchInProgress ? 'PAUSADO' : ended ? 'FINALIZADO' : 'AO VIVO'}</StatusPill></View>
        <AppText variant="hero" style={[styles.clock, { color: alertColor }]} accessibilityLabel={`Tempo trabalhado ${elapsed(workedSeconds)}`}>{elapsed(workedSeconds)}</AppText>
        <View style={styles.metricRow}><View style={{ flex: 1, gap: 3 }}><AppText variant="small" color={colors.muted}>Você já trabalhou</AppText><AppText variant="subtitle">{formatMinutesHHMM(workedMinutes)} hoje</AppText></View><View style={[styles.metricDivider, { backgroundColor: colors.border }]} /><View style={{ flex: 1, gap: 3 }}><AppText variant="small" color={colors.muted}>Faltam para o limite</AppText><AppText variant="subtitle" color={remainingMinutes <= 30 ? colors.error : colors.deepTeal}>{formatMinutesHHMM(remainingMinutes)}</AppText></View></View>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: alertColor }]} /></View>
        <View style={styles.etaRow}><MaterialCommunityIcons name="flag-checkered" size={18} color={colors.deepTeal} /><AppText variant="small" style={{ flex: 1 }}>{ended ? 'Saída registrada' : 'Horário-limite de saída projetado'}</AppText><AppText variant="subtitle" color={colors.deepTeal}>{ended && timeFor('saida') ? localTime(timeFor('saida')!.registrado_em) : projectedLabel}</AppText></View>
        {workedMinutes >= 480 && workedMinutes < 570 ? <View style={[styles.alertBanner, { backgroundColor: workedMinutes >= 540 ? `${colors.coral}20` : `${colors.warning}2B` }]}><MaterialCommunityIcons name={workedMinutes >= 540 ? 'alert-circle-outline' : 'check-circle-outline'} size={21} color={workedMinutes >= 540 ? colors.error : colors.deepTeal} /><AppText variant="small" style={{ flex: 1, fontWeight: '600' }}>{workedMinutes >= 540 ? 'Você já está em hora extra. Planeje sua saída.' : 'Jornada normal completa. A partir daqui é hora extra!'}</AppText></View> : null}
        {shiftComplete ? <View style={[styles.alertBanner, { backgroundColor: `${colors.coral}20` }]}><MaterialCommunityIcons name="calendar-check-outline" size={21} color={colors.error} /><AppText variant="small" style={{ flex: 1, fontWeight: '700' }}>Sua jornada programada terminou às {activeSchedule.end_time}. Registre a saída no relógio da empresa e no aplicativo.</AppText></View> : null}
      </SurfaceCard>

      {workedMinutes >= LUNCH_REMINDER_MINUTES && workedMinutes < 480 && !lunchStarted && !ended ? <SurfaceCard tone="soft" style={styles.lunchCard}><MaterialCommunityIcons name="food-outline" size={22} color={colors.deepTeal} /><View style={{ flex: 1, gap: 3 }}><AppText variant="subtitle">Lembrete de pausa</AppText><AppText variant="small" color={colors.muted}>Você já trabalhou 4 horas. Se for fazer o intervalo, registre a saída no relógio da empresa e no app.</AppText></View></SurfaceCard> : null}
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
        <ActionButton title={ended ? 'Jornada de hoje encerrada' : `BATER PONTO · ${nextPunch ? labels[nextPunch].toUpperCase() : ''}`} onPress={handlePunch} loading={loading} disabled={!nextPunch || !profile} icon={<MaterialCommunityIcons name={nextPunch === 'saida' ? 'door-open' : 'clock-check-outline'} size={21} color="#FFFFFF" />} style={{ minHeight: 62, borderRadius: 19, backgroundColor: ended ? colors.deepTeal : workedMinutes >= limit || workedMinutes >= 570 ? colors.error : colors.deepTeal }} />
        <Pressable onPress={() => { setManual((value) => !value); setError(''); }} accessibilityRole="button" style={styles.manualToggle}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>{manual ? 'Fechar horário manual' : 'Informar horário exato'}</AppText></Pressable>
        {manual && nextPunch ? <View style={{ gap: 12 }}><TextField label="Horário da batida (HH:mm)" value={manualTime} onChangeText={setManualTime} placeholder="Ex.: 08:00" keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Horário exato da batida" /><AppText variant="tiny" color={colors.muted}>A data de hoje é usada automaticamente. Horários futuros, fora de ordem ou que ultrapassem o limite não serão registrados.</AppText></View> : null}
      </SurfaceCard>

      {lunchInProgress ? <SurfaceCard tone="soft" style={styles.lunchCard}><MaterialCommunityIcons name="food-outline" size={22} color={colors.deepTeal} /><View style={{ flex: 1, gap: 3 }}><AppText variant="subtitle">Bom almoço!</AppText><AppText variant="small" color={colors.muted}>O contador está pausado. Lembrete para voltar em {lunchMinutes} minutos.</AppText></View></SurfaceCard> : null}
      <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Controle pessoal de acompanhamento — não substitui o espelho oficial do empregador.</AppText>
      <ConfettiBurst visible={celebrated} />
      <Modal visible={accountMenuVisible} transparent animationType="fade" onRequestClose={() => setAccountMenuVisible(false)}>
        <View style={styles.accountMenuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAccountMenuVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar menu da conta" />
          <SurfaceCard style={styles.accountMenuCard}>
            <View style={styles.accountMenuHeading}><View style={{ flex: 1, gap: 3 }}><AppText variant="subtitle">Sua conta</AppText><AppText variant="small" color={colors.muted}>{profile?.email}</AppText></View><Pressable onPress={() => setAccountMenuVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar menu"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View>
            {accountMenuError ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{accountMenuError}</AppText> : null}
            <ActionButton title="Perfil e configurações" variant="outline" onPress={() => { setAccountMenuVisible(false); router.replace('/(tabs)/perfil'); }} icon={<MaterialCommunityIcons name="cog-outline" size={19} color={colors.deepTeal} />} />
            <ActionButton title="Sair da conta" variant="outline" onPress={handleSignOut} loading={signingOut} icon={<MaterialCommunityIcons name="logout" size={19} color={colors.deepTeal} />} />
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
