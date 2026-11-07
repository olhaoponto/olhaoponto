import { describe, expect, it } from 'vitest';
import { DEFAULT_WORK_SCHEDULE, getActiveWorkSchedule, getExpectedWorkMinutes, getExpectedWorkMinutesForDate, getScheduleEndAt, getWorkScheduleForDate, getWorkSchedules, validateWorkSchedule } from '../utils/work-schedules';

const preferences = {
  work_schedules: [
    { ...DEFAULT_WORK_SCHEDULE, id: 'early', name: 'Turno cedo', start_time: '07:00', end_time: '16:00', lunch_minutes: 60, work_days: [1, 2, 3, 4, 5], day_overrides: undefined },
    { ...DEFAULT_WORK_SCHEDULE, id: 'late', name: 'Turno tarde', start_time: '09:00', end_time: '18:00', lunch_minutes: 60, work_days: [1, 2, 3, 4, 5], day_overrides: undefined },
  ],
  active_work_schedule_id: 'late',
};

const oldSplitPreferences = {
  work_schedules: [
    { id: 'default-weekday-08-18', name: 'Jornada padrão · segunda a quinta', start_time: '08:00', end_time: '18:00', lunch_minutes: 60, work_days: [1, 2, 3, 4] },
    { id: 'default-friday-08-17', name: 'Jornada padrão · sexta-feira', start_time: '08:00', end_time: '17:00', lunch_minutes: 45, work_days: [5] },
  ],
  active_work_schedule_id: 'default-friday-08-17',
};

describe('work schedules', () => {
  it('uses one default active schedule with an internal Friday override', () => {
    const schedules = getWorkSchedules(null);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toEqual(DEFAULT_WORK_SCHEDULE);
    expect(DEFAULT_WORK_SCHEDULE.work_days).toEqual([1, 2, 3, 4, 5]);
    expect(getExpectedWorkMinutes(DEFAULT_WORK_SCHEDULE)).toBe(540);
    expect(getWorkScheduleForDate(null, '2026-11-12').end_time).toBe('18:00');
    expect(getWorkScheduleForDate(null, '2026-11-13').end_time).toBe('17:00');
    expect(getExpectedWorkMinutesForDate(DEFAULT_WORK_SCHEDULE, '2026-11-12')).toBe(540);
    expect(getExpectedWorkMinutesForDate(DEFAULT_WORK_SCHEDULE, '2026-11-13')).toBe(480);
  });

  it('merges the previous separate Friday schedule into the same active schedule in memory', () => {
    const schedules = getWorkSchedules(oldSplitPreferences);
    expect(schedules).toHaveLength(1);
    expect(schedules[0].id).toBe('default-weekday-08-18');
    expect(schedules[0].work_days).toEqual([1, 2, 3, 4, 5]);
    expect(schedules[0].day_overrides?.[5]).toEqual({ start_time: '08:00', end_time: '17:00', lunch_minutes: 45 });
    expect(getActiveWorkSchedule(oldSplitPreferences).id).toBe('default-weekday-08-18');
    expect(getWorkScheduleForDate(oldSplitPreferences, '2026-11-13').lunch_minutes).toBe(45);
  });

  it('merges the legacy Friday rule even when it appears before the main schedule', () => {
    const reversed = { ...oldSplitPreferences, work_schedules: [...oldSplitPreferences.work_schedules].reverse() };
    const schedules = getWorkSchedules(reversed);
    expect(schedules).toHaveLength(1);
    expect(schedules[0].id).toBe('default-weekday-08-18');
    expect(schedules[0].work_days).toEqual([1, 2, 3, 4, 5]);
    expect(schedules[0].day_overrides?.[5]).toEqual({ start_time: '08:00', end_time: '17:00', lunch_minutes: 45 });
    expect(getActiveWorkSchedule(reversed).id).toBe('default-weekday-08-18');
  });

  it('preserves a selected legacy Friday schedule when another schedule is listed first', () => {
    const custom = { ...DEFAULT_WORK_SCHEDULE, id: 'early', name: 'Turno cedo', work_days: [1, 2, 3, 4, 5], day_overrides: undefined };
    const preferencesWithCustomFirst = { ...oldSplitPreferences, work_schedules: [custom, ...oldSplitPreferences.work_schedules] };
    expect(getActiveWorkSchedule(preferencesWithCustomFirst).id).toBe('default-weekday-08-18');
    expect(getWorkScheduleForDate(preferencesWithCustomFirst, '2026-11-13').end_time).toBe('17:00');
  });

  it('migrates the old single 08:00–18:00 Monday–Friday default without replacing its lunch setting', () => {
    const legacy = { id: 'default-weekday-08-18', name: 'Jornada padrão', start_time: '08:00', end_time: '18:00', lunch_minutes: 45, work_days: [1, 2, 3, 4, 5] };
    const schedules = getWorkSchedules({ work_schedules: [legacy], active_work_schedule_id: legacy.id });
    expect(schedules).toHaveLength(1);
    expect(schedules[0].lunch_minutes).toBe(45);
    expect(schedules[0].day_overrides?.[5]?.end_time).toBe('17:00');
    expect(schedules[0].day_overrides?.[5]?.lunch_minutes).toBe(45);
  });

  it('selects a custom active schedule and falls back when its id is stale', () => {
    expect(getActiveWorkSchedule(preferences).id).toBe('late');
    expect(getActiveWorkSchedule({ ...preferences, active_work_schedule_id: 'missing' }).id).toBe('early');
  });

  it('calculates fixed planned end by weekday in America/Bahia', () => {
    expect(getScheduleEndAt('2026-11-09', DEFAULT_WORK_SCHEDULE)?.toISOString()).toBe('2026-11-09T21:00:00.000Z');
    expect(getScheduleEndAt('2026-11-13', DEFAULT_WORK_SCHEDULE)?.toISOString()).toBe('2026-11-13T20:00:00.000Z');
    expect(getScheduleEndAt('2026-11-08', DEFAULT_WORK_SCHEDULE)).toBeNull();
  });

  it('preserves customized schedules and validates their day-specific hours', () => {
    const custom = { ...DEFAULT_WORK_SCHEDULE, id: 'custom', name: 'Comercial', start_time: '07:30', end_time: '16:30', work_days: [1, 2, 3, 4, 5], day_overrides: { 5: { end_time: '15:30' } } };
    expect(getWorkSchedules({ work_schedules: [custom] })).toHaveLength(1);
    expect(getWorkScheduleForDate({ work_schedules: [custom] }, '2026-11-13').end_time).toBe('15:30');
    expect(validateWorkSchedule({ ...custom, day_overrides: { 5: { end_time: '06:00' } } })).toContain('horários válidos');
  });

  it('rejects invalid work schedules', () => {
    expect(validateWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, end_time: '07:30' })).toContain('depois do início');
    expect(validateWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, work_days: [] })).toContain('ao menos um dia');
  });
});
