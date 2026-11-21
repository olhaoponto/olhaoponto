import type { DayStatusRecord, TimeEntry } from '@/types/app';
import type { StreakResult } from '@/utils/streak';

export type AchievementRuleInput = {
  today: string;
  entries: readonly Pick<TimeEntry, 'data' | 'tipo'>[];
  statuses: readonly Pick<DayStatusRecord, 'data' | 'status'>[];
  streak: StreakResult;
  missionEvents: readonly { week: string; event: string }[];
  totalCycles: number;
};

const COMPLETE_PUNCHES = 4;

function shiftDate(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

function weekStart(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return shiftDate(value, -((weekday + 6) % 7));
}

function monthBefore(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1, 12));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

function isComplete(entries: readonly Pick<TimeEntry, 'data' | 'tipo'>[], date: string): boolean {
  return new Set(entries.filter((entry) => entry.data === date).map((entry) => entry.tipo)).size >= COMPLETE_PUNCHES;
}

function hasPerfectWeek(entries: readonly Pick<TimeEntry, 'data' | 'tipo'>[]): boolean {
  const completeByWeek = new Map<string, Set<string>>();
  for (const date of new Set(entries.map((entry) => entry.data))) if (isComplete(entries, date)) {
    const key = weekStart(date);
    const dates = completeByWeek.get(key) ?? new Set<string>();
    dates.add(date);
    completeByWeek.set(key, dates);
  }
  return [...completeByWeek.values()].some((dates) => dates.size >= 5);
}

function hasClosedMonthWithoutAbsence(today: string, statuses: readonly Pick<DayStatusRecord, 'data' | 'status'>[], entries: readonly Pick<TimeEntry, 'data' | 'tipo'>[]): boolean {
  const month = monthBefore(today);
  const hasHistory = statuses.some((item) => item.data.startsWith(`${month}-`)) || entries.some((item) => item.data.startsWith(`${month}-`));
  return hasHistory && !statuses.some((item) => item.data.startsWith(`${month}-`) && item.status === 'absence');
}

function hasFourMirrorWeeks(events: readonly { week: string; event: string }[]): boolean {
  const weeks = [...new Set(events.filter((item) => item.event === 'review_mirror').map((item) => weekStart(item.week)))].sort();
  for (let index = 0; index <= weeks.length - 4; index++) {
    if (weeks.slice(index, index + 4).every((week, offset) => week === shiftDate(weeks[index], offset * 7))) return true;
  }
  return false;
}

export function evaluateAchievementRules(input: AchievementRuleInput): string[] {
  const rules: Record<string, boolean> = {
    primeiro_ponto: input.entries.length > 0,
    dia_completo: input.entries.some((entry) => isComplete(input.entries, entry.data)),
    semana_perfeita: hasPerfectWeek(input.entries),
    sequencia_7: input.streak.recorde >= 7,
    sequencia_30: input.streak.recorde >= 30,
    sequencia_100: input.streak.recorde >= 100,
    mes_completo: hasClosedMonthWithoutAbsence(input.today, input.statuses, input.entries),
    espelho_em_dia: hasFourMirrorWeeks(input.missionEvents),
    colega_amigo: input.missionEvents.some((event) => event.event === 'help_colleague' || event.event === 'lunch_invite'),
    sete_passos: input.totalCycles >= 1,
  };
  return Object.keys(rules).filter((id) => rules[id]);
}
