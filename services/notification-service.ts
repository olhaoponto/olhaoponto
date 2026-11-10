import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ALERT_THRESHOLDS, getLunchReminderMinutes, isWorkAlertEnabled } from '../utils/alerts';
import { calculateWorkedSeconds, formatMinutesHHMM, type TimeEntry } from '../utils/work-time';
import { getScheduleEndAt } from '../utils/work-schedules';
import type { AlertPreferences, AgendaMeeting, WorkSchedule } from '../types/app';
import { parseAgendaReminderMinutes } from '../utils/agenda';
import { calculateLunchReturnTimes } from '../utils/lunch-return';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: notification.request.content.sound !== null,
    shouldSetBadge: false,
  }),
});

export type AlertRouteLevel = '8h' | '9h' | '9h30' | '9h45' | '9h50' | '10h';

function levelForMinute(minute: number, limitMinutes: number): AlertRouteLevel {
  if (minute >= limitMinutes || minute >= 600) return '10h';
  if (minute >= 590) return '9h50';
  if (minute >= 585) return '9h45';
  if (minute >= 570) return '9h30';
  if (minute >= 540) return '9h';
  return '8h';
}

export async function prepareLocalNotifications(): Promise<{ granted: boolean; exactAlarms: boolean }> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('work-alerts', {
      name: 'Alertas de jornada',
      description: 'Avisos importantes para encerrar a jornada no limite.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 450, 180, 450],
      lightColor: '#EF7967',
      sound: 'default',
      bypassDnd: false,
    });
    await Notifications.setNotificationChannelAsync('meeting-reminders', {
      name: 'Lembretes da Agenda',
      description: 'Avisos locais das reuniões que você cadastrou.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 120, 300],
      sound: 'default',
      bypassDnd: false,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  let exactAlarms = true;
  if (Platform.OS === 'android') {
    const api = Notifications as typeof Notifications & { canScheduleExactAlarmsAsync?: () => Promise<boolean> };
    if (api.canScheduleExactAlarmsAsync) {
      try { exactAlarms = await api.canScheduleExactAlarmsAsync(); } catch { exactAlarms = false; }
    }
  }
  return { granted: permission.status === 'granted', exactAlarms };
}

function makeTrigger(date: Date, channelId: string): Notifications.DateTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...(Platform.OS === 'android' ? { channelId } : {}),
  };
}

export async function cancelDayNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const workTypes = new Set(['shift-complete', 'lunch-start', 'lunch-return', 'work-alert']);
  const identifiers = scheduled
    .filter((notification) => workTypes.has(String(notification.content.data?.type ?? '')))
    .map((notification) => notification.identifier);
  await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
}

export async function scheduleMeetingNotifications(
  meetings: readonly AgendaMeeting[],
  options: { userId: string; soundEnabled?: boolean; vibrationEnabled?: boolean; now?: Date },
): Promise<{ permissionGranted: boolean; scheduledCount: number }> {
  const { userId, soundEnabled = true, vibrationEnabled = true, now = new Date() } = options;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const oldIdentifiers = scheduled
    .filter((notification) => notification.content.data?.type === 'meeting-reminder' && notification.content.data?.user_id === userId)
    .map((notification) => notification.identifier);
  await Promise.all(oldIdentifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return { permissionGranted: false, scheduledCount: 0 };

  const channelId = `meeting-reminders-${soundEnabled ? 'sound' : 'silent'}-${vibrationEnabled ? 'vibrate' : 'quiet'}`;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: `Agenda${soundEnabled ? ' com som' : ' silenciosa'}`,
      description: 'Lembretes locais das suas reuniões.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: vibrationEnabled ? [0, 300, 120, 300] : [],
      sound: soundEnabled ? 'default' : null,
      bypassDnd: false,
    });
  }

  let scheduledCount = 0;
  for (const meeting of meetings) {
    const startsAt = new Date(meeting.starts_at);
    const reminderMinutes = parseAgendaReminderMinutes(meeting.reminder_minutes);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= now.getTime() || reminderMinutes === null) continue;
    const reminderAt = new Date(startsAt.getTime() - reminderMinutes * 60_000);
    const fireAt = reminderAt.getTime() > now.getTime() ? reminderAt : new Date(now.getTime() + 1_000);
    const meetingTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(startsAt);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lembrete de reunião',
        body: `${meeting.title} começa às ${meetingTime}.`,
        sound: soundEnabled ? 'default' : false,
        data: { type: 'meeting-reminder', user_id: userId, event_id: meeting.id },
      },
      trigger: makeTrigger(fireAt, channelId),
    });
    scheduledCount += 1;
  }
  return { permissionGranted: true, scheduledCount };
}

/** Recalcula agenda toda vez que o usuário bate ponto ou edita um horário. */
export async function scheduleDayNotifications(
  entries: readonly TimeEntry[],
  options: { userId?: string; limitMinutes?: number; lunchMinutes?: number; lunchReturnWarningMinutes?: number; lunchReturnEnabled?: boolean; lunchReminderMinutes?: number; alertPreferences?: AlertPreferences | null; workSchedule?: WorkSchedule; normalWorkMinutes?: number; timeZone?: string; enabled?: boolean; soundEnabled?: boolean; vibrationEnabled?: boolean; now?: Date },
): Promise<void> {
  const { userId, limitMinutes = 600, lunchMinutes = 60, lunchReturnWarningMinutes = 5, lunchReturnEnabled = true, lunchReminderMinutes, alertPreferences, workSchedule, normalWorkMinutes = 480, timeZone = 'America/Bahia', enabled = true, soundEnabled = true, vibrationEnabled = true, now = new Date() } = options;
  const pauseReminderMinutes = getLunchReminderMinutes(lunchReminderMinutes ?? alertPreferences?.lunch_reminder_minutes);
  await cancelDayNotifications();
  if (!enabled || entries.length === 0) return;
  const channelId = `work-alerts-${soundEnabled ? 'sound' : 'silent'}-${vibrationEnabled ? 'vibrate' : 'quiet'}`;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: `Alertas de jornada${soundEnabled ? ' com som' : ' silenciosos'}`,
      description: 'Avisos locais sobre a jornada de trabalho.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: vibrationEnabled ? [0, 450, 180, 450] : [],
      lightColor: '#EF7967',
      sound: soundEnabled ? 'default' : null,
      bypassDnd: false,
    });
  }
  const start = entries.find((entry) => entry.tipo === 'entrada');
  if (!start) return;

  const lunchOut = entries.find((entry) => entry.tipo === 'saida_almoco');
  const lunchIn = entries.find((entry) => entry.tipo === 'volta_almoco');
  const finalOut = entries.find((entry) => entry.tipo === 'saida');
  const workedSeconds = calculateWorkedSeconds(entries, now);

  if (!finalOut && workSchedule && alertPreferences?.alerta_fim_jornada !== false) {
    const scheduledEnd = start.data ? getScheduleEndAt(start.data, workSchedule, timeZone) : null;
    if (scheduledEnd) {
      const fireAt = scheduledEnd > now ? scheduledEnd : new Date(now.getTime() + 1000);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Jornada programada completa',
          body: `Sua jornada está prevista para terminar às ${workSchedule.end_time}. Registre a saída no horário da empresa e no app.`,
          sound: soundEnabled ? 'default' : false,
          data: { type: 'shift-complete', level: '8h' satisfies AlertRouteLevel, user_id: userId, minutes: 0 },
        },
        trigger: makeTrigger(fireAt, channelId),
      });
    }
  }

  if (alertPreferences?.alerta_pausa_almoco === true && !lunchOut && !finalOut && workedSeconds < pauseReminderMinutes * 60) {
    const reminderAt = new Date(now.getTime() + (pauseReminderMinutes * 60 - workedSeconds) * 1000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lembrete de pausa',
        body: `Você já trabalhou ${formatMinutesHHMM(pauseReminderMinutes)}. Se ainda não fez o intervalo, registre a saída para almoço no relógio da empresa e no app.`,
        sound: soundEnabled ? 'default' : false,
        data: { type: 'lunch-start', level: '8h' satisfies AlertRouteLevel, minutes: pauseReminderMinutes, user_id: userId },
      },
      trigger: makeTrigger(reminderAt, channelId),
    });
  }

  if (lunchReturnEnabled && lunchOut && !lunchIn && !finalOut) {
    const timing = calculateLunchReturnTimes(lunchOut.registrado_em, lunchMinutes, lunchReturnWarningMinutes);
    if (!timing) return;
    const returnAt = timing.returnAt.getTime();
    const reminderAt = timing.warningAt.getTime() > now.getTime() ? timing.warningAt : new Date(now.getTime() + 1000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminderAt.getTime() < returnAt ? 'O almoço está quase no fim' : 'Hora de voltar do almoço',
        body: reminderAt.getTime() < returnAt
          ? `Seu intervalo termina às ${new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(returnAt))}. Prepare-se para registrar a volta.`
          : 'Seu intervalo previsto terminou. Registre a volta para retomar o contador.',
        sound: soundEnabled ? 'default' : false,
        data: { type: 'lunch-return', level: '8h' satisfies AlertRouteLevel, user_id: userId },
      },
      trigger: makeTrigger(reminderAt, channelId),
    });
    return;
  }

  if (finalOut || !lunchIn && lunchOut) return;

  const thresholds = new Set<number>();
  for (const item of ALERT_THRESHOLDS) if (item.minutes <= limitMinutes && (item.minutes !== 480 || normalWorkMinutes <= 480)) thresholds.add(item.minutes);
  if (normalWorkMinutes > 480 && normalWorkMinutes <= limitMinutes) thresholds.add(normalWorkMinutes);
  thresholds.add(Math.max(1, limitMinutes));
  // From 9h50 onward, repeat every minute through the hard limit.
  for (let minute = 590; minute <= Math.min(600, limitMinutes); minute++) thresholds.add(minute);

  const activeThresholds = [...thresholds].filter((minute) => isWorkAlertEnabled(minute, limitMinutes, alertPreferences) && minute * 60 > workedSeconds).sort((a, b) => a - b);
  for (const minute of activeThresholds) {
    const delayMs = minute * 60_000 - workedSeconds * 1000;
    if (delayMs <= 0) continue;
    const fireAt = new Date(now.getTime() + delayMs);
    const left = Math.max(0, limitMinutes - minute);
    const level = levelForMinute(minute, limitMinutes);
    const content = minute >= limitMinutes
      ? { title: 'LIMITE ATINGIDO — bata a saída agora', body: `Você chegou a ${formatMinutesHHMM(limitMinutes)} horas trabalhadas. Pare e registre a saída imediatamente.` }
      : { title: minute >= 585 ? 'Olha o Ponto — hora de ir!' : minute >= 540 ? 'Atenção à sua jornada' : 'Jornada normal completa', body: `${formatMinutesHHMM(minute)} trabalhadas. ${left ? `Faltam ${formatMinutesHHMM(left)} para o limite.` : 'Registre sua saída agora.'}` };
    await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: soundEnabled ? 'default' : false, data: { type: 'work-alert', level, minutes: minute, user_id: userId } },
      trigger: makeTrigger(fireAt, channelId),
    });
  }
}
