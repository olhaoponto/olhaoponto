import { describe, expect, it } from 'vitest';
import { getDailyWelcome, getMascotThemeForDateKey, getWelcomeMessageStorageKey } from '../utils/welcome-message';

describe('welcome mascot and message', () => {
  it('keeps the Brazil civil day and seasonal theme while varying the local phrase', () => {
    const morning = getDailyWelcome(new Date('2026-12-25T10:00:00.000Z'), { random: () => 0 });
    const afternoon = getDailyWelcome(new Date('2026-12-25T15:00:00.000Z'), { random: () => 0.999 });
    expect(morning.dateKey).toBe('2026-12-25');
    expect(afternoon.dateKey).toBe('2026-12-25');
    expect(morning.message).not.toBe(afternoon.message);
    expect(morning.theme).toBe('christmas');
    expect(morning.message).not.toContain('MahJong');
  });

  it('avoids the previous phrase when the injected RNG would select it again', () => {
    const date = new Date('2026-11-08T15:00:00.000Z');
    const first = getDailyWelcome(date, { random: () => 0 });
    const next = getDailyWelcome(date, { random: () => 0, previousMessage: first.message });

    expect(next.message).not.toBe(first.message);
    expect(next.theme).toBe(first.theme);
  });

  it('scopes the last phrase storage key to the authenticated user', () => {
    expect(getWelcomeMessageStorageKey('user-1')).toBe('olhaponto:user-1:welcome-message');
    expect(getWelcomeMessageStorageKey('user-1')).not.toBe(getWelcomeMessageStorageKey('user-2'));
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
