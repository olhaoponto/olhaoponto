import { describe, expect, it } from 'vitest';
import { getCivilWeekday, getWeekDateRange } from '../utils/day-status';

describe('civil day status dates', () => {
  it('uses JavaScript weekday numbers on civil dates without timezone drift', () => {
    expect(getCivilWeekday('2026-11-06')).toBe(5);
    expect(getCivilWeekday('2026-11-07')).toBe(6);
    expect(getCivilWeekday('2026-11-08')).toBe(0);
  });

  it('returns Monday through Sunday for the selected week', () => {
    expect(getWeekDateRange('2026-11-07')).toEqual({ startDate: '2026-11-02', endDate: '2026-11-08' });
  });

  it('supports weeks that cross a month boundary', () => {
    expect(getWeekDateRange('2026-12-02')).toEqual({ startDate: '2026-11-30', endDate: '2026-12-06' });
  });

  it('rejects invalid civil dates without inventing a weekday', () => {
    expect(getCivilWeekday('2026-02-31')).toBe(-1);
    expect(getWeekDateRange('2026-02-31')).toEqual({ startDate: '2026-02-31', endDate: '2026-02-31' });
  });
});
