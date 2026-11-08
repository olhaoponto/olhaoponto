import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CalendarPreferences {
  selectedCalendarIds: string[];
  writeCalendarId: string | null;
  meetingReminderMinutes: number;
  meetingAlertsEnabled: boolean;
}

const keyFor = (userId: string) => `olhaponto:${userId}:calendar-preferences`;
const defaults: CalendarPreferences = {
  selectedCalendarIds: [],
  writeCalendarId: null,
  meetingReminderMinutes: 5,
  meetingAlertsEnabled: true,
};

export async function loadCalendarPreferences(userId: string): Promise<CalendarPreferences> {
  if (!userId) return defaults;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<CalendarPreferences>;
    const reminder = Number(parsed.meetingReminderMinutes);
    return {
      selectedCalendarIds: Array.isArray(parsed.selectedCalendarIds)
        ? [...new Set(parsed.selectedCalendarIds.filter((id): id is string => typeof id === 'string'))]
        : [],
      writeCalendarId: typeof parsed.writeCalendarId === 'string' ? parsed.writeCalendarId : null,
      meetingReminderMinutes: Number.isInteger(reminder) && reminder >= 1 && reminder <= 1440 ? reminder : 5,
      meetingAlertsEnabled: parsed.meetingAlertsEnabled !== false,
    };
  } catch {
    return defaults;
  }
}

export async function saveCalendarPreferences(userId: string, preferences: CalendarPreferences): Promise<void> {
  if (!userId) throw new Error('Entre na sua conta para salvar as preferências da Agenda.');
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify({
    selectedCalendarIds: [...new Set(preferences.selectedCalendarIds)],
    writeCalendarId: preferences.writeCalendarId,
    meetingReminderMinutes: preferences.meetingReminderMinutes,
    meetingAlertsEnabled: preferences.meetingAlertsEnabled,
  }));
}
