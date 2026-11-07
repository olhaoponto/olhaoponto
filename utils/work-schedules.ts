import { fromZonedTime } from 'date-fns-tz';
import type { AlertPreferences, WorkSchedule } from '../types/app';

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  id: 'default-weekday-08-18',
  name: 'Jornada padrão',
  start_time: '08:00',
  end_time: '18:00',
  lunch_minutes: 60,
  work_days: [1, 2, 3, 4, 5],
};

const isClock = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function validateWorkSchedule(schedule: WorkSchedule): string | null {
  if (typeof schedule.name !== 'string' || !schedule.name.trim()) return 'Informe um nome para a jornada.';
  if (!isClock(schedule.start_time) || !isClock(schedule.end_time)) return 'Informe horários válidos no formato HH:mm.';
  if (schedule.end_time <= schedule.start_time) return 'O fim da jornada precisa ser depois do início no mesmo dia.';
  if (!Number.isInteger(schedule.lunch_minutes) || schedule.lunch_minutes < 0 || schedule.lunch_minutes > 480) return 'A duração do almoço precisa estar entre 0 e 480 minutos.';
  if (!Array.isArray(schedule.work_days) || schedule.work_days.length === 0 || schedule.work_days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return 'Selecione ao menos um dia da semana.';
  return null;
}

export function getWorkSchedules(
  preferences?: AlertPreferences | null,
  fallbackLunchMinutes = DEFAULT_WORK_SCHEDULE.lunch_minutes,
): WorkSchedule[] {
  const saved = preferences?.work_schedules;
  if (!Array.isArray(saved) || saved.length === 0) {
    return [{ ...DEFAULT_WORK_SCHEDULE, lunch_minutes: fallbackLunchMinutes }];
  }
  const valid = saved.filter((item): item is WorkSchedule => Boolean(item && typeof item === 'object' && !validateWorkSchedule(item as WorkSchedule)));
  return valid.length ? valid.map((item) => ({ ...item, work_days: [...item.work_days] })) : [{ ...DEFAULT_WORK_SCHEDULE, lunch_minutes: fallbackLunchMinutes }];
}

export function getActiveWorkSchedule(
  preferences?: AlertPreferences | null,
  fallbackLunchMinutes = DEFAULT_WORK_SCHEDULE.lunch_minutes,
): WorkSchedule {
  const schedules = getWorkSchedules(preferences, fallbackLunchMinutes);
  const selectedId = preferences?.active_work_schedule_id;
  return schedules.find((schedule) => schedule.id === selectedId) ?? schedules[0];
}

export function getExpectedWorkMinutes(schedule: WorkSchedule): number {
  const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
  const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
  return Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - schedule.lunch_minutes);
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
  return fromZonedTime(`${civilDate}T${schedule.end_time}:00`, timeZone);
}
