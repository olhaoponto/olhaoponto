import { describe, expect, it } from 'vitest';
import { getDailyWelcome, getMascotThemeForDateKey } from '../utils/welcome-message';

describe('welcome mascot and message', () => {
  it('selects the same Portuguese message for the same Brazil civil day', () => {
    const morning = getDailyWelcome(new Date('2026-12-25T10:00:00.000Z'));
    const afternoon = getDailyWelcome(new Date('2026-12-25T15:00:00.000Z'));
    expect(morning.dateKey).toBe('2026-12-25');
    expect(afternoon.dateKey).toBe('2026-12-25');
    expect(morning.message).toBe(afternoon.message);
    expect(morning.theme).toBe('christmas');
    expect(morning.message).not.toContain('MahJong');
  });

  it('chooses the festive mascots for the supported Brazilian dates', () => {
    expect(getMascotThemeForDateKey('2026-12-31')).toBe('newyear');
    expect(getMascotThemeForDateKey('2026-01-01')).toBe('newyear');
    expect(getMascotThemeForDateKey('2026-12-25')).toBe('christmas');
    expect(getMascotThemeForDateKey('2026-02-16')).toBe('carnival');
    expect(getMascotThemeForDateKey('2026-06-24')).toBe('junina');
  });

  it('falls back to the neutral mascot outside seasonal windows or for invalid keys', () => {
    expect(getMascotThemeForDateKey('2026-11-08')).toBe('base');
    expect(getMascotThemeForDateKey('2026-02-30')).toBe('base');
    expect(getMascotThemeForDateKey('not-a-date')).toBe('base');
  });
});
