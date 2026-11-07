import { fromZonedTime } from 'date-fns-tz';
import type { AlertPreferences, WorkSchedule, Workday } from '../types/app';

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  id: 'default-weekday-08-18',
  name: 'Jornada padrão',
  start_time: '08:00',
  end_time: '18:00',
  lunch_minutes: 60,
  work_days: [1, 2, 3, 4, 5],
  day_overrides: { 5: { start_time: '08:00', end_time: '17:00', lunch_minutes: 60 } },
};

const LEGACY_WEEKDAY_ID = 'default-weekday-08-18';
const LEGACY_FRIDAY_ID = 'default-friday-08-17';
const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const isClock = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function isDay(value: number): value is Workday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

export function validateWorkSchedule(schedule: WorkSchedule): string | null {
  if (typeof schedule.name !== 'string' || !schedule.name.trim()) return 'Informe um nome para a jornada.';
  if (!isClock(schedule.start_time) || !isClock(schedule.end_time)) return 'Informe horários válidos no formato HH:mm.';
  if (schedule.end_time <= schedule.start_time) return 'O fim da jornada precisa ser depois do início no mesmo dia.';
  if (!Number.isInteger(schedule.lunch_minutes) || schedule.lunch_minutes < 0 || schedule.lunch_minutes > 480) return 'A duração do almoço precisa estar entre 0 e 480 minutos.';
  if (!Array.isArray(schedule.work_days) || schedule.work_days.length === 0 || schedule.work_days.some((day) => !isDay(day))) return 'Selecione ao menos um dia da semana.';
  if (schedule.day_overrides !== undefined) {
    if (!schedule.day_overrides || typeof schedule.day_overrides !== 'object' || Array.isArray(schedule.day_overrides)) return 'Os horários especiais da jornada estão inválidos.';
    for (const [key, override] of Object.entries(schedule.day_overrides)) {
      const weekday = Number(key);
      if (!isDay(weekday) || !schedule.work_days.includes(weekday) || !override || typeof override !== 'object') return 'Os horários especiais precisam corresponder aos dias da jornada.';
      const start = override.start_time ?? schedule.start_time;
      const end = override.end_time ?? schedule.end_time;
      const lunch = override.lunch_minutes ?? schedule.lunch_minutes;
      if (!isClock(start) || !isClock(end) || end <= start) return 'Informe horários válidos para cada dia especial.';
      if (!Number.isInteger(lunch) || lunch < 0 || lunch > 480) return 'A duração do almoço especial precisa estar entre 0 e 480 minutos.';
    }
  }
  return null;
}

function defaults(fallbackLunchMinutes: number): WorkSchedule[] {
  return [{
    ...DEFAULT_WORK_SCHEDULE,
    lunch_minutes: fallbackLunchMinutes,
    work_days: [...DEFAULT_WORK_SCHEDULE.work_days],
    day_overrides: { 5: { start_time: '08:00', end_time: '17:00', lunch_minutes: fallbackLunchMinutes } },
  }];
}

const isExactDays = (actual: number[], expected: readonly number[]) =>
  actual.length === expected.length && expected.every((day) => actual.includes(day));

function isLegacyCombinedDefault(schedule: WorkSchedule): boolean {
  return schedule.id === LEGACY_WEEKDAY_ID
    && schedule.start_time === '08:00'
    && schedule.end_time === '18:00'
    && isExactDays(schedule.work_days, WEEKDAYS)
    && !schedule.day_overrides;
}

function isLegacyWeekdayPart(schedule: WorkSchedule): boolean {
  return schedule.id === LEGACY_WEEKDAY_ID
    && schedule.start_time === '08:00'
    && schedule.end_time === '18:00'
    && isExactDays(schedule.work_days, [1, 2, 3, 4]);
}

function isLegacyFridayPart(schedule: WorkSchedule): boolean {
  return schedule.id === LEGACY_FRIDAY_ID
    && schedule.start_time === '08:00'
    && schedule.end_time === '17:00'
    && isExactDays(schedule.work_days, [5]);
}

function mergePreviousDefault(schedules: WorkSchedule[]): WorkSchedule[] {
  const combinedIndex = schedules.findIndex(isLegacyCombinedDefault);
  if (combinedIndex >= 0) {
    const old = schedules[combinedIndex];
    const updated = { ...old, name: old.name === 'Jornada padrão' ? DEFAULT_WORK_SCHEDULE.name : old.name, day_overrides: { 5: { start_time: '08:00', end_time: '17:00', lunch_minutes: old.lunch_minutes } } };
    return schedules.map((schedule, index) => index === combinedIndex ? updated : schedule);
  }

  const weekdayIndex = schedules.findIndex(isLegacyWeekdayPart);
  const fridayIndex = schedules.findIndex(isLegacyFridayPart);
  if (weekdayIndex < 0 || fridayIndex < 0) return schedules;
  const weekday = schedules[weekdayIndex];
  const friday = schedules[fridayIndex];
  const unified: WorkSchedule = {
    ...weekday,
    name: weekday.name === 'Jornada padrão · segunda a quinta' ? DEFAULT_WORK_SCHEDULE.name : weekday.name,
    work_days: [...new Set([...weekday.work_days, ...friday.work_days])].sort((a, b) => a - b),
    day_overrides: {
      ...weekday.day_overrides,
      5: { start_time: friday.start_time, end_time: friday.end_time, lunch_minutes: friday.lunch_minutes },
    },
  };
  return schedules.flatMap((schedule, index) => {
    if (index === fridayIndex) return [];
    return [index === weekdayIndex ? unified : schedule];
  });
}

export function getWorkSchedules(
  preferences?: AlertPreferences | null,
  fallbackLunchMinutes = DEFAULT_WORK_SCHEDULE.lunch_minutes,
): WorkSchedule[] {
  const saved = preferences?.work_schedules;
  if (!Array.isArray(saved) || saved.length === 0) return defaults(fallbackLunchMinutes);
  const valid = saved.filter((item): item is WorkSchedule => Boolean(item && typeof item === 'object' && !validateWorkSchedule(item as WorkSchedule)));
  return valid.length
    ? mergePreviousDefault(valid.map((item) => ({ ...item, work_days: [...item.work_days], day_overrides: item.day_overrides ? { ...item.day_overrides } : undefined })) )
    : defaults(fallbackLunchMinutes);
}

function normalizedSelectedScheduleId(preferences?: AlertPreferences | null): string | undefined {
  const selectedId = preferences?.active_work_schedule_id;
  return selectedId === LEGACY_FRIDAY_ID ? LEGACY_WEEKDAY_ID : selectedId;
}

export function getActiveWorkSchedule(
  preferences?: AlertPreferences | null,
  fallbackLunchMinutes = DEFAULT_WORK_SCHEDULE.lunch_minutes,
): WorkSchedule {
  const schedules = getWorkSchedules(preferences, fallbackLunchMinutes);
  const selectedId = normalizedSelectedScheduleId(preferences);
  return schedules.find((schedule) => schedule.id === selectedId) ?? schedules[0];
}

function scheduleForWeekday(schedule: WorkSchedule, weekday: number): WorkSchedule {
  const override = schedule.day_overrides?.[weekday as Workday];
  return override ? { ...schedule, ...override } : schedule;
}

/** The selected active schedule wins when it covers that weekday; otherwise another saved schedule may apply. */
export function getWorkScheduleForDate(
  preferences: AlertPreferences | null | undefined,
  civilDate: string,
  fallbackLunchMinutes = DEFAULT_WORK_SCHEDULE.lunch_minutes,
): WorkSchedule {
  const schedules = getWorkSchedules(preferences, fallbackLunchMinutes);
  const dayAnchor = new Date(`${civilDate}T12:00:00.000Z`);
  if (!Number.isFinite(dayAnchor.getTime()) || dayAnchor.toISOString().slice(0, 10) !== civilDate) return getActiveWorkSchedule(preferences, fallbackLunchMinutes);
  const weekday = dayAnchor.getUTCDay();
  const selectedId = normalizedSelectedScheduleId(preferences);
  const selected = schedules.find((schedule) => schedule.id === selectedId);
  const chosen = selected?.work_days.includes(weekday)
    ? selected
    : schedules.find((schedule) => schedule.work_days.includes(weekday)) ?? selected ?? schedules[0];
  return scheduleForWeekday(chosen, weekday);
}

export function getExpectedWorkMinutes(schedule: WorkSchedule): number {
  const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
  const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
  return Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - schedule.lunch_minutes);
}

export function getExpectedWorkMinutesForDate(schedule: WorkSchedule, civilDate: string): number {
  const dayAnchor = new Date(`${civilDate}T12:00:00.000Z`);
  if (!Number.isFinite(dayAnchor.getTime()) || dayAnchor.toISOString().slice(0, 10) !== civilDate) return 0;
  return getExpectedWorkMinutes(scheduleForWeekday(schedule, dayAnchor.getUTCDay()));
}

export function getScheduleEndAt(
  civilDate: string,
  schedule: WorkSchedule,
  timeZone = 'America/Bahia',
): Date | null {
  const dayAnchor = new Date(`${civilDate}T12:00:00.000Z`);
  if (!Number.isFinite(dayAnchor.getTime()) || dayAnchor.toISOString().slice(0, 10) !== civilDate) return null;
  const weekday = dayAnchor.getUTCDay();
  if (!schedule.work_days.includes(weekday) || validateWorkSchedule(schedule)) return null;
  const effective = scheduleForWeekday(schedule, weekday);
  return fromZonedTime(`${civilDate}T${effective.end_time}:00`, timeZone);
}
