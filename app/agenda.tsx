import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { ActionButton, AppText, KeyboardModalContent, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { loadAgendaMeetings, saveAgendaMeetings } from '@/services/agenda-service';
import { loadCalendarPreferences, saveCalendarPreferences, type CalendarPreferences } from '@/services/calendar-preferences';
import { createCalendarEvent, deleteCalendarEvent, getCalendarPermissionState, listCalendarEvents, listDeviceCalendars, requestCalendarAccess, updateCalendarEvent, type DeviceCalendar, type DeviceCalendarEvent } from '@/services/calendar-service';
import { loadAllEntries, loadEntriesByDate } from '@/services/time-entry-service';
import { prepareLocalNotifications, scheduleMeetingNotifications } from '@/services/notification-service';
import { useAppStore } from '@/store/app-store';
import type { AgendaMeeting, TimeEntry } from '@/types/app';
import { parseAgendaDateTime, parseAgendaReminderMinutes } from '@/utils/agenda';
import { estimateTypicalEntryTime, projectWorkedRangeAt } from '@/utils/calendar-risk';
import { getWorkScheduleForDate } from '@/utils/work-schedules';

const ZONE_FALLBACK = 'America/Bahia';
const MINUTE_MS = 60_000;
const DEFAULT_PREFS: CalendarPreferences = { selectedCalendarIds: [], writeCalendarId: null, meetingReminderMinutes: 5, meetingAlertsEnabled: true };

type RiskStatus = {
  kind: 'possible' | 'likely' | 'unknown';
  text: string;
  minimumMinutes?: number;
  maximumMinutes?: number;
  estimatedEntry?: string;
};
type DisplayMeeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  reminderMinutes: number;
  calendarId: string | null;
  nativeEventId: string | null;
  imported: boolean;
  risk: RiskStatus | null;
};

function nextHour(): Date {
  const value = new Date();
  value.setMinutes(value.getMinutes() + 60, 0, 0);
  return value;
}
function asLocalDateInput(value: Date, timeZone: string): string { return formatInTimeZone(value, timeZone, 'dd/MM/yyyy'); }
function asLocalTimeInput(value: Date, timeZone: string): string { return formatInTimeZone(value, timeZone, 'HH:mm'); }
function dateTimeInZone(value: string | Date, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Data indisponível';
}
function parseDateTimeInZone(dateText: string, timeText: string, timeZone: string): Date | null {
  if (!parseAgendaDateTime(dateText, timeText)) return null;
  const [day, month, year] = dateText.trim().split('/');
  try {
    const value = fromZonedTime(`${year}-${month}-${day}T${timeText.trim()}:00`, timeZone);
    return Number.isFinite(value.getTime()) ? value : null;
  } catch { return null; }
}
function uniqueNativeKey(calendarId: string, eventId: string): string { return `${calendarId}::${eventId}`; }
function formatMinutes(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
function toAppMeeting(event: DeviceCalendarEvent, reminderMinutes: number): AgendaMeeting {
  return {
    id: `device-${uniqueNativeKey(event.calendarId, event.id)}`,
    title: event.title,
    starts_at: event.startDate,
    ends_at: event.endDate,
    reminder_minutes: reminderMinutes,
    calendar_id: event.calendarId,
    native_event_id: event.id,
  };
}
function isOwnedEvent(event: DeviceCalendarEvent, localMeetings: readonly AgendaMeeting[]): boolean {
  return localMeetings.some((meeting) => meeting.calendar_id === event.calendarId && meeting.native_event_id === event.id);
}

export default function AgendaScreen() {
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const profileId = profile?.id;
  const userId = session?.user.id;
  const soundEnabled = profile?.preferencias_alerta?.som !== false;
  const vibrationEnabled = profile?.preferencias_alerta?.vibracao !== false;
  const zone = profile?.fuso || ZONE_FALLBACK;

  const [meetings, setMeetings] = useState<AgendaMeeting[]>([]);
  const [deviceCalendars, setDeviceCalendars] = useState<DeviceCalendar[]>([]);
  const [deviceEvents, setDeviceEvents] = useState<DeviceCalendarEvent[]>([]);
  const [prefs, setPrefs] = useState<CalendarPreferences>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<{ available: boolean; granted: boolean; canAskAgain: boolean } | null>(null);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState<boolean | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisplayMeeting | null>(null);
  const [riskTarget, setRiskTarget] = useState<{ risk: RiskStatus; event: { title: string; startsAt: Date; endsAt: Date; calendarId: string; existing?: DisplayMeeting } } | null>(null);
  const [editing, setEditing] = useState<DisplayMeeting | null>(null);
  const [title, setTitle] = useState('');
  const [dateText, setDateText] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [reminderText, setReminderText] = useState('5');
  const [expectedEntryText, setExpectedEntryText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [riskMap, setRiskMap] = useState<Record<string, RiskStatus | null>>({});

  useEffect(() => {
    const initial = setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  const refreshEvents = useCallback(async (
    calendarIds: readonly string[],
    localMeetings: readonly AgendaMeeting[],
    reminderMinutes: number,
    alertsEnabled = prefs.meetingAlertsEnabled,
  ) => {
    let events: DeviceCalendarEvent[] = [];
    if (permission?.granted && calendarIds.length) {
      const start = new Date(Date.now() - 7 * 24 * 60 * MINUTE_MS);
      const end = new Date(Date.now() + 90 * 24 * 60 * MINUTE_MS);
      events = await listCalendarEvents(calendarIds, start, end);
    }
    setDeviceEvents(events);
    const externalAsMeetings = events
      .filter((event) => !event.allDay && !isOwnedEvent(event, localMeetings))
      .map((event) => toAppMeeting(event, reminderMinutes));
    const allForNotifications = [...localMeetings, ...externalAsMeetings];
    if (userId && profileId === userId) {
      const result = await scheduleMeetingNotifications(alertsEnabled ? allForNotifications : [], {
        userId,
        soundEnabled,
        vibrationEnabled,
      }).catch(() => ({ permissionGranted: false, scheduledCount: 0 }));
      setNotificationsGranted(result.permissionGranted);
    }
  }, [permission?.granted, userId, profileId, prefs.meetingAlertsEnabled, soundEnabled, vibrationEnabled]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      const deferred = setTimeout(() => {
        if (!active) return;
        setMeetings([]);
        setDeviceEvents([]);
        setLoading(false);
        setError('Entre na sua conta para abrir a Agenda.');
      }, 0);
      return () => { active = false; clearTimeout(deferred); };
    }
    void Promise.all([loadAgendaMeetings(userId), loadCalendarPreferences(userId), Notifications.getPermissionsAsync(), loadAllEntries()])
      .then(async ([items, preferences, notificationPermission, entryResult]) => {
        if (!active) return;
        setMeetings(items);
        setDeviceEvents([]);
        setPrefs(preferences);
        setNotificationsGranted(notificationPermission.status === 'granted');
        if (entryResult.data) setHistory(entryResult.data);
        const calendarPermission = await getCalendarPermissionState().catch(() => ({ available: false, granted: false, canAskAgain: false }));
        if (!active) return;
        setPermission(calendarPermission);
        let nativeEvents: DeviceCalendarEvent[] = [];
        if (calendarPermission.granted) {
          const calendars = await listDeviceCalendars();
          if (!active) return;
          setDeviceCalendars(calendars);
          const existing = new Set(calendars.map((calendar) => calendar.id));
          const validSelected = preferences.selectedCalendarIds.filter((id) => existing.has(id));
          const nextWriteId = preferences.writeCalendarId && existing.has(preferences.writeCalendarId)
            ? preferences.writeCalendarId
            : calendars.find((calendar) => calendar.allowsModifications)?.id ?? null;
          if (validSelected.length !== preferences.selectedCalendarIds.length || nextWriteId !== preferences.writeCalendarId) {
            const nextPrefs = { ...preferences, selectedCalendarIds: validSelected, writeCalendarId: nextWriteId };
            setPrefs(nextPrefs);
            await saveCalendarPreferences(userId, nextPrefs).catch(() => undefined);
          }
          if (validSelected.length) {
            nativeEvents = await listCalendarEvents(validSelected, new Date(Date.now() - 7 * 24 * 60 * MINUTE_MS), new Date(Date.now() + 90 * 24 * 60 * MINUTE_MS));
            if (!active) return;
            setDeviceEvents(nativeEvents);
          }
        }
        if (profileId === userId) {
          const imported = nativeEvents.filter((event) => !event.allDay && !isOwnedEvent(event, items)).map((event) => toAppMeeting(event, preferences.meetingReminderMinutes));
          await scheduleMeetingNotifications(preferences.meetingAlertsEnabled ? [...items, ...imported] : [], { userId, soundEnabled, vibrationEnabled }).catch(() => undefined);
        }
      })
      .catch(() => { if (active) setError('Não foi possível carregar a Agenda neste aparelho.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, profileId, soundEnabled, vibrationEnabled]);

  const displayMeetings = useMemo<DisplayMeeting[]>(() => {
    const local: DisplayMeeting[] = meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.starts_at,
      endsAt: meeting.ends_at ?? null,
      reminderMinutes: meeting.reminder_minutes,
      calendarId: meeting.calendar_id ?? null,
      nativeEventId: meeting.native_event_id ?? null,
      imported: false,
      risk: null,
    }));
    const ownedKeys = new Set(meetings.filter((meeting) => meeting.calendar_id && meeting.native_event_id).map((meeting) => uniqueNativeKey(meeting.calendar_id!, meeting.native_event_id!)));
    const imported: DisplayMeeting[] = deviceEvents
      .filter((event) => !event.allDay && !ownedKeys.has(uniqueNativeKey(event.calendarId, event.id)))
      .map((event) => ({
        id: `imported-${uniqueNativeKey(event.calendarId, event.id)}`,
        title: event.title,
        startsAt: event.startDate,
        endsAt: event.endDate,
        reminderMinutes: prefs.meetingReminderMinutes,
        calendarId: event.calendarId,
        nativeEventId: event.id,
        imported: true,
        risk: null,
      }));
    const byId = new Map<string, DisplayMeeting>();
    for (const item of [...local, ...imported]) byId.set(item.id, item);
    return [...byId.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [meetings, deviceEvents, prefs.meetingReminderMinutes]);

  const calendarLabel = useCallback((calendarId: string | null) => {
    if (!calendarId) return 'Agenda local antiga';
    const calendar = deviceCalendars.find((item) => item.id === calendarId);
    return calendar ? `${calendar.title} · ${calendar.sourceName}` : 'Calendário removido do aparelho';
  }, [deviceCalendars]);

  const assessRisk = useCallback(async (date: string, endsAt: Date, expectedEntry?: string): Promise<RiskStatus | null> => {
    const dateResult = await loadEntriesByDate(date);
    const sameDay = dateResult.data ?? history.filter((entry) => entry.data === date);
    const historyResult = await loadAllEntries();
    const allEntries = historyResult.data ?? history;
    const entryRecorded = sameDay.some((entry) => entry.tipo === 'entrada');
    const estimate = entryRecorded ? null : estimateTypicalEntryTime(allEntries, date, zone);
    const startClock = entryRecorded ? undefined : expectedEntry || estimate?.time;
    if (!entryRecorded && !startClock) {
      return {
        kind: 'unknown',
        text: 'Não há entrada registrada nem histórico suficiente para prever o início desta jornada. Informe o horário de entrada previsto para avaliar o risco.',
      };
    }
    const schedule = getWorkScheduleForDate(profile?.preferencias_alerta, date, profile?.almoco_minutos ?? 60);
    const projection = projectWorkedRangeAt(sameDay, date, endsAt, schedule.lunch_minutes, zone, startClock);
    if (!projection) return null;
    if (projection.maximumMinutes <= 600) return null;
    const risk: RiskStatus = {
      kind: projection.minimumMinutes > 600 ? 'likely' : 'possible',
      minimumMinutes: projection.minimumMinutes,
      maximumMinutes: projection.maximumMinutes,
      estimatedEntry: !entryRecorded ? startClock : undefined,
      text: projection.minimumMinutes > 600
        ? `A projeção passa de 10:00 horas trabalhadas mesmo considerando o intervalo configurado. Faixa estimada: ${formatMinutes(projection.minimumMinutes)} a ${formatMinutes(projection.maximumMinutes)}.`
        : `Existe possibilidade de ultrapassar 10:00 horas trabalhadas se o intervalo não ocorrer antes do fim desta reunião. Faixa estimada: ${formatMinutes(projection.minimumMinutes)} a ${formatMinutes(projection.maximumMinutes)}.`,
    };
    return risk;
  }, [history, profile?.preferencias_alerta, profile?.almoco_minutos, zone]);

  useEffect(() => {
    let active = true;
    const candidates = displayMeetings.filter((meeting) => meeting.endsAt && new Date(meeting.endsAt).getTime() > Date.now());
    if (!candidates.length) return;
    void loadAllEntries().then((result) => {
      const allEntries = result.data ?? history;
      return Promise.all(candidates.map(async (meeting) => {
        const date = formatInTimeZone(new Date(meeting.startsAt), zone, 'yyyy-MM-dd');
        const dayEntries = allEntries.filter((entry) => entry.data === date);
        const hasStart = dayEntries.some((entry) => entry.tipo === 'entrada');
        const estimate = hasStart ? null : estimateTypicalEntryTime(allEntries, date, zone);
        if (!hasStart && !estimate) return [meeting.id, { kind: 'unknown', text: 'Não foi possível estimar a entrada desta data para avaliar o limite.' } as RiskStatus] as const;
        const schedule = getWorkScheduleForDate(profile?.preferencias_alerta, date, profile?.almoco_minutos ?? 60);
        const projection = projectWorkedRangeAt(dayEntries, date, meeting.endsAt!, schedule.lunch_minutes, zone, estimate?.time);
        if (!projection || projection.maximumMinutes <= 600) return [meeting.id, null] as const;
        return [meeting.id, {
          kind: projection.minimumMinutes > 600 ? 'likely' : 'possible',
          minimumMinutes: projection.minimumMinutes,
          maximumMinutes: projection.maximumMinutes,
          estimatedEntry: estimate?.time,
          text: projection.minimumMinutes > 600
            ? `Pode levar a ${formatMinutes(projection.minimumMinutes)}–${formatMinutes(projection.maximumMinutes)} de trabalho no dia.`
            : `Pode levar a ${formatMinutes(projection.minimumMinutes)}–${formatMinutes(projection.maximumMinutes)} se o almoço não ocorrer antes do fim.`,
        } as RiskStatus] as const;
      }));
    }).then((pairs) => {
      if (!active) return;
      const byId = new Map(pairs);
      setRiskMap(Object.fromEntries(byId));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [displayMeetings, history, profile?.preferencias_alerta, profile?.almoco_minutos, zone]);

  const displayed = useMemo(() => displayMeetings.map((meeting) => ({ ...meeting, risk: riskMap[meeting.id] ?? meeting.risk })), [displayMeetings, riskMap]);

  const savePrefs = async (next: CalendarPreferences) => {
    if (!userId) return;
    setPrefs(next);
    await saveCalendarPreferences(userId, next);
    if (permission?.granted) await refreshEvents(next.selectedCalendarIds, meetings, next.meetingReminderMinutes, next.meetingAlertsEnabled);
  };

  const connectCalendars = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await requestCalendarAccess();
      setPermission(result);
      if (!result.granted) {
        setError(result.available ? 'Permita o acesso aos calendários para importar e gravar reuniões. Você pode alterar isso nas configurações do aparelho.' : 'A leitura e gravação de calendários está disponível no APK Android/iOS.');
        return;
      }
      const calendars = await listDeviceCalendars();
      setDeviceCalendars(calendars);
      const validIds = prefs.selectedCalendarIds.filter((id) => calendars.some((calendar) => calendar.id === id));
      const writeId = prefs.writeCalendarId && calendars.some((calendar) => calendar.id === prefs.writeCalendarId && calendar.allowsModifications)
        ? prefs.writeCalendarId
        : calendars.find((calendar) => calendar.allowsModifications)?.id ?? null;
      const next = { ...prefs, selectedCalendarIds: validIds, writeCalendarId: writeId };
      setPrefs(next);
      if (userId) await saveCalendarPreferences(userId, next);
      const events = validIds.length
        ? await listCalendarEvents(validIds, new Date(Date.now() - 7 * 24 * 60 * MINUTE_MS), new Date(Date.now() + 90 * 24 * 60 * MINUTE_MS))
        : [];
      setDeviceEvents(events);
      if (userId && profileId === userId) {
        const imported = events.filter((event) => !event.allDay && !isOwnedEvent(event, meetings)).map((event) => toAppMeeting(event, next.meetingReminderMinutes));
        const scheduled = await scheduleMeetingNotifications(next.meetingAlertsEnabled ? [...meetings, ...imported] : [], { userId, soundEnabled, vibrationEnabled }).catch(() => ({ permissionGranted: false, scheduledCount: 0 }));
        setNotificationsGranted(scheduled.permissionGranted);
      }
      setNotice('Calendários encontrados. Marque os que deseja exibir; escolha um calendário gravável para criar reuniões.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível acessar os calendários do aparelho.');
    } finally { setSaving(false); }
  };

  const toggleCalendar = async (calendarId: string) => {
    const selected = prefs.selectedCalendarIds.includes(calendarId);
    const nextIds = selected ? prefs.selectedCalendarIds.filter((id) => id !== calendarId) : [...prefs.selectedCalendarIds, calendarId];
    const next: CalendarPreferences = { ...prefs, selectedCalendarIds: nextIds };
    try {
      await savePrefs(next);
      setNotice(selected ? 'Calendário removido da Agenda.' : 'Calendário selecionado. Os eventos sincronizados aparecerão abaixo.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a seleção.'); }
  };

  const chooseWriteCalendar = async (calendarId: string) => {
    const next = { ...prefs, writeCalendarId: calendarId };
    try { await savePrefs(next); setNotice('Calendário escolhido para gravar novas reuniões.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o calendário.'); }
  };

  const refreshCalendars = async () => {
    if (!permission?.granted) { await connectCalendars(); return; }
    setRefreshing(true); setError('');
    try {
      const calendars = await listDeviceCalendars();
      setDeviceCalendars(calendars);
      await refreshEvents(prefs.selectedCalendarIds, meetings, prefs.meetingReminderMinutes);
      const result = await loadAllEntries();
      if (result.data) setHistory(result.data);
      setNotice('Agenda atualizada a partir dos calendários selecionados no aparelho.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a Agenda.'); }
    finally { setRefreshing(false); }
  };

  const resetForm = () => {
    const start = nextHour();
    const end = new Date(start.getTime() + 60 * MINUTE_MS);
    setEditing(null);
    setTitle('');
    setDateText(asLocalDateInput(start, zone));
    setStartText(asLocalTimeInput(start, zone));
    setEndText(asLocalTimeInput(end, zone));
    setReminderText(String(prefs.meetingReminderMinutes));
    setExpectedEntryText('');
    setError('');
  };
  const openCreate = () => {
    resetForm(); setNotice(''); setFormVisible(true);
  };
  const openEdit = (meeting: DisplayMeeting) => {
    const startsAt = new Date(meeting.startsAt);
    const endsAt = meeting.endsAt ? new Date(meeting.endsAt) : new Date(startsAt.getTime() + 60 * MINUTE_MS);
    setEditing(meeting);
    setTitle(meeting.title);
    setDateText(asLocalDateInput(startsAt, zone));
    setStartText(asLocalTimeInput(startsAt, zone));
    setEndText(asLocalTimeInput(endsAt, zone));
    setReminderText(String(meeting.reminderMinutes));
    setExpectedEntryText(meeting.risk?.estimatedEntry ?? '');
    setError(''); setNotice(''); setFormVisible(true);
  };

  const allMeetingsForAlerts = async (nextLocal: AgendaMeeting[]) => {
    const imported = deviceEvents.filter((event) => !event.allDay && !isOwnedEvent(event, nextLocal)).map((event) => toAppMeeting(event, prefs.meetingReminderMinutes));
    const combined = [...nextLocal, ...imported];
    if (!userId || profileId !== userId) return { permissionGranted: false, scheduledCount: 0 };
    const result = await scheduleMeetingNotifications(prefs.meetingAlertsEnabled ? combined : [], { userId, soundEnabled, vibrationEnabled }).catch(() => ({ permissionGranted: false, scheduledCount: 0 }));
    setNotificationsGranted(result.permissionGranted);
    return result;
  };

  const persistMeetings = async (next: AgendaMeeting[]) => {
    if (!userId) throw new Error('Sua sessão não está ativa. Entre novamente para alterar a Agenda.');
    await saveAgendaMeetings(userId, next);
    setMeetings(next);
    const result = await prepareLocalNotifications().catch(() => ({ granted: false, exactAlarms: false }));
    setNotificationsGranted(result.granted);
    return allMeetingsForAlerts(next);
  };

  const performSaveMeeting = async (event: { title: string; startsAt: Date; endsAt: Date; calendarId: string; existing?: DisplayMeeting }) => {
    const reminderMinutes = parseAgendaReminderMinutes(reminderText);
    if (reminderMinutes === null) throw new Error('O aviso deve ser um número inteiro entre 1 e 1440 minutos.');
    if (!userId) throw new Error('Entre na sua conta para salvar a reunião.');
    if (Platform.OS === 'web') throw new Error('Para gravar a reunião no calendário sincronizado, use o APK no Android ou iOS.');
    const nativeInput = { calendarId: event.calendarId, title: event.title, startDate: event.startsAt, endDate: event.endsAt, timeZone: zone };
    let nativeEvent: DeviceCalendarEvent;
    if (event.existing?.nativeEventId && event.existing.calendarId) {
      nativeEvent = await updateCalendarEvent(event.existing.nativeEventId, event.existing.calendarId, nativeInput);
    } else {
      nativeEvent = await createCalendarEvent(nativeInput);
    }
    const saved: AgendaMeeting = {
      id: event.existing?.id ?? `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: nativeEvent.title,
      starts_at: nativeEvent.startDate,
      ends_at: nativeEvent.endDate,
      reminder_minutes: reminderMinutes,
      calendar_id: nativeEvent.calendarId,
      native_event_id: nativeEvent.id,
    };
    const next = [...meetings.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const result = await persistMeetings(next);
    setFormVisible(false); setRiskTarget(null);
    setNotice(result.permissionGranted ? 'Reunião gravada no calendário escolhido; lembrete do Olha o Ponto programado.' : 'Reunião gravada no calendário escolhido. Ative as notificações do aplicativo para receber o lembrete.');
    await refreshEvents(prefs.selectedCalendarIds, next, prefs.meetingReminderMinutes).catch(() => undefined);
  };

  const saveMeeting = async (confirmed = false) => {
    const cleanTitle = title.trim();
    const startsAt = parseDateTimeInZone(dateText, startText, zone);
    const endsAt = parseDateTimeInZone(dateText, endText, zone);
    const reminderMinutes = parseAgendaReminderMinutes(reminderText);
    const selectedCalendar = deviceCalendars.find((calendar) => calendar.id === prefs.writeCalendarId && calendar.allowsModifications);
    if (!cleanTitle) { setError('Informe o título da reunião.'); return; }
    if (!startsAt || !endsAt) { setError('Informe data, início e término válidos.'); return; }
    if (endsAt <= startsAt) { setError('O término deve ser depois do início da reunião.'); return; }
    if (startsAt.getTime() <= Date.now() && !editing) { setError('A data e a hora da reunião precisam estar no futuro.'); return; }
    if (expectedEntryText.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(expectedEntryText.trim())) { setError('A entrada prevista deve usar o formato HH:mm, por exemplo 07:31.'); return; }
    if (reminderMinutes === null) { setError('O aviso deve ser um número inteiro entre 1 e 1440 minutos.'); return; }
    if (!userId) { setError('Entre na sua conta para salvar a reunião.'); return; }
    if (!selectedCalendar && !editing?.calendarId) { setError('Conecte os calendários e escolha um calendário que permita gravação.'); return; }

    const calendarId = editing?.calendarId ?? selectedCalendar?.id;
    if (!calendarId) { setError('Escolha um calendário gravável.'); return; }
    Keyboard.dismiss(); setError(''); setSaving(true);
    const event = { title: cleanTitle, startsAt, endsAt, calendarId, ...(editing ? { existing: editing } : {}) };
    try {
      if (!confirmed) {
        const risk = await assessRisk(dateText.split('/').reverse().join('-'), endsAt, expectedEntryText.trim() || undefined);
        if (risk?.kind === 'unknown') {
          setError(risk.text);
          if (!expectedEntryText.trim()) { setSaving(false); return; }
          const withManualEstimate = await assessRisk(dateText.split('/').reverse().join('-'), endsAt, expectedEntryText.trim());
          if (withManualEstimate?.kind === 'unknown') { setSaving(false); return; }
          if (withManualEstimate) { setRiskTarget({ risk: withManualEstimate, event }); setSaving(false); return; }
        }
        if (risk && risk.kind !== 'unknown') { setRiskTarget({ risk, event }); setSaving(false); return; }
      }
      await performSaveMeeting(event);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a reunião.');
    } finally { setSaving(false); }
  };

  const confirmRiskAndSave = async () => {
    if (!riskTarget) return;
    setSaving(true); setError('');
    try { await performSaveMeeting(riskTarget.event); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a reunião.'); }
    finally { setSaving(false); }
  };

  const deleteMeeting = async () => {
    if (!deleteTarget || !userId) return;
    setSaving(true); setError('');
    try {
      if (deleteTarget.nativeEventId && deleteTarget.calendarId && !deleteTarget.imported) {
        await deleteCalendarEvent(deleteTarget.nativeEventId, deleteTarget.calendarId);
      }
      const next = meetings.filter((item) => item.id !== deleteTarget.id);
      const result = await persistMeetings(next);
      setDeleteTarget(null);
      setNotice(result.permissionGranted ? 'Reunião removida; o lembrete do aplicativo foi cancelado.' : 'Reunião removida.');
      await refreshEvents(prefs.selectedCalendarIds, next, prefs.meetingReminderMinutes).catch(() => undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível remover a reunião.'); }
    finally { setSaving(false); }
  };

  const toggleAppReminders = async () => {
    const next = { ...prefs, meetingAlertsEnabled: !prefs.meetingAlertsEnabled };
    try {
      if (next.meetingAlertsEnabled) {
        const notificationPermission = await prepareLocalNotifications();
        setNotificationsGranted(notificationPermission.granted);
      }
      await savePrefs(next);
      setNotice(next.meetingAlertsEnabled ? 'Avisos de reuniões do aplicativo ativados.' : 'Avisos de reuniões do aplicativo pausados.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar os avisos.'); }
  };

  return (
    <ScreenShell contentStyle={styles.page}>
      <TabNavigationCard active={null} />
      <PageHeading eyebrow="Organize seu dia" title="Agenda" subtitle="Reuniões e lembretes sincronizados com o aparelho." right={<AccountMenuButton />} />

      <SurfaceCard style={styles.introCard}>
        <View style={styles.introIcon}><MaterialCommunityIcons name="calendar-clock-outline" size={25} color={colors.deepTeal} /></View>
        <AppText variant="subtitle">Reuniões no calendário que você já usa</AppText>
        <AppText variant="small" color={colors.muted}>Conecte calendários sincronizados no aparelho (por exemplo, Outlook/Microsoft 365/Teams ou Google), selecione quais quer exibir e escolha onde gravar novas reuniões. O Olha o Ponto usa notificações locais para os avisos.</AppText>
        <AppText variant="tiny" color={colors.muted}>A sincronização de contas é gerenciada pelo Android/iOS e pelo aplicativo de calendário. Não informe sua senha Microsoft/Google aqui. Seleções e lembretes ficam no aparelho; títulos e detalhes não são enviados ao Supabase.</AppText>
        {permission?.granted ? (
          <View style={styles.inlineActions}>
            <ActionButton title="Atualizar calendários" variant="outline" onPress={refreshCalendars} loading={refreshing} />
            <Pressable onPress={() => { void toggleAppReminders(); }} accessibilityRole="switch" accessibilityState={{ checked: prefs.meetingAlertsEnabled }} style={styles.switchLine}>
              <MaterialCommunityIcons name={prefs.meetingAlertsEnabled ? 'bell-check-outline' : 'bell-off-outline'} size={20} color={colors.deepTeal} />
              <AppText variant="small" color={colors.deepTeal}>Avisos do app {prefs.meetingAlertsEnabled ? 'ativados' : 'pausados'}</AppText>
            </Pressable>
          </View>
        ) : (
          <ActionButton title="Conectar calendários" onPress={connectCalendars} loading={saving} icon={<MaterialCommunityIcons name="calendar-sync" size={20} color="#FFFFFF" />} />
        )}
        {permission?.available && !permission.granted && permission.canAskAgain === false ? <Pressable onPress={() => { void Linking.openSettings().catch(() => undefined); }} accessibilityRole="button"><AppText variant="small" color={colors.deepTeal}>Abrir configurações de calendário</AppText></Pressable> : null}
        {notificationsGranted === false && Platform.OS !== 'web' ? <Pressable onPress={() => { void Linking.openSettings().catch(() => undefined); }} accessibilityRole="button"><AppText variant="small" color={colors.deepTeal}>Abrir configurações de notificações</AppText></Pressable> : null}
      </SurfaceCard>

      {permission?.granted ? (
        <SurfaceCard style={styles.calendarCard}>
          <AppText variant="subtitle">Calendários disponíveis no aparelho</AppText>
          {!deviceCalendars.length ? <AppText variant="small" color={colors.muted}>Nenhum calendário foi encontrado. Adicione uma conta e habilite a sincronização de calendário nas configurações do aparelho.</AppText> : null}
          {deviceCalendars.map((calendar) => {
            const selected = prefs.selectedCalendarIds.includes(calendar.id);
            const writeSelected = prefs.writeCalendarId === calendar.id;
            return (
              <View key={calendar.id} style={[styles.calendarRow, { borderColor: colors.border }]}>
                <Pressable onPress={() => { void toggleCalendar(calendar.id); }} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={styles.calendarPick}>
                  <MaterialCommunityIcons name={selected ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={22} color={colors.deepTeal} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="small">{calendar.title}</AppText>
                    <AppText variant="tiny" color={colors.muted}>{calendar.sourceName}{calendar.ownerAccount ? ` · ${calendar.ownerAccount}` : ''}</AppText>
                  </View>
                </Pressable>
                {calendar.allowsModifications ? (
                  <Pressable onPress={() => { void chooseWriteCalendar(calendar.id); }} accessibilityRole="radio" accessibilityState={{ checked: writeSelected }} style={styles.writePick}>
                    <MaterialCommunityIcons name={writeSelected ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={colors.deepTeal} />
                    <AppText variant="tiny" color={colors.deepTeal}>Gravar aqui</AppText>
                  </Pressable>
                ) : <StatusPill tone="neutral">SOMENTE LEITURA</StatusPill>}
              </View>
            );
          })}
        </SurfaceCard>
      ) : null}

      {notice ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{notice}</AppText> : null}
      {error && !formVisible && !deleteTarget && !riskTarget ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
      <ActionButton title="Adicionar reunião" onPress={openCreate} icon={<MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />} />

      {loading ? <SurfaceCard><AppText variant="body" color={colors.muted}>Carregando sua Agenda...</AppText></SurfaceCard> : displayed.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={38} color={colors.teal} />
          <AppText variant="subtitle">Sua agenda está livre</AppText>
          <AppText variant="small" color={colors.muted}>{prefs.selectedCalendarIds.length ? 'Nenhuma reunião futura foi encontrada nos calendários selecionados.' : 'Selecione seus calendários sincronizados ou adicione uma reunião.'}</AppText>
        </SurfaceCard>
      ) : displayed.map((meeting) => {
        const past = currentTime !== null && new Date(meeting.startsAt).getTime() <= currentTime;
        const canManage = !meeting.imported;
        const risk = meeting.risk;
        return (
          <SurfaceCard key={meeting.id} style={styles.meetingCard}>
            <View style={styles.meetingTop}>
              <View style={{ flex: 1, gap: 5 }}>
                <AppText variant="subtitle">{meeting.title}</AppText>
                <AppText variant="small" color={colors.muted}>{dateTimeInZone(meeting.startsAt, zone)}{meeting.endsAt ? `–${asLocalTimeInput(new Date(meeting.endsAt), zone)}` : ''}</AppText>
                <AppText variant="tiny" color={colors.deepTeal}>{calendarLabel(meeting.calendarId)} · {past ? 'Reunião encerrada' : `Aviso ${meeting.reminderMinutes} min antes`}</AppText>
              </View>
              {past ? <StatusPill tone="neutral">PASSOU</StatusPill> : <StatusPill tone="teal">AGENDADA</StatusPill>}
            </View>
            {risk ? (
              <View style={[styles.riskBox, { borderColor: risk.kind === 'unknown' ? colors.warning : colors.error }]}>
                <MaterialCommunityIcons name="alert-outline" size={19} color={risk.kind === 'unknown' ? colors.warning : colors.error} />
                <AppText variant="small" color={risk.kind === 'unknown' ? colors.warning : colors.error}>{risk.text}</AppText>
              </View>
            ) : null}
            {canManage ? (
              <View style={styles.meetingActions}>
                <Pressable onPress={() => openEdit(meeting)} accessibilityRole="button" accessibilityLabel={`Editar ${meeting.title}`} style={[styles.iconButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="pencil-outline" size={19} color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>Editar</AppText></Pressable>
                <Pressable onPress={() => { setDeleteTarget(meeting); setError(''); }} accessibilityRole="button" accessibilityLabel={`Excluir ${meeting.title}`} style={[styles.iconButton, { borderColor: `${colors.error}55` }]}><MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.error} /><AppText variant="small" color={colors.error}>Excluir</AppText></Pressable>
              </View>
            ) : <AppText variant="tiny" color={colors.muted}>Evento importado — edite ou exclua no calendário original.</AppText>}
          </SurfaceCard>
        );
      })}

      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <KeyboardModalContent>
          <SurfaceCard style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <AppText variant="subtitle">{editing ? 'Editar reunião' : 'Nova reunião'}</AppText>
              <Pressable onPress={() => setFormVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar formulário"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable>
            </View>
            {editing ? <AppText variant="tiny" color={colors.muted}>Calendário: {calendarLabel(editing.calendarId)}</AppText> : <AppText variant="tiny" color={colors.muted}>Será gravada em: {calendarLabel(prefs.writeCalendarId)}</AppText>}
            <TextField label="Título da reunião" value={title} onChangeText={setTitle} placeholder="Ex.: Reunião de equipe" maxLength={80} autoCapitalize="sentences" />
            <TextField label="Data (DD/MM/AAAA)" value={dateText} onChangeText={setDateText} placeholder="08/11/2026" keyboardType="numbers-and-punctuation" maxLength={10} />
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}><TextField label="Início (HH:mm)" value={startText} onChangeText={setStartText} placeholder="14:30" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              <View style={{ flex: 1 }}><TextField label="Término (HH:mm)" value={endText} onChangeText={setEndText} placeholder="15:30" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            </View>
            <TextField label="Avisar quantos minutos antes?" value={reminderText} onChangeText={setReminderText} placeholder="5" keyboardType="number-pad" maxLength={4} />
            <AppText variant="tiny" color={colors.muted}>Use um número inteiro de 1 a 1440 minutos. Se não houver batida ou histórico suficiente para uma data futura, informe abaixo a entrada prevista para avaliar o limite.</AppText>
            <TextField label="Entrada prevista (quando não houver batida)" value={expectedEntryText} onChangeText={setExpectedEntryText} placeholder="HH:mm — opcional se houver histórico" keyboardType="numbers-and-punctuation" maxLength={5} />
            {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
            <ActionButton title={editing ? 'Salvar alterações' : 'Salvar reunião'} onPress={() => { void saveMeeting(); }} loading={saving} />
            <ActionButton title="Cancelar" variant="outline" onPress={() => setFormVisible(false)} disabled={saving} />
          </SurfaceCard>
        </KeyboardModalContent>
      </Modal>

      <Modal visible={Boolean(riskTarget)} transparent animationType="fade" onRequestClose={() => setRiskTarget(null)}>
        <KeyboardModalContent>
          <SurfaceCard style={styles.modalCard}>
            <View style={styles.riskHeading}><MaterialCommunityIcons name="alert-decagram-outline" size={26} color={colors.error} /><AppText variant="subtitle">Atenção ao limite diário</AppText></View>
            <AppText variant="body" color={colors.error}>{riskTarget?.risk.text}</AppText>
            {riskTarget?.risk.estimatedEntry ? <AppText variant="small" color={colors.muted}>Entrada usada na estimativa: {riskTarget.risk.estimatedEntry}{riskTarget.risk.minimumMinutes === undefined ? '' : ' (mediana das entradas recentes ou horário informado por você)'}.</AppText> : null}
            <AppText variant="small" color={colors.muted}>A reunião não será bloqueada. Confira a jornada e marque apenas se desejar prosseguir.</AppText>
            {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
            <ActionButton title="Marcar reunião mesmo assim" onPress={() => { void confirmRiskAndSave(); }} loading={saving} />
            <ActionButton title="Voltar e editar" variant="outline" onPress={() => setRiskTarget(null)} disabled={saving} />
          </SurfaceCard>
        </KeyboardModalContent>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <KeyboardModalContent>
          <SurfaceCard style={styles.modalCard}>
            <AppText variant="subtitle">Excluir reunião?</AppText>
            <AppText variant="small" color={colors.muted}>{deleteTarget?.title} será removida do calendário associado e o lembrete local será cancelado.</AppText>
            {error && deleteTarget ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
            <ActionButton title="Excluir reunião" variant="danger" onPress={() => { void deleteMeeting(); }} loading={saving} />
            <ActionButton title="Manter reunião" variant="outline" onPress={() => setDeleteTarget(null)} disabled={saving} />
          </SurfaceCard>
        </KeyboardModalContent>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, paddingTop: 18 },
  introCard: { gap: 9 },
  introIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24B3A218' },
  inlineActions: { gap: 10 },
  switchLine: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  calendarCard: { gap: 10 },
  calendarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  calendarPick: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  writePick: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 8 },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 26 },
  meetingCard: { gap: 14 },
  meetingTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  meetingActions: { flexDirection: 'row', gap: 10 },
  iconButton: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 13 },
  riskBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, borderWidth: 1, borderRadius: 12 },
  modalCard: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riskHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  timeRow: { flexDirection: 'row', gap: 10 },
});
