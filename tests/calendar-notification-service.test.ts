import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  schedule: vi.fn().mockResolvedValue('meeting-notification-id'),
  cancelByType: vi.fn().mockResolvedValue(undefined),
  permissions: vi.fn().mockResolvedValue({ status: 'granted' }),
  channel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mocks.schedule,
  getPermissionsAsync: mocks.permissions,
  setNotificationChannelAsync: mocks.channel,
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../services/notification-service', () => ({ cancelScheduledNotificationsByType: mocks.cancelByType }));

import { scheduleMeetingNotifications } from '../services/calendar-notification-service';

const event = {
  id: 'event-1', calendarId: 'calendar-1', title: 'Reunião de equipe',
  startDate: '2026-11-09T13:00:00.000Z', endDate: '2026-11-09T14:00:00.000Z',
  allDay: false, location: null, notes: null, timeZone: 'America/Bahia',
};

beforeEach(() => {
  mocks.schedule.mockClear();
  mocks.cancelByType.mockClear();
  mocks.permissions.mockReset().mockResolvedValue({ status: 'granted' });
  mocks.channel.mockClear();
});

describe('scheduleMeetingNotifications', () => {
  it('agenda aviso local 5 minutos antes sem cancelar notificações de jornada', async () => {
    const count = await scheduleMeetingNotifications([event], {
      userId: 'user-1', timeZone: 'America/Bahia', now: new Date('2026-11-09T12:00:00.000Z'),
    });
    expect(count).toBe(1);
    expect(mocks.cancelByType).toHaveBeenCalledWith(['calendar-event'], 'user-1');
    const request = mocks.schedule.mock.calls[0][0];
    expect(request.trigger.date).toEqual(new Date('2026-11-09T12:55:00.000Z'));
    expect(request.content.data).toMatchObject({ type: 'calendar-event', user_id: 'user-1', event_id: 'event-1' });
  });

  it('não agenda eventos de dia inteiro nem avisos cujo horário já passou', async () => {
    const count = await scheduleMeetingNotifications([
      { ...event, allDay: true },
      { ...event, id: 'past', startDate: '2026-11-09T11:00:00.000Z' },
    ], { userId: 'user-1', now: new Date('2026-11-09T11:56:00.000Z') });
    expect(count).toBe(0);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('não agenda sem permissão de notificações', async () => {
    mocks.permissions.mockResolvedValue({ status: 'denied' });
    expect(await scheduleMeetingNotifications([event], { userId: 'user-1' })).toBe(0);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
