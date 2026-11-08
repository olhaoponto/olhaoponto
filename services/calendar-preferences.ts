import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CalendarPreferences {
  selectedCalendarIds: string[];
  meetingAlertsEnabled: boolean;
}

const keyFor = (userId: string) => `olhaponto:${userId}:calendar-preferences`;
const defaults: CalendarPreferences = { selectedCalendarIds: [], meetingAlertsEnabled: true };

export async function loadCalendarPreferences(userId: string): Promise<CalendarPreferences> {
  try {
    const value = await AsyncStorage.getItem(keyFor(userId));
    if (!value) return defaults;
    const parsed = JSON.parse(value) as Partial<CalendarPreferences>;
    return {
      selectedCalendarIds: Array.isArray(parsed.selectedCalendarIds)
        ? parsed.selectedCalendarIds.filter((id): id is string => typeof id === 'string')
        : [],
      meetingAlertsEnabled: parsed.meetingAlertsEnabled !== false,
    };
  } catch {
    return defaults;
  }
}

export async function saveCalendarPreferences(userId: string, preferences: CalendarPreferences): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify({
    selectedCalendarIds: [...new Set(preferences.selectedCalendarIds)],
    meetingAlertsEnabled: preferences.meetingAlertsEnabled,
  }));
}
