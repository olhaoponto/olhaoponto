import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { cancelScheduledNotificationsByType } from './notification-service';
import type { DeviceCalendarEvent } from './calendar-service';

const MEETING_NOTIFICATION_TYPE = 'calendar-event';
const MEETING_CHANNEL = 'meeting-reminders';

function triggerAt(date: Date): Notifications.DateTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...(Platform.OS === 'android' ? { channelId: MEETING_CHANNEL } : {}),
  };
}

function clock(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(value);
}

/** Reagenda somente lembretes da Agenda para calendários escolhidos pelo usuário. */
export async function scheduleMeetingNotifications(
  events: readonly DeviceCalendarEvent[],
  options: { userId: string; enabled?: boolean; beforeMinutes?: number; timeZone?: string; now?: Date },
): Promise<number> {
  const { userId, enabled = true, beforeMinutes = 5, timeZone = 'America/Bahia', now = new Date() } = options;
  await cancelScheduledNotificationsByType([MEETING_NOTIFICATION_TYPE], userId);
  if (!enabled || !userId) return 0;

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return 0;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MEETING_CHANNEL, {
      name: 'Lembretes de reuniões',
      description: 'Avisos locais do Olha o Ponto para reuniões nos calendários selecionados.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#24B3A2',
      sound: 'default',
      bypassDnd: false,
    });
  }

  const leadMinutes = Math.max(0, Math.floor(beforeMinutes));
  let scheduled = 0;
  for (const event of events) {
    // Eventos de dia inteiro não têm um início útil para um lembrete de reunião com horário.
    if (event.allDay) continue;
    const start = new Date(event.startDate);
    if (!Number.isFinite(start.getTime())) continue;
    const fireAt = new Date(start.getTime() - leadMinutes * 60_000);
    if (fireAt <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reunião próxima',
        body: `${event.title} começa às ${clock(start, timeZone)}.${leadMinutes ? ` Aviso com ${leadMinutes} minutos de antecedência.` : ''}`,
        sound: 'default',
        data: { type: MEETING_NOTIFICATION_TYPE, user_id: userId, event_id: event.id, calendar_id: event.calendarId },
      },
      trigger: triggerAt(fireAt),
    });
    scheduled += 1;
  }
  return scheduled;
}
