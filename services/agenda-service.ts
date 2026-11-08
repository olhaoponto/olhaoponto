import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgendaMeeting } from '@/types/app';
import { parseAgendaReminderMinutes } from '@/utils/agenda';

const storageKey = (userId: string) => `olhaponto:${userId}:agenda-meetings`;

function isAgendaMeeting(value: unknown): value is AgendaMeeting {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<AgendaMeeting>;
  return typeof event.id === 'string'
    && typeof event.title === 'string'
    && event.title.trim().length > 0
    && typeof event.starts_at === 'string'
    && Number.isFinite(new Date(event.starts_at).getTime())
    && parseAgendaReminderMinutes(event.reminder_minutes) !== null;
}

export async function loadAgendaMeetings(userId: string): Promise<AgendaMeeting[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAgendaMeeting).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  } catch {
    return [];
  }
}

export async function saveAgendaMeetings(userId: string, meetings: readonly AgendaMeeting[]): Promise<void> {
  if (!userId) throw new Error('A Agenda precisa de uma conta ativa.');
  const validMeetings = meetings.filter(isAgendaMeeting).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(validMeetings));
}
