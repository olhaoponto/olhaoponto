import { describe, expect, it, vi } from 'vitest';
import { calculateOccurrenceDebitMinutes, type TimeEntry } from '../utils/work-time';

describe('intercorrência', () => {
  const entry = (tipo: TimeEntry['tipo'], day: string, time: string): TimeEntry => ({ tipo, data: day, registrado_em: `${day}T${time}:00-03:00` });
  it('calcula débito de 9h de segunda a quinta sem almoço', () => {
    const entries = [entry('entrada', '2026-11-02', '08:00')];
    expect(calculateOccurrenceDebitMinutes(entries, '2026-11-02T12:00:00-03:00', 540)).toBe(300);
  });
  it('calcula débito de 8h na sexta descontando o almoço', () => {
    const entries = [entry('entrada', '2026-11-06', '08:00'), entry('saida_almoco', '2026-11-06', '12:00'), entry('volta_almoco', '2026-11-06', '13:00')];
    expect(calculateOccurrenceDebitMinutes(entries, '2026-11-06T16:00:00-03:00', 480)).toBe(60);
  });
  it('nunca gera débito negativo', () => {
    const entries = [entry('entrada', '2026-11-02', '08:00')];
    expect(calculateOccurrenceDebitMinutes(entries, '2026-11-02T18:00:00-03:00', 540)).toBe(0);
  });
});

it('não agenda notificações após a intercorrência', async () => {
  vi.resetModules();
  const schedule = vi.fn().mockResolvedValue('id');
  const cancel = vi.fn().mockResolvedValue(undefined);
  const getScheduled = vi.fn().mockResolvedValue([]);
  vi.doMock('expo-notifications', () => ({ setNotificationHandler: vi.fn(), scheduleNotificationAsync: schedule, cancelScheduledNotificationAsync: cancel, getAllScheduledNotificationsAsync: getScheduled, setNotificationChannelAsync: vi.fn(), getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }), AndroidImportance: { MAX: 5 }, SchedulableTriggerInputTypes: { DATE: 'date' } }));
  vi.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
  const { scheduleDayNotifications } = await import('../services/notification-service');
  await scheduleDayNotifications([{ tipo: 'entrada', data: '2026-11-02', registrado_em: '2026-11-02T08:00:00-03:00' }], { dayClosed: true, now: new Date('2026-11-02T12:00:00-03:00') });
  expect(schedule).not.toHaveBeenCalled();
});
