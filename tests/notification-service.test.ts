import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry } from '../types/app';

const mocks = vi.hoisted(() => ({
  schedule: vi.fn().mockResolvedValue('notification-id'),
  cancelAll: vi.fn().mockResolvedValue(undefined),
  getAllScheduled: vi.fn().mockResolvedValue([]),
  cancelScheduled: vi.fn().mockResolvedValue(undefined),
  setChannel: vi.fn().mockResolvedValue(undefined),
  setHandler: vi.fn(),
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: mocks.setHandler,
  scheduleNotificationAsync: mocks.schedule,
  getAllScheduledNotificationsAsync: mocks.getAllScheduled,
  cancelScheduledNotificationAsync: mocks.cancelScheduled,
  cancelAllScheduledNotificationsAsync: mocks.cancelAll,
  setNotificationChannelAsync: mocks.setChannel,
  AndroidImportance: { MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { scheduleDayNotifications } from '../services/notification-service';

type ScheduledRequest = { content: { data?: { type?: string } }; trigger?: { date?: Date } };
const at = (value: string) => new Date(value).toISOString();
function entry(tipo: TimeEntry['tipo'], time: string): TimeEntry {
  return {
    id: `${tipo}-${time}`,
    user_id: 'user-1',
    data: '2026-11-05',
    tipo,
    registrado_em: at(`2026-11-05T${time}:00-03:00`),
    horario_informado_manual: false,
    editado: false,
    justificativa: null,
    criado_em: at('2026-11-05T08:00:00-03:00'),
    atualizado_em: at('2026-11-05T08:00:00-03:00'),
  };
}
const requests = (): ScheduledRequest[] => mocks.schedule.mock.calls.map(([request]) => request as ScheduledRequest);

beforeEach(() => {
  mocks.schedule.mockClear();
  mocks.cancelAll.mockClear();
  mocks.getAllScheduled.mockReset().mockResolvedValue([]);
  mocks.cancelScheduled.mockClear();
  mocks.setChannel.mockClear();
});

describe('scheduleDayNotifications', () => {
  it('agenda uma notificação às quatro horas se o almoço ainda não começou', async () => {
    await scheduleDayNotifications([entry('entrada', '08:00')], {
      userId: 'user-1',
      now: new Date('2026-11-05T11:00:00-03:00'),
    });

    const reminder = requests().find((request) => request.content.data?.type === 'lunch-start');
    expect(reminder?.trigger?.date).toEqual(new Date('2026-11-05T12:00:00-03:00'));
  });

  it('agenda a volta após o intervalo configurado e não agenda lembrete para iniciar almoço', async () => {
    await scheduleDayNotifications([entry('entrada', '08:00'), entry('saida_almoco', '13:26')], {
      userId: 'user-1',
      lunchMinutes: 60,
      beforeMinutes: 5,
      now: new Date('2026-11-05T13:30:00-03:00'),
    });

    const scheduled = requests();
    const reminder = scheduled.find((request) => request.content.data?.type === 'lunch-return');
    const preAlert = scheduled.find((request) => request.content.data?.type === 'lunch-return-prealert');
    expect(reminder?.trigger?.date).toEqual(new Date('2026-11-05T14:26:00-03:00'));
    expect(preAlert?.trigger?.date).toEqual(new Date('2026-11-05T14:21:00-03:00'));
    expect(scheduled.some((request) => request.content.data?.type === 'lunch-start')).toBe(false);
  });

  it('usa a antecedência personalizada informada nas preferências', async () => {
    await scheduleDayNotifications([entry('entrada', '08:00'), entry('saida_almoco', '13:26')], {
      userId: 'user-1', lunchMinutes: 60, beforeMinutes: 2,
      now: new Date('2026-11-05T13:30:00-03:00'),
    });
    const preAlert = requests().find((request) => request.content.data?.type === 'lunch-return-prealert');
    expect(preAlert?.trigger?.date).toEqual(new Date('2026-11-05T14:24:00-03:00'));
  });

  it('não cancela lembretes de reunião ao recalcular alertas de jornada', async () => {
    mocks.getAllScheduled.mockResolvedValue([
      { identifier: 'work-1', content: { data: { type: 'work-alert', user_id: 'user-1' } } },
      { identifier: 'meeting-1', content: { data: { type: 'calendar-event', user_id: 'user-1' } } },
      { identifier: 'work-2', content: { data: { type: 'work-alert', user_id: 'user-2' } } },
    ]);
    await scheduleDayNotifications([], { userId: 'user-1' });
    expect(mocks.cancelScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.cancelScheduled).toHaveBeenCalledWith('work-1');
  });
});
