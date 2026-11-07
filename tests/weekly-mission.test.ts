import { describe, expect, it } from 'vitest';
import type { DayStatusRecord, TimeEntry } from '../types/app';
import { getWeeklyMissionSummary } from '../utils/weekly-mission';

const row = (date: string, type: TimeEntry['tipo'], time: string): TimeEntry => ({
  id: `${date}-${type}`, user_id: 'user-1', data: date, tipo: type,
  registrado_em: `${date}T${time}:00-03:00`, horario_informado_manual: false,
  editado: false, justificativa: null, criado_em: `${date}T12:00:00-03:00`, atualizado_em: `${date}T12:00:00-03:00`,
});
const fullDay = (date: string, exit: string): TimeEntry[] => [
  row(date, 'entrada', '08:00'), row(date, 'saida_almoco', '12:00'),
  row(date, 'volta_almoco', '13:00'), row(date, 'saida', exit),
];
const status = (data: string, value: DayStatusRecord['status']): DayStatusRecord => ({
  user_id: 'user-1', data, status: value, atualizado_em: `${data}T12:00:00Z`,
});

describe('weekly mission', () => {
  it('counts fully recorded work days and day outcomes, without a punitive streak', () => {
    const summary = getWeeklyMissionSummary('2026-11-06', [
      ...fullDay('2026-11-02', '17:00'), ...fullDay('2026-11-03', '18:00'),
    ], [status('2026-11-04', 'medical_leave')]);
    expect(summary.startDate).toBe('2026-11-02');
    expect(summary.completed).toBe(3);
    expect(summary.goal).toBe(3);
    expect(summary.completedDays).toContain('2026-11-04');
  });

  it('does not treat an incomplete day as a completed mission or infer missing work as deficit', () => {
    const summary = getWeeklyMissionSummary('2026-11-06', [row('2026-11-02', 'entrada', '08:00')], []);
    expect(summary.completed).toBe(0);
    expect(summary.balanceMinutes).toBe(0);
  });

  it('reports a below-schedule estimate only for a fully recorded workday', () => {
    const summary = getWeeklyMissionSummary('2026-11-03', fullDay('2026-11-03', '17:00'), []);
    expect(summary.balanceMinutes).toBe(-60);
  });

  it('excludes rest, absence and medical leave from work-hour comparisons', () => {
    const statuses = [status('2026-11-02', 'rest'), status('2026-11-03', 'absence'), status('2026-11-04', 'medical_leave')];
    const entries = [...fullDay('2026-11-02', '16:00'), ...fullDay('2026-11-03', '16:00'), ...fullDay('2026-11-04', '16:00')];
    const summary = getWeeklyMissionSummary('2026-11-06', entries, statuses);
    expect(summary.balanceMinutes).toBe(0);
    expect(summary.completed).toBe(3);
  });
});
