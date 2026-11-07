import { describe, expect, it } from 'vitest';
import { DEFAULT_FRIDAY_WORK_SCHEDULE, DEFAULT_WORK_SCHEDULE, getActiveWorkSchedule, getExpectedWorkMinutes, getScheduleEndAt, getWorkScheduleForDate, getWorkSchedules, validateWorkSchedule } from '../utils/work-schedules';

const preferences = {
  work_schedules: [
    { ...DEFAULT_WORK_SCHEDULE, id: 'early', name: 'Turno cedo', start_time: '07:00', end_time: '16:00', lunch_minutes: 60, work_days: [1, 2, 3, 4, 5] },
    { ...DEFAULT_WORK_SCHEDULE, id: 'late', name: 'Turno tarde', start_time: '09:00', end_time: '18:00', lunch_minutes: 60, work_days: [1, 2, 3, 4, 5] },
  ],
  active_work_schedule_id: 'late',
};

describe('work schedules', () => {
  it('uses 08:00–18:00 Monday through Thursday and 08:00–17:00 on Friday, with 60 minutes of lunch', () => {
    expect(getWorkSchedules(null)[0]).toEqual(DEFAULT_WORK_SCHEDULE);
    expect(getExpectedWorkMinutes(DEFAULT_WORK_SCHEDULE)).toBe(540);
    expect(getWorkSchedules(null)[1]).toEqual(DEFAULT_FRIDAY_WORK_SCHEDULE);
    expect(getExpectedWorkMinutes(DEFAULT_FRIDAY_WORK_SCHEDULE)).toBe(480);
    expect(getWorkScheduleForDate(null, '2026-11-12')).toEqual(DEFAULT_WORK_SCHEDULE);
    expect(getWorkScheduleForDate(null, '2026-11-13')).toEqual(DEFAULT_FRIDAY_WORK_SCHEDULE);
  });

  it('migrates an exactly matching legacy weekday default in memory and keeps the saved lunch duration', () => {
    const legacy = { ...DEFAULT_WORK_SCHEDULE, name: 'Jornada padrão', end_time: '18:00', work_days: [1, 2, 3, 4, 5], lunch_minutes: 45 };
    const schedules = getWorkSchedules({ work_schedules: [legacy], active_work_schedule_id: legacy.id });
    expect(schedules).toHaveLength(2);
    expect(schedules[0].work_days).toEqual([1, 2, 3, 4]);
    expect(schedules[1].work_days).toEqual([5]);
    expect(schedules[1].end_time).toBe('17:00');
    expect(schedules[1].lunch_minutes).toBe(45);
  });

  it('selects an active saved schedule and falls back when its id is stale', () => {
    expect(getActiveWorkSchedule(preferences).id).toBe('late');
    expect(getActiveWorkSchedule({ ...preferences, active_work_schedule_id: 'missing' }).id).toBe('early');
  });

  it('calculates a fixed planned end in America/Bahia only on configured days', () => {
    expect(getScheduleEndAt('2026-11-09', DEFAULT_WORK_SCHEDULE)?.toISOString()).toBe('2026-11-09T21:00:00.000Z');
    expect(getScheduleEndAt('2026-11-13', DEFAULT_FRIDAY_WORK_SCHEDULE)?.toISOString()).toBe('2026-11-13T20:00:00.000Z');
    expect(getScheduleEndAt('2026-11-08', DEFAULT_WORK_SCHEDULE)).toBeNull();
  });

  it('rejects invalid work schedules', () => {
    expect(validateWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, end_time: '07:30' })).toContain('depois do início');
    expect(validateWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, work_days: [] })).toContain('ao menos um dia');
  });
});
