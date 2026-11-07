import { describe, expect, it } from 'vitest';
import { DEFAULT_WORK_SCHEDULE, getActiveWorkSchedule, getExpectedWorkMinutes, getScheduleEndAt, getWorkSchedules, validateWorkSchedule } from '../utils/work-schedules';

const preferences = {
  work_schedules: [
    { ...DEFAULT_WORK_SCHEDULE, id: 'early', name: 'Turno cedo', start_time: '07:00', end_time: '16:00', lunch_minutes: 60, work_days: [1, 2, 3, 4, 5] },
    { ...DEFAULT_WORK_SCHEDULE, id: 'late', name: 'Turno tarde', start_time: '09:00', end_time: '18:00', lunch_minutes: 60, work_days: [1, 2, 3, 4, 5] },
  ],
  active_work_schedule_id: 'late',
};

describe('work schedules', () => {
  it('uses 08:00–18:00, 60 minutes of lunch, weekdays as the default', () => {
    expect(getWorkSchedules(null)[0]).toEqual(DEFAULT_WORK_SCHEDULE);
    expect(getExpectedWorkMinutes(DEFAULT_WORK_SCHEDULE)).toBe(540);
  });

  it('selects an active saved schedule and falls back when its id is stale', () => {
    expect(getActiveWorkSchedule(preferences).id).toBe('late');
    expect(getActiveWorkSchedule({ ...preferences, active_work_schedule_id: 'missing' }).id).toBe('early');
  });

  it('calculates a fixed planned end in America/Bahia only on configured days', () => {
    expect(getScheduleEndAt('2026-11-09', DEFAULT_WORK_SCHEDULE)?.toISOString()).toBe('2026-11-09T21:00:00.000Z');
    expect(getScheduleEndAt('2026-11-08', DEFAULT_WORK_SCHEDULE)).toBeNull();
  });

  it('rejects invalid work schedules', () => {
    expect(validateWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, end_time: '07:30' })).toContain('depois do início');
    expect(validateWorkSchedule({ ...DEFAULT_WORK_SCHEDULE, work_days: [] })).toContain('ao menos um dia');
  });
});
