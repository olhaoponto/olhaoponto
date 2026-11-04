import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ALERT_THRESHOLDS } from '../utils/alerts';
import { calculateWorkedSeconds, formatMinutesHHMM, type TimeEntry } from '../utils/work-time';

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
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Recalcula agenda toda vez que o usuário bate ponto ou edita um horário. */
export async function scheduleDayNotifications(
  entries: readonly TimeEntry[],
  options: { userId?: string; limitMinutes?: number; lunchMinutes?: number; enabled?: boolean; soundEnabled?: boolean; vibrationEnabled?: boolean; now?: Date },
): Promise<void> {
  const { userId, limitMinutes = 600, lunchMinutes = 60, enabled = true, soundEnabled = true, vibrationEnabled = true, now = new Date() } = options;
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

  if (lunchOut && !lunchIn && !finalOut) {
    const lunchAt = new Date(lunchOut.registrado_em).getTime();
    const reminderAt = new Date(lunchAt + Math.max(0, lunchMinutes) * 60_000);
    if (reminderAt > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Hora de voltar do almoço',
          body: 'Seu intervalo terminou. Registre a volta para retomar o contador.',
          sound: soundEnabled ? 'default' : false,
          data: { type: 'lunch-return', level: '8h' satisfies AlertRouteLevel, user_id: userId },
        },
        trigger: makeTrigger(reminderAt, channelId),
      });
    }
    return;
  }

  if (finalOut || !lunchIn && lunchOut) return;

  const workedSeconds = calculateWorkedSeconds(entries, now);
  const thresholds = new Set<number>();
  for (const item of ALERT_THRESHOLDS) if (item.minutes <= limitMinutes) thresholds.add(item.minutes);
  thresholds.add(Math.max(1, limitMinutes));
  // From 9h50 onward, repeat every minute through the hard limit.
  for (let minute = 590; minute <= Math.min(600, limitMinutes); minute++) thresholds.add(minute);

  const activeThresholds = [...thresholds].filter((minute) => minute * 60 > workedSeconds).sort((a, b) => a - b);
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
