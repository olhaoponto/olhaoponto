import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry } from '../types/app';

const mocks = vi.hoisted(() => ({
  schedule: vi.fn().mockResolvedValue('notification-id'),
  cancelAll: vi.fn().mockResolvedValue(undefined),
  setChannel: vi.fn().mockResolvedValue(undefined),
  setHandler: vi.fn(),
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: mocks.setHandler,
  scheduleNotificationAsync: mocks.schedule,
  cancelAllScheduledNotificationsAsync: mocks.cancelAll,
  setNotificationChannelAsync: mocks.setChannel,
  AndroidImportance: { MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { scheduleDayNotifications } from '../services/notification-service';
import { DEFAULT_WORK_SCHEDULE } from '../utils/work-schedules';

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

  it('avisa cinco minutos antes do retorno calculado a partir da saída real para almoço', async () => {
    await scheduleDayNotifications([entry('entrada', '08:00'), entry('saida_almoco', '11:30')], {
      userId: 'user-1',
      lunchMinutes: 60,
      now: new Date('2026-11-05T12:15:00-03:00'),
    });

    const scheduled = requests();
    const reminder = scheduled.find((request) => request.content.data?.type === 'lunch-return');
    expect(reminder?.trigger?.date).toEqual(new Date('2026-11-05T12:25:00-03:00'));
    expect(scheduled.some((request) => request.content.data?.type === 'lunch-start')).toBe(false);
  });

  it('agenda o aviso de jornada completa no horário final fixo mesmo que a entrada tenha sido atrasada', async () => {
    await scheduleDayNotifications([entry('entrada', '08:10')], {
      userId: 'user-1',
      workSchedule: DEFAULT_WORK_SCHEDULE,
      now: new Date('2026-11-05T17:00:00-03:00'),
    });

    const reminder = requests().find((request) => request.content.data?.type === 'shift-complete');
    expect(reminder?.trigger?.date).toEqual(new Date('2026-11-05T18:00:00-03:00'));
  });
});
