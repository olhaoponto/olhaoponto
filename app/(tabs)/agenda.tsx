import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  ActionButton,
  AppText,
  PageHeading,
  ScreenShell,
  StatusPill,
  SurfaceCard,
  TextField,
  useAppColors,
} from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { loadAllEntries } from '@/services/time-entry-service';
import { loadCalendarPreferences, saveCalendarPreferences } from '@/services/calendar-preferences';
import {
  createCalendarEvent,
  getCalendarPermissionState,
  listCalendarEvents,
  listDeviceCalendars,
  requestCalendarAccess,
  type CalendarPermissionState,
  type DeviceCalendar,
  type DeviceCalendarEvent,
} from '@/services/calendar-service';
import { scheduleMeetingNotifications } from '@/services/calendar-notification-service';
import { estimateTypicalEntryTime, isValidClock, projectWorkedRangeAt, zonedDateTime } from '@/utils/calendar-risk';
import { formatMinutesHHMM } from '@/utils/work-time';
import type { TimeEntry } from '@/types/app';

const DEFAULT_ZONE = 'America/Bahia';
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const REMINDER_MINUTES = 5;
const REMINDER_HORIZON_DAYS = 45;

function todayInZone(timeZone: string) {
  return formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
}

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function civilDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftedMonth(date: string, amount: number) {
  const { year, month, day } = dateParts(date);
  const shifted = new Date(year, month - 1 + amount, 1, 12);
  const nextYear = shifted.getFullYear();
  const nextMonth = shifted.getMonth() + 1;
  const lastDay = new Date(nextYear, nextMonth, 0).getDate();
  return civilDate(nextYear, nextMonth, Math.min(day, lastDay));
}

function monthCells(date: string) {
  const { year, month } = dateParts(date);
  const firstWeekday = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const count = Math.ceil((firstWeekday + days) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= days ? civilDate(year, month, day) : null;
  });
}

function monthRange(date: string, timeZone: string) {
  const { year, month } = dateParts(date);
  const start = fromZonedTime(`${civilDate(year, month, 1)}T00:00:00`, timeZone);
  const nextMonth = new Date(year, month, 1, 12);
  const endExclusive = fromZonedTime(`${civilDate(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1)}T00:00:00`, timeZone);
  return { start, end: new Date(endExclusive.getTime() - 1) };
}

function friendlyError(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Não foi possível acessar o calendário. Verifique a permissão do aparelho e tente novamente.';
}

function riskForEvent(
  event: DeviceCalendarEvent,
  history: readonly TimeEntry[],
  lunchMinutes: number,
  timeZone: string,
  personalLimit: number,
) {
  const eventEnd = new Date(event.endDate);
  if (!Number.isFinite(eventEnd.getTime())) return null;
  const date = formatInTimeZone(eventEnd, timeZone, 'yyyy-MM-dd');
  const actualEntry = history.find((entry) => entry.data === date && entry.tipo === 'entrada');
  const estimate = actualEntry ? null : estimateTypicalEntryTime(history, date, timeZone);
  const projection = projectWorkedRangeAt(history, date, eventEnd, lunchMinutes, timeZone, estimate?.time);
  if (!projection) return null;
  return {
    date,
    ...projection,
    estimate,
    actualEntry,
    exceedsTenHours: projection.maximumMinutes > 600,
    exceedsPersonalLimit: projection.maximumMinutes > Math.min(600, personalLimit),
  };
}

export default function AgendaScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const [permission, setPermission] = useState<CalendarPermissionState | null>(null);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [meetingAlertsEnabled, setMeetingAlertsEnabled] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [monthEvents, setMonthEvents] = useState<DeviceCalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => todayInZone(DEFAULT_ZONE));
  const [loading, setLoading] = useState(true);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [message, setMessage] = useState('');

  const [createVisible, setCreateVisible] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingStart, setMeetingStart] = useState('09:00');
  const [meetingEnd, setMeetingEnd] = useState('09:30');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [targetCalendarId, setTargetCalendarId] = useState('');
  const [expectedEntryTime, setExpectedEntryTime] = useState('');
  const [riskMessage, setRiskMessage] = useState('');
  const [formError, setFormError] = useState('');

  const timeZone = profile?.fuso || DEFAULT_ZONE;
  const profileId = profile?.id;
  const lunchMinutes = profile?.almoco_minutos ?? 60;
  const personalLimit = profile?.limite_minutos ?? 600;
  const { year: visibleYear, month: visibleMonth } = dateParts(selectedDate);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone }).format(new Date(visibleYear, visibleMonth - 1, 15, 12));
  const cells = useMemo(() => monthCells(selectedDate), [selectedDate]);
  const writableCalendars = useMemo(() => calendars.filter((calendar) => calendar.allowsModifications), [calendars]);
  const selectedDayEvents = useMemo(
    () => monthEvents.filter((event) => formatInTimeZone(new Date(event.startDate), timeZone, 'yyyy-MM-dd') === selectedDate),
    [monthEvents, selectedDate, timeZone],
  );
  const eventDateSet = useMemo(
    () => new Set(monthEvents.map((event) => formatInTimeZone(new Date(event.startDate), timeZone, 'yyyy-MM-dd'))),
    [monthEvents, timeZone],
  );
  const selectedEventEstimate = useMemo(
    () => estimateTypicalEntryTime(history, meetingDate, timeZone),
    [history, meetingDate, timeZone],
  );
  const actualEntryForMeeting = useMemo(
    () => history.find((entry) => entry.data === meetingDate && entry.tipo === 'entrada'),
    [history, meetingDate],
  );

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    void Promise.all([getCalendarPermissionState(), loadCalendarPreferences(profileId), loadAllEntries()])
      .then(async ([access, preferences, entries]) => {
        if (!active) return;
        setPermission(access);
        const availableCalendars = access.granted ? await listDeviceCalendars() : [];
        if (!active) return;
        setCalendars(availableCalendars);
        const availableIds = new Set(availableCalendars.map((calendar) => calendar.id));
        const selectedIds = access.granted
          ? preferences.selectedCalendarIds.filter((id) => availableIds.has(id))
          : preferences.selectedCalendarIds;
        setSelectedCalendarIds(selectedIds);
        setMeetingAlertsEnabled(preferences.meetingAlertsEnabled);
        setPreferencesLoaded(true);
        setMonthEvents([]);
        const historyRows = entries.data || [];
        setHistory(historyRows);
        setHistoryError(entries.error || '');
        const initialDate = todayInZone(profile.fuso || DEFAULT_ZONE);
        setSelectedDate(initialDate);
        if (access.granted && selectedIds.length !== preferences.selectedCalendarIds.length) {
          await saveCalendarPreferences(profileId, { ...preferences, selectedCalendarIds: selectedIds });
        }
        setLoadedProfileId(profileId);
      })
      .catch((reason) => {
        if (!active) return;
        setScreenError(friendlyError(reason));
        setPermission({ available: true, granted: false, canAskAgain: true });
        setSelectedCalendarIds([]);
        setCalendars([]);
        setMonthEvents([]);
        setPreferencesLoaded(true);
        setLoadedProfileId(profileId);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profileId, profile?.fuso]);

  const refreshAgenda = useCallback(async (isActive: () => boolean) => {
    if (!profileId || !permission?.granted || !preferencesLoaded) return;
    setLoadingEvents(true);
    setScreenError('');
    try {
      if (selectedCalendarIds.length === 0) {
        if (isActive()) setMonthEvents([]);
        await scheduleMeetingNotifications([], { userId: profileId, enabled: false, timeZone });
        return;
      }
      const display = monthRange(selectedDate, timeZone);
      const reminderStart = new Date();
      const reminderEnd = new Date(reminderStart.getTime() + REMINDER_HORIZON_DAYS * 24 * 60 * 60_000);
      const [visibleEvents, upcomingEvents] = await Promise.all([
        listCalendarEvents(selectedCalendarIds, display.start, display.end),
        listCalendarEvents(selectedCalendarIds, reminderStart, reminderEnd),
      ]);
      if (isActive()) setMonthEvents(visibleEvents);
      await scheduleMeetingNotifications(upcomingEvents, {
        userId: profileId,
        enabled: meetingAlertsEnabled,
        beforeMinutes: REMINDER_MINUTES,
        timeZone,
      });
    } catch (reason) {
      if (isActive()) setScreenError(friendlyError(reason));
    } finally {
      if (isActive()) setLoadingEvents(false);
    }
  }, [profileId, permission?.granted, preferencesLoaded, selectedCalendarIds, selectedDate, timeZone, meetingAlertsEnabled]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void refreshAgenda(() => active);
    return () => { active = false; };
  }, [refreshAgenda]));

  const persistPreferences = async (ids: string[], alertsEnabled = meetingAlertsEnabled) => {
    if (!profile?.id) return;
    const next = { selectedCalendarIds: ids, meetingAlertsEnabled: alertsEnabled };
    await saveCalendarPreferences(profile.id, next);
  };

  const toggleCalendar = async (calendarId: string, enabled: boolean) => {
    const next = enabled
      ? [...new Set([...selectedCalendarIds, calendarId])]
      : selectedCalendarIds.filter((id) => id !== calendarId);
    setSelectedCalendarIds(next);
    setMessage('');
    try { await persistPreferences(next); }
    catch { setScreenError('Não foi possível guardar a seleção dos calendários neste aparelho.'); }
  };

  const toggleMeetingAlerts = async (enabled: boolean) => {
    setMeetingAlertsEnabled(enabled);
    try { await persistPreferences(selectedCalendarIds, enabled); }
    catch { setScreenError('Não foi possível guardar a preferência de avisos neste aparelho.'); }
  };

  const enableCalendarAccess = async (): Promise<DeviceCalendar[] | null> => {
    setRequestingAccess(true);
    setScreenError('');
    try {
      const access = await requestCalendarAccess();
      setPermission(access);
      if (!access.granted) {
        setScreenError(access.available ? 'A permissão de calendário não foi concedida. Você pode ativá-la nas configurações do aparelho.' : 'O calendário nativo está disponível apenas no aplicativo mobile instalado.');
        return null;
      }
      const availableCalendars = await listDeviceCalendars();
      setCalendars(availableCalendars);
      setMessage('Calendários carregados. Escolha quais deseja exibir e usar para avisos.');
      return availableCalendars;
    } catch (reason) { setScreenError(friendlyError(reason)); return null; }
    finally { setRequestingAccess(false); }
  };

  const openCreateMeeting = async () => {
    setFormError('');
    setRiskMessage('');
    setMeetingTitle('');
    setMeetingDate(selectedDate);
    setMeetingStart('09:00');
    setMeetingEnd('09:30');
    setMeetingLocation('');
    setMeetingNotes('');
    setExpectedEntryTime(estimateTypicalEntryTime(history, selectedDate, timeZone)?.time || '');
    let availableCalendars = calendars;
    if (!permission?.granted) {
      const grantedCalendars = await enableCalendarAccess();
      if (!grantedCalendars) return;
      availableCalendars = grantedCalendars;
    } else if (availableCalendars.length === 0) availableCalendars = await listDeviceCalendars();
    setCalendars(availableCalendars);
    const writable = availableCalendars.filter((calendar) => calendar.allowsModifications);
    if (writable.length === 0) {
      setScreenError('Não há calendário gravável disponível. Adicione ou sincronize uma conta no calendário do aparelho e tente novamente.');
      return;
    }
    setTargetCalendarId(writable.find((calendar) => calendar.isPrimary)?.id || writable[0].id);
    setCreateVisible(true);
  };

  const closeCreateMeeting = () => {
    setCreateVisible(false);
    setRiskMessage('');
    setFormError('');
  };

  const handleSaveMeeting = async (confirmRisk = false) => {
    if (!profile?.id) return;
    setFormError('');
    if (!meetingTitle.trim()) { setFormError('Informe o título da reunião.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) { setFormError('Informe a data no formato AAAA-MM-DD.'); return; }
    if (!isValidClock(meetingStart) || !isValidClock(meetingEnd)) { setFormError('Informe início e término no formato HH:mm.'); return; }
    const startDate = zonedDateTime(meetingDate, meetingStart, timeZone);
    const endDate = zonedDateTime(meetingDate, meetingEnd, timeZone);
    if (!startDate || !endDate || endDate <= startDate) { setFormError('O término deve ser posterior ao início e a reunião deve terminar no mesmo dia.'); return; }
    if (startDate <= new Date()) { setFormError('A reunião deve começar no futuro.'); return; }
    if (!targetCalendarId || !writableCalendars.some((calendar) => calendar.id === targetCalendarId) && !calendars.some((calendar) => calendar.id === targetCalendarId && calendar.allowsModifications)) {
      setFormError('Escolha um calendário do aparelho que permita gravação.'); return;
    }

    const actualEntry = history.find((entry) => entry.data === meetingDate && entry.tipo === 'entrada');
    const estimate = actualEntry ? null : estimateTypicalEntryTime(history, meetingDate, timeZone);
    const manualEstimate = expectedEntryTime.trim();
    const selectedEntryTime = actualEntry ? undefined : manualEstimate || estimate?.time;
    if (!actualEntry && !selectedEntryTime) {
      setFormError('Não há histórico suficiente para estimar a entrada deste dia. Informe o horário previsto de início da jornada para calcular o aviso.');
      return;
    }
    if (selectedEntryTime && !isValidClock(selectedEntryTime)) { setFormError('Informe o horário previsto de entrada no formato HH:mm.'); return; }

    const projection = projectWorkedRangeAt(history, meetingDate, endDate, lunchMinutes, timeZone, selectedEntryTime);
    if (!projection) { setFormError('Não foi possível calcular as horas da jornada para esta data.'); return; }
    const exceedsTenHours = projection.maximumMinutes > 600;
    const exceedsPersonal = projection.maximumMinutes > Math.min(600, personalLimit);
    if ((exceedsTenHours || exceedsPersonal) && !confirmRisk) {
      const source = actualEntry
        ? `a entrada registrada às ${formatInTimeZone(new Date(actualEntry.registrado_em), timeZone, 'HH:mm')}`
        : estimate && manualEstimate === estimate.time
          ? `a estimativa de entrada às ${estimate.time}, baseada em ${estimate.sampleDays} jornadas recentes`
          : `o horário previsto de entrada às ${selectedEntryTime}`;
      const rangeLabel = projection.minimumMinutes === projection.maximumMinutes
        ? `${formatMinutesHHMM(projection.minimumMinutes)}`
        : `${formatMinutesHHMM(projection.minimumMinutes)} a ${formatMinutesHHMM(projection.maximumMinutes)}`;
      const lunchContext = projection.breakEvidence === 'estimated' && projection.minimumMinutes !== projection.maximumMinutes
        ? `Sem uma batida de saída para almoço, a faixa varia conforme a pausa de ${lunchMinutes} minutos ocorra antes do fim.`
        : projection.breakEvidence === 'not-started'
          ? 'A saída para almoço ainda não ocorreu até esse término, então nenhuma pausa foi descontada.'
          : `A projeção considera a batida real de saída para almoço e a duração configurada de ${lunchMinutes} minutos.`;
      const reason = exceedsTenHours
        ? projection.minimumMinutes > 600
          ? 'Mesmo considerando o almoço configurado, a jornada ultrapassaria 10:00 horas.'
          : 'A jornada poderá ultrapassar 10:00 horas se a pausa ainda não tiver ocorrido até o término.'
        : `A jornada poderá exceder seu limite pessoal de ${formatMinutesHHMM(personalLimit)} horas.`;
      setRiskMessage(`A reunião terminaria às ${meetingEnd}. Considerando ${source}, a projeção é de ${rangeLabel} horas trabalhadas. ${lunchContext} ${reason} Você pode voltar e ajustar ou confirmar a reunião mesmo assim.`);
      return;
    }

    setSavingMeeting(true);
    try {
      const created = await createCalendarEvent({
        calendarId: targetCalendarId,
        title: meetingTitle,
        startDate,
        endDate,
        timeZone,
        location: meetingLocation,
        notes: meetingNotes,
      });
      const nextIds = [...new Set([...selectedCalendarIds, targetCalendarId])];
      setSelectedCalendarIds(nextIds);
      await persistPreferences(nextIds);
      setCreateVisible(false);
      setRiskMessage('');
      setMessage('Reunião gravada no calendário do aparelho. O Olha o Ponto avisará 5 minutos antes se os avisos da Agenda estiverem ativos.');
      // The screen refreshes the selected device calendars and schedules only Agenda reminders.
      void created;
    } catch (reason) { setFormError(friendlyError(reason)); }
    finally { setSavingMeeting(false); }
  };

  if (!profile || loading || loadedProfileId !== profile.id) return <ScreenShell><AppText variant="body">Carregando Agenda...</AppText></ScreenShell>;

  const today = todayInZone(timeZone);
  const hasCalendarAccess = Boolean(permission?.granted);
  const calendarFeatureAvailable = permission?.available !== false;

  return (
    <ScreenShell contentStyle={styles.page}>
      <PageHeading
        eyebrow="Compromissos e reuniões"
        title="Agenda"
        subtitle="Calendário do aparelho, Outlook/Microsoft 365/Teams e Google quando sincronizados."
        right={<Pressable onPress={() => router.push('/(tabs)/perfil')} accessibilityRole="button" accessibilityLabel="Abrir Perfil" style={[styles.avatar, { backgroundColor: `${colors.teal}25` }]}><AppText variant="subtitle" color={colors.deepTeal}>{profile.nome.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</AppText></Pressable>}
      />

      {screenError ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{screenError}</AppText> : null}
      {message ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{message}</AppText> : null}

      {loading ? (
        <SurfaceCard><AppText variant="small" color={colors.muted}>Carregando calendários e histórico de jornada...</AppText></SurfaceCard>
      ) : !calendarFeatureAvailable ? (
        <SurfaceCard tone="soft" style={{ gap: 10 }}>
          <MaterialCommunityIcons name="calendar-alert" size={26} color={colors.deepTeal} />
          <AppText variant="subtitle">Calendário disponível no APK mobile</AppText>
          <AppText variant="small" color={colors.muted}>A integração com o calendário nativo exige o aplicativo instalado. A tela Web não lê nem grava eventos.</AppText>
        </SurfaceCard>
      ) : !hasCalendarAccess ? (
        <SurfaceCard style={{ gap: 12 }}>
          <AppText variant="subtitle">Conectar calendário do aparelho</AppText>
          <AppText variant="small" color={colors.muted}>O app só acessa calendários depois da sua permissão e apenas os que você selecionar. Os títulos e detalhes dos eventos ficam no aparelho; não são enviados ao Supabase.</AppText>
          <AppText variant="small" color={colors.muted}>Para Outlook/Teams, sincronize o calendário da conta no app Outlook para Android. O Google Calendar também precisa estar sincronizado no calendário do aparelho. Digitar um e-mail sozinho não autoriza acesso.</AppText>
          <ActionButton title="Permitir acesso ao calendário" onPress={() => { void enableCalendarAccess(); }} loading={requestingAccess} icon={<MaterialCommunityIcons name="calendar-sync" size={20} color="#FFFFFF" />} />
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard style={{ gap: 12 }}>
            <View style={styles.sectionRow}><View style={{ flex: 1, gap: 4 }}><AppText variant="subtitle">Calendários sincronizados</AppText><AppText variant="tiny" color={colors.muted}>Marque quais eventos deseja visualizar e usar nos avisos.</AppText></View><StatusPill tone={selectedCalendarIds.length ? 'teal' : 'neutral'}>{selectedCalendarIds.length} selecionados</StatusPill></View>
            {calendars.length === 0 ? <AppText variant="small" color={colors.muted}>Nenhum calendário foi encontrado. Adicione sua conta Microsoft/Google ao calendário do aparelho e ative a sincronização.</AppText> : calendars.map((calendar) => (
              <View key={calendar.id} style={[styles.calendarRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.calendarDot, { backgroundColor: calendar.isPrimary ? colors.deepTeal : colors.teal }]} />
                <View style={{ flex: 1, gap: 2 }}><AppText variant="small">{calendar.title}</AppText><AppText variant="tiny" color={colors.muted}>{calendar.sourceName}{calendar.allowsModifications ? ' · permite gravar reuniões' : ' · somente leitura'}</AppText></View>
                <Switch value={selectedCalendarIds.includes(calendar.id)} onValueChange={(value) => { void toggleCalendar(calendar.id, value); }} trackColor={{ false: colors.border, true: colors.teal }} thumbColor={selectedCalendarIds.includes(calendar.id) ? colors.deepTeal : '#F2F5F3'} accessibilityLabel={`Selecionar calendário ${calendar.title}`} />
              </View>
            ))}
            <View style={styles.switchLine}><View style={{ flex: 1, gap: 2 }}><AppText variant="small">Avisos do Olha o Ponto para reuniões</AppText><AppText variant="tiny" color={colors.muted}>Notificação local 5 minutos antes dos eventos selecionados. Pode duplicar um aviso do calendário original.</AppText></View><Switch value={meetingAlertsEnabled} onValueChange={(value) => { void toggleMeetingAlerts(value); }} trackColor={{ false: colors.border, true: colors.teal }} thumbColor={meetingAlertsEnabled ? colors.deepTeal : '#F2F5F3'} accessibilityLabel="Avisos do Olha o Ponto para reuniões" /></View>
            <AppText variant="tiny" color={colors.muted}>Eventos importados são somente leitura. Reuniões criadas aqui são gravadas no calendário que você escolher e podem sincronizar conforme a conta desse calendário.</AppText>
          </SurfaceCard>

          <SurfaceCard style={{ gap: 14 }}>
            <View style={styles.monthHeader}>
              <Pressable onPress={() => setSelectedDate(shiftedMonth(selectedDate, -1))} accessibilityRole="button" accessibilityLabel="Mês anterior" style={styles.monthButton}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.deepTeal} /></Pressable>
              <AppText variant="subtitle" style={{ textTransform: 'capitalize', textAlign: 'center', flex: 1 }}>{monthLabel}</AppText>
              <Pressable onPress={() => setSelectedDate(shiftedMonth(selectedDate, 1))} accessibilityRole="button" accessibilityLabel="Próximo mês" style={styles.monthButton}><MaterialCommunityIcons name="chevron-right" size={24} color={colors.deepTeal} /></Pressable>
            </View>
            <View style={styles.weekRow}>{WEEKDAYS.map((day) => <AppText key={day} variant="tiny" color={colors.muted} style={styles.weekday}>{day}</AppText>)}</View>
            <View style={styles.daysGrid}>{cells.map((date, index) => {
              const selected = date === selectedDate;
              const isToday = date === today;
              const hasEvent = date ? eventDateSet.has(date) : false;
              return date ? <Pressable key={date} onPress={() => setSelectedDate(date)} accessibilityRole="button" accessibilityLabel={`${date}${hasEvent ? ', tem reunião' : ''}`} accessibilityState={{ selected }} style={[styles.dayCell, { backgroundColor: selected ? colors.deepTeal : 'transparent', borderColor: isToday && !selected ? colors.teal : 'transparent' }]}><AppText variant="small" color={selected ? '#FFFFFF' : colors.foreground} style={{ fontWeight: isToday ? '700' : '500' }}>{date.slice(-2).replace(/^0/, '')}</AppText>{hasEvent ? <View style={[styles.eventDot, { backgroundColor: selected ? '#FFFFFF' : colors.coral }]} /> : null}</Pressable> : <View key={`empty-${index}`} style={styles.dayCell} />;
            })}</View>
            <View style={styles.sectionRow}><View style={{ flex: 1, gap: 2 }}><AppText variant="subtitle">{formatInTimeZone(new Date(`${selectedDate}T12:00:00`), timeZone, 'EEEE, d MMMM')}</AppText><AppText variant="tiny" color={colors.muted}>{loadingEvents ? 'Atualizando eventos...' : `${selectedDayEvents.length} compromisso(s)`}</AppText></View><Pressable onPress={() => setSelectedDate(today)} accessibilityRole="button" style={styles.todayButton}><AppText variant="small" color={colors.deepTeal}>Hoje</AppText></Pressable></View>
          </SurfaceCard>

          {selectedCalendarIds.length === 0 ? <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>Selecione ao menos um calendário para importar reuniões e ver os compromissos deste dia.</AppText></SurfaceCard> : selectedDayEvents.length === 0 ? <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>{loadingEvents ? 'Carregando compromissos...' : 'Nenhuma reunião neste dia nos calendários selecionados.'}</AppText></SurfaceCard> : selectedDayEvents.map((event) => {
            const risk = riskForEvent(event, history, lunchMinutes, timeZone, personalLimit);
            const timeLabel = event.allDay ? 'Dia todo' : `${formatInTimeZone(new Date(event.startDate), timeZone, 'HH:mm')}–${formatInTimeZone(new Date(event.endDate), timeZone, 'HH:mm')}`;
            const risky = Boolean(risk && (risk.exceedsTenHours || risk.exceedsPersonalLimit));
            const projectionLabel = risk && risk.minimumMinutes === risk.maximumMinutes
              ? formatMinutesHHMM(risk.minimumMinutes)
              : risk ? `${formatMinutesHHMM(risk.minimumMinutes)}–${formatMinutesHHMM(risk.maximumMinutes)}` : '';
            return <SurfaceCard key={`${event.calendarId}-${event.id}`} style={{ gap: 7, borderColor: risky ? colors.error : colors.border }}>
              <View style={styles.sectionRow}><AppText variant="subtitle" style={{ flex: 1 }}>{event.title}</AppText>{risky ? <StatusPill tone="danger">{risk?.exceedsTenHours ? 'RISCO >10H' : 'ACIMA DO LIMITE'}</StatusPill> : null}</View>
              <AppText variant="small" color={colors.deepTeal}>{timeLabel}</AppText>
              <AppText variant="tiny" color={colors.muted}>{calendars.find((calendar) => calendar.id === event.calendarId)?.title || 'Calendário sincronizado'}{event.location ? ` · ${event.location}` : ''}</AppText>
              {event.notes ? <AppText variant="small" color={colors.muted}>{event.notes}</AppText> : null}
              {risk ? <AppText variant="tiny" color={risk.exceedsTenHours ? colors.error : risk.exceedsPersonalLimit ? colors.warning : colors.muted}>{risk.exceedsTenHours ? risk.minimumMinutes > 600 ? `Mesmo considerando o almoço, a projeção é ${projectionLabel} horas trabalhadas, acima de 10:00.` : `A faixa possível é ${projectionLabel} horas; pode ultrapassar 10:00 se a pausa ainda não tiver ocorrido até o término.` : risk.exceedsPersonalLimit ? `A projeção possível é ${projectionLabel} horas, acima do limite pessoal de ${formatMinutesHHMM(personalLimit)}.` : `Projeção no término: ${projectionLabel} horas trabalhadas${risk.estimate ? ` (estimativa baseada em ${risk.estimate.sampleDays} dias)` : ''}.`}</AppText> : <AppText variant="tiny" color={colors.muted}>Não há entrada registrada ou histórico suficiente para estimar a jornada deste dia.</AppText>}
            </SurfaceCard>;
          })}

          {historyError ? <AppText variant="tiny" color={colors.muted}>Sem conexão com o histórico: avisos de risco futuros podem exigir que você informe a entrada prevista ao criar uma reunião.</AppText> : null}
          <ActionButton title="Marcar reunião" onPress={openCreateMeeting} icon={<MaterialCommunityIcons name="calendar-plus" size={20} color="#FFFFFF" />} />
          <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>O calendário só alerta para possíveis excessos; não bloqueia a reunião nem substitui o controle oficial de ponto.</AppText>
        </>
      )}

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={closeCreateMeeting}>
        <View style={styles.backdrop}>
          <SurfaceCard style={styles.modalCard}>
            <View style={styles.sectionRow}><View style={{ flex: 1, gap: 3 }}><AppText variant="title">Nova reunião</AppText><AppText variant="small" color={colors.muted}>O evento será gravado no calendário selecionado.</AppText></View><Pressable onPress={closeCreateMeeting} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.closeButton}><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              <TextField label="Título" value={meetingTitle} onChangeText={(value) => { setMeetingTitle(value); setRiskMessage(''); }} placeholder="Ex.: Reunião de equipe" maxLength={120} />
              <TextField label="Data (AAAA-MM-DD)" value={meetingDate} onChangeText={(value) => { setMeetingDate(value); setExpectedEntryTime(estimateTypicalEntryTime(history, value, timeZone)?.time || ''); setRiskMessage(''); }} placeholder={selectedDate} maxLength={10} />
              <View style={styles.timeFields}><View style={{ flex: 1 }}><TextField label="Início (HH:mm)" value={meetingStart} onChangeText={(value) => { setMeetingStart(value); setRiskMessage(''); }} keyboardType="numbers-and-punctuation" maxLength={5} /></View><View style={{ flex: 1 }}><TextField label="Término (HH:mm)" value={meetingEnd} onChangeText={(value) => { setMeetingEnd(value); setRiskMessage(''); }} keyboardType="numbers-and-punctuation" maxLength={5} /></View></View>
              {!actualEntryForMeeting ? <View style={{ gap: 6 }}><TextField label={selectedEventEstimate ? `Entrada prevista (estimativa de ${selectedEventEstimate.sampleDays} jornadas recentes)` : 'Entrada prevista da jornada para calcular o aviso'} value={expectedEntryTime} onChangeText={(value) => { setExpectedEntryTime(value); setRiskMessage(''); }} placeholder="Ex.: 07:31" keyboardType="numbers-and-punctuation" maxLength={5} /><AppText variant="tiny" color={colors.muted}>{selectedEventEstimate ? `Sugestão calculada pela mediana: ${selectedEventEstimate.time}. Ajuste se sua jornada nesse dia for diferente.` : 'Sem histórico suficiente, informe o horário previsto para este dia. O app não assume um horário fixo.'}</AppText></View> : <AppText variant="tiny" color={colors.muted}>A validação usará a entrada real registrada às {formatInTimeZone(new Date(actualEntryForMeeting.registrado_em), timeZone, 'HH:mm')}.</AppText>}
              <TextField label="Local (opcional)" value={meetingLocation} onChangeText={setMeetingLocation} placeholder="Sala, link ou endereço" maxLength={200} />
              <TextField label="Observações (opcional)" value={meetingNotes} onChangeText={setMeetingNotes} multiline numberOfLines={3} maxLength={1000} style={{ minHeight: 80, textAlignVertical: 'top' }} />
              <AppText variant="small" color={colors.muted}>Gravar em</AppText>
              {writableCalendars.map((calendar) => <Pressable key={calendar.id} onPress={() => { setTargetCalendarId(calendar.id); setRiskMessage(''); }} accessibilityRole="button" accessibilityState={{ selected: targetCalendarId === calendar.id }} style={[styles.targetCalendar, { borderColor: targetCalendarId === calendar.id ? colors.deepTeal : colors.border, backgroundColor: targetCalendarId === calendar.id ? `${colors.teal}18` : colors.input }]}><MaterialCommunityIcons name={targetCalendarId === calendar.id ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={targetCalendarId === calendar.id ? colors.deepTeal : colors.muted} /><View style={{ flex: 1 }}><AppText variant="small">{calendar.title}</AppText><AppText variant="tiny" color={colors.muted}>{calendar.sourceName}</AppText></View></Pressable>)}

              {riskMessage ? <SurfaceCard tone="soft" style={{ borderColor: colors.error, gap: 8 }}><View style={styles.sectionRow}><MaterialCommunityIcons name="alert-outline" size={22} color={colors.error} /><AppText variant="subtitle" color={colors.error} style={{ flex: 1 }}>Atenção: possível excesso de jornada</AppText></View><AppText variant="small">{riskMessage}</AppText><AppText variant="tiny" color={colors.muted}>Este é um aviso preventivo. Você pode corrigir o horário ou confirmar a marcação.</AppText><ActionButton title="Marcar mesmo assim" variant="danger" onPress={() => handleSaveMeeting(true)} loading={savingMeeting} /><ActionButton title="Voltar e ajustar" variant="outline" onPress={() => setRiskMessage('')} /></SurfaceCard> : null}
              {formError ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{formError}</AppText> : null}
              {!riskMessage ? <ActionButton title="Verificar e salvar reunião" onPress={() => handleSaveMeeting(false)} loading={savingMeeting} /> : null}
              <ActionButton title="Cancelar" variant="ghost" onPress={closeCreateMeeting} disabled={savingMeeting} />
            </ScrollView>
          </SurfaceCard>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 15, paddingTop: 18, paddingBottom: 28 },
  avatar: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  calendarRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  calendarDot: { width: 9, height: 9, borderRadius: 5 },
  switchLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24B3A218' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekday: { width: '14.285%', textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', height: 44, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  eventDot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3 },
  todayButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#24B3A218' },
  backdrop: { flex: 1, backgroundColor: '#081A1880', justifyContent: 'center', padding: 12 },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '94%', alignSelf: 'center', gap: 12 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  timeFields: { flexDirection: 'row', gap: 12 },
  targetCalendar: { minHeight: 54, borderWidth: 1, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
});
