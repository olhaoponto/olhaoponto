import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export interface DeviceCalendar {
  id: string;
  title: string;
  sourceName: string;
  sourceType: string;
  ownerAccount?: string;
  isPrimary: boolean;
  isSynced: boolean;
  allowsModifications: boolean;
}

export interface DeviceCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  timeZone: string | null;
}

export interface CalendarPermissionState {
  available: boolean;
  granted: boolean;
  canAskAgain: boolean;
}

function normalizeCalendar(calendar: Calendar.ExpoCalendar): DeviceCalendar {
  return {
    id: calendar.id,
    title: calendar.title,
    sourceName: calendar.source?.name || 'Calendário do aparelho',
    sourceType: String(calendar.source?.type || ''),
    ownerAccount: calendar.ownerAccount,
    isPrimary: calendar.isPrimary === true,
    isSynced: calendar.isSynced !== false,
    allowsModifications: calendar.allowsModifications === true,
  };
}

function normalizeEvent(event: Calendar.ExpoCalendarEvent): DeviceCalendarEvent {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  return {
    id: event.id,
    calendarId: event.calendarId,
    title: event.title || 'Reunião',
    startDate: Number.isFinite(start.getTime()) ? start.toISOString() : String(event.startDate),
    endDate: Number.isFinite(end.getTime()) ? end.toISOString() : String(event.endDate),
    allDay: event.allDay === true,
    location: event.location || null,
    notes: event.notes || null,
    timeZone: event.timeZone || null,
  };
}

export async function getCalendarPermissionState(): Promise<CalendarPermissionState> {
  if (Platform.OS === 'web') return { available: false, granted: false, canAskAgain: false };
  const permission = await Calendar.getCalendarPermissions();
  return { available: true, granted: permission.granted, canAskAgain: permission.canAskAgain };
}

export async function requestCalendarAccess(): Promise<CalendarPermissionState> {
  if (Platform.OS === 'web') return { available: false, granted: false, canAskAgain: false };
  const permission = await Calendar.requestCalendarPermissions();
  return { available: true, granted: permission.granted, canAskAgain: permission.canAskAgain };
}

export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  if (Platform.OS === 'web') return [];
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars
    .map(normalizeCalendar)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.title.localeCompare(b.title, 'pt-BR'));
}

export async function listCalendarEvents(
  calendarIds: readonly string[],
  startDate: Date,
  endDate: Date,
): Promise<DeviceCalendarEvent[]> {
  if (Platform.OS === 'web' || calendarIds.length === 0) return [];
  const events = await Calendar.listEvents([...calendarIds], startDate, endDate);
  return events
    .map(normalizeEvent)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, 'pt-BR'));
}

export async function createCalendarEvent(input: {
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  timeZone: string;
  location?: string;
  notes?: string;
}): Promise<DeviceCalendarEvent> {
  if (Platform.OS === 'web') throw new Error('A criação de reuniões pelo calendário do aparelho está disponível no APK mobile.');
  const calendar = await Calendar.ExpoCalendar.get(input.calendarId);
  if (!calendar.allowsModifications) throw new Error('O calendário selecionado é somente leitura. Escolha um calendário que permita gravação.');
  const event = await calendar.createEvent({
    title: input.title.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    timeZone: input.timeZone,
    allDay: false,
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  });
  return normalizeEvent(event);
}
