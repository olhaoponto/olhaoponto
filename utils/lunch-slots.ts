import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export interface LunchSlot {
  value: Date;
  label: string;
}

const SLOT_MINUTES = 15;
const MIN_NOTICE_MINUTES = 10;
const MAX_AHEAD_MINUTES = 4 * 60;

function localDate(value: Date, timeZone: string): string {
  return formatInTimeZone(value, timeZone, 'yyyy-MM-dd');
}

function localClock(value: Date, timeZone: string): { hour: number; minute: number } {
  return {
    hour: Number(formatInTimeZone(value, timeZone, 'H')),
    minute: Number(formatInTimeZone(value, timeZone, 'm')),
  };
}

function toLocalSlot(value: Date, timeZone: string): Date {
  const date = localDate(value, timeZone);
  const { hour, minute } = localClock(value, timeZone);
  const roundedMinute = Math.ceil(minute / SLOT_MINUTES) * SLOT_MINUTES;
  const base = fromZonedTime(`${date}T${String(hour).padStart(2, '0')}:00:00`, timeZone);
  return new Date(base.getTime() + roundedMinute * 60_000);
}

function label(value: Date, timeZone: string): string {
  return formatInTimeZone(value, timeZone, 'HH:mm');
}

export function generateLunchSlots(now: Date, timeZone: string): LunchSlot[] {
  const earliest = new Date(now.getTime() + SLOT_MINUTES * 60_000);
  let candidate = toLocalSlot(earliest, timeZone);
  const limit = now.getTime() + MAX_AHEAD_MINUTES * 60_000;
  const slots: LunchSlot[] = [];
  while (candidate.getTime() <= limit) {
    if (candidate.getTime() >= earliest.getTime()) slots.push({ value: candidate, label: label(candidate, timeZone) });
    candidate = new Date(candidate.getTime() + SLOT_MINUTES * 60_000);
  }
  return slots;
}

export function chooseDefaultLunchSlot(slots: readonly LunchSlot[], timeZone: string): LunchSlot | null {
  if (!slots.length) return null;
  const first = slots[0];
  const firstMinutes = localClock(first.value, timeZone).hour * 60 + localClock(first.value, timeZone).minute;
  if (firstMinutes >= 12 * 60) return first;
  return [...slots].sort((a, b) => {
    const aClock = localClock(a.value, timeZone);
    const bClock = localClock(b.value, timeZone);
    return Math.abs(aClock.hour * 60 + aClock.minute - 720) - Math.abs(bClock.hour * 60 + bClock.minute - 720);
  })[0];
}

export function validateLunchAt(lunchAt: Date, now: Date): string | null {
  if (!Number.isFinite(lunchAt.getTime())) return 'Escolha um horário válido para o almoço.';
  if (lunchAt.getTime() <= now.getTime()) return 'Esse horário já passou. Escolha outro horário.';
  if (lunchAt.getTime() - now.getTime() < MIN_NOTICE_MINUTES * 60_000) return 'Escolha um horário com pelo menos 10 minutos de antecedência.';
  return null;
}

export function formatLunchSummary(lunchAt: string | Date, returnAt: string | Date, timeZone: string): string {
  return `Almoço às ${label(new Date(lunchAt), timeZone)} · retorno às ${label(new Date(returnAt), timeZone)}`;
}
