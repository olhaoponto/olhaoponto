import { DEFAULT_WORK_SCHEDULE, getExpectedWorkMinutesForDate } from './work-schedules';
import type { WorkSchedule } from '../types/app';

export const DEFAULT_DAILY_LIMIT_MINUTES = 600;

export type PunchType = 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida';

export interface TimeEntry {
  id?: string;
  user_id?: string;
  data?: string;
  tipo: PunchType;
  registrado_em: string;
  horario_informado_manual?: boolean;
  editado?: boolean;
  justificativa?: string | null;
}

export interface PunchValidation {
  valid: boolean;
  reason?: 'invalid_timestamp' | 'future' | 'wrong_date' | 'out_of_order' | 'duplicate_type' | 'unexpected_type' | 'daily_limit_exceeded';
  message?: string;
  workedMinutes?: number;
}

export interface DailyTotal {
  date: string;
  workedMinutes: number;
  overtimeMinutes: number;
  workedHHMM: string;
  overtimeHHMM: string;
}

export interface PeriodTotals {
  workedMinutes: number;
  overtimeMinutes: number;
  workedHHMM: string;
  overtimeHHMM: string;
  days: DailyTotal[];
}

const DEFAULT_LUNCH_MINUTES = 60;
const PUNCH_TYPES: readonly PunchType[] = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
const BAHIA_TIME_ZONE = 'America/Bahia';

const MINUTE_MS = 60_000;

function timestamp(value: string): number {
  return Date.parse(value);
}

export function getBahiaDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BAHIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function formatMinutesHHMM(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/** Minutos acumulados sem arredondamento parcial; só o resultado é arredondado para minuto. */
export function calculateWorkedMinutes(entries: readonly TimeEntry[], now: string | Date = new Date()): number {
  if (!entries.length) return 0;
  const byType = new Map<PunchType, number>();
  for (const entry of entries) {
    const time = timestamp(entry.registrado_em);
    if (Number.isFinite(time)) byType.set(entry.tipo, time);
  }
  const start = byType.get('entrada');
  if (start === undefined) return 0;
  const lunchOut = byType.get('saida_almoco');
  const lunchIn = byType.get('volta_almoco');
  const end = byType.get('saida');
  const current = now instanceof Date ? now.getTime() : timestamp(now);
  const activeEnd = end ?? current;
  let workMs = 0;
  if (lunchOut === undefined) {
    workMs = Math.max(0, activeEnd - start);
  } else {
    workMs = Math.max(0, lunchOut - start);
    if (lunchIn !== undefined) workMs += Math.max(0, activeEnd - lunchIn);
  }
  return Math.floor(workMs / MINUTE_MS);
}

export function calculateWorkedSeconds(entries: readonly TimeEntry[], now: string | Date = new Date()): number {
  if (!entries.length) return 0;
  const byType = new Map<PunchType, number>();
  entries.forEach((entry) => {
    const value = timestamp(entry.registrado_em);
    if (Number.isFinite(value)) byType.set(entry.tipo, value);
  });
  const start = byType.get('entrada');
  if (start === undefined) return 0;
  const lunchOut = byType.get('saida_almoco');
  const lunchIn = byType.get('volta_almoco');
  const finalOut = byType.get('saida');
  const nowMs = now instanceof Date ? now.getTime() : timestamp(now);
  const stop = finalOut ?? nowMs;
  let seconds = lunchOut === undefined
    ? Math.max(0, stop - start) / 1000
    : Math.max(0, lunchOut - start) / 1000 + (lunchIn === undefined ? 0 : Math.max(0, stop - lunchIn) / 1000);
  return Math.floor(seconds);
}

export function getNextPunch(entries: readonly TimeEntry[]): PunchType | null {
  const recorded = new Set(entries.map((entry) => entry.tipo));
  return PUNCH_TYPES.find((type) => !recorded.has(type)) ?? null;
}

export function projectEndTime(
  entries: readonly TimeEntry[],
  limitMinutes = DEFAULT_DAILY_LIMIT_MINUTES,
  defaultLunchMinutes = DEFAULT_LUNCH_MINUTES,
): string | null {
  const startEntry = entries.find((entry) => entry.tipo === 'entrada');
  if (!startEntry) return null;
  const start = timestamp(startEntry.registrado_em);
  if (!Number.isFinite(start)) return null;
  const lunchOut = entries.find((entry) => entry.tipo === 'saida_almoco');
  const lunchIn = entries.find((entry) => entry.tipo === 'volta_almoco');
  let breakMinutes = Math.max(0, defaultLunchMinutes);
  if (lunchOut && lunchIn) {
    const actual = timestamp(lunchIn.registrado_em) - timestamp(lunchOut.registrado_em);
    if (Number.isFinite(actual) && actual >= 0) breakMinutes = actual / MINUTE_MS;
  }
  return new Date(start + (limitMinutes + breakMinutes) * MINUTE_MS).toISOString();
}

export interface SafeClockOut {
  timestamp: string;
  capped: boolean;
  latestAllowedTimestamp: string | null;
}

/** Keeps a late critical-alert action at the exact daily cap rather than persisting over-limit work. */
export function safeClockOutTimestamp(
  entries: readonly TimeEntry[],
  requestedAt: string | Date = new Date(),
  limitMinutes = DEFAULT_DAILY_LIMIT_MINUTES,
  defaultLunchMinutes = DEFAULT_LUNCH_MINUTES,
): SafeClockOut {
  const requested = requestedAt instanceof Date ? requestedAt.getTime() : timestamp(requestedAt);
  const roundedRequest = Math.floor(requested / MINUTE_MS) * MINUTE_MS;
  const latestAllowedTimestamp = projectEndTime(entries, limitMinutes, defaultLunchMinutes);
  const latestAllowed = latestAllowedTimestamp ? timestamp(latestAllowedTimestamp) : Number.NaN;
  if (!Number.isFinite(roundedRequest)) return { timestamp: '', capped: false, latestAllowedTimestamp };
  if (!Number.isFinite(latestAllowed)) return { timestamp: new Date(roundedRequest).toISOString(), capped: false, latestAllowedTimestamp };
  const capped = roundedRequest > latestAllowed;
  return {
    timestamp: new Date(capped ? latestAllowed : roundedRequest).toISOString(),
    capped,
    latestAllowedTimestamp,
  };
}

export function validatePunch(
  existing: readonly TimeEntry[],
  candidate: TimeEntry,
  now: string | Date = new Date(),
  limitMinutes = DEFAULT_DAILY_LIMIT_MINUTES,
): PunchValidation {
  const candidateTime = timestamp(candidate.registrado_em);
  if (!Number.isFinite(candidateTime)) return { valid: false, reason: 'invalid_timestamp', message: 'Horário inválido.' };
  const nowTime = now instanceof Date ? now.getTime() : timestamp(now);
  if (candidateTime > nowTime) return { valid: false, reason: 'future', message: 'Não é permitido registrar uma batida futura.' };
  const recorded = [...existing].sort((a, b) => timestamp(a.registrado_em) - timestamp(b.registrado_em));
  if (candidate.data && candidate.data !== getBahiaDate(candidate.registrado_em)) {
    return { valid: false, reason: 'wrong_date', message: 'A data deve corresponder ao dia local de America/Bahia.' };
  }
  if (existing.some((entry) => entry.tipo === candidate.tipo)) return { valid: false, reason: 'duplicate_type', message: 'Este tipo de batida já foi registrado.' };
  const expected = PUNCH_TYPES[recorded.length];
  if (candidate.tipo !== expected) return { valid: false, reason: 'unexpected_type', message: `A próxima batida deve ser ${expected ?? 'nenhuma'}.` };
  if (recorded.length && candidateTime <= timestamp(recorded[recorded.length - 1].registrado_em)) {
    return { valid: false, reason: 'out_of_order', message: 'As batidas devem estar em ordem cronológica.' };
  }
  const candidateEntries = [...recorded, candidate];
  const workedMinutes = calculateWorkedMinutes(candidateEntries, new Date(candidateTime));
  if (workedMinutes > limitMinutes) return { valid: false, reason: 'daily_limit_exceeded', message: `O limite de ${formatMinutesHHMM(limitMinutes)} horas trabalhadas seria excedido.`, workedMinutes };
  return { valid: true, workedMinutes };
}

export function validateEntries(entries: readonly TimeEntry[], now: string | Date = new Date(), limitMinutes = DEFAULT_DAILY_LIMIT_MINUTES): PunchValidation {
  const sorted = [...entries].sort((a, b) => timestamp(a.registrado_em) - timestamp(b.registrado_em));
  const accepted: TimeEntry[] = [];
  for (const entry of sorted) {
    const validation = validatePunch(accepted, entry, now, limitMinutes);
    if (!validation.valid) return validation;
    accepted.push(entry);
  }
  return { valid: true, workedMinutes: calculateWorkedMinutes(accepted, now) };
}

export function calculateDailyTotals(
  entries: readonly TimeEntry[],
  now: string | Date = new Date(),
  workSchedule: WorkSchedule = DEFAULT_WORK_SCHEDULE,
): DailyTotal[] {
  const grouped = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const date = entry.data || getBahiaDate(entry.registrado_em);
    const group = grouped.get(date) ?? [];
    group.push(entry);
    grouped.set(date, group);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, dayEntries]) => {
    const minutes = calculateWorkedMinutes(dayEntries, getBahiaDate(now) === date ? now : new Date(Math.max(...dayEntries.map((item) => timestamp(item.registrado_em)))));
    const expectedMinutes = getExpectedWorkMinutesForDate(workSchedule, date);
    const overtime = Math.max(0, minutes - expectedMinutes);
    return { date, workedMinutes: minutes, overtimeMinutes: overtime, workedHHMM: formatMinutesHHMM(minutes), overtimeHHMM: formatMinutesHHMM(overtime) };
  });
}

export function calculatePeriodTotals(
  entries: readonly TimeEntry[],
  now: string | Date = new Date(),
  workSchedule: WorkSchedule = DEFAULT_WORK_SCHEDULE,
): PeriodTotals {
  const days = calculateDailyTotals(entries, now, workSchedule);
  const workedMinutes = days.reduce((sum, day) => sum + day.workedMinutes, 0);
  const overtimeMinutes = days.reduce((sum, day) => sum + day.overtimeMinutes, 0);
  return { workedMinutes, overtimeMinutes, workedHHMM: formatMinutesHHMM(workedMinutes), overtimeHHMM: formatMinutesHHMM(overtimeMinutes), days };
}
