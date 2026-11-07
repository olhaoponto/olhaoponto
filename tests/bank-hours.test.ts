import { describe, expect, it } from 'vitest';
import { calculateBankBalance } from '../utils/bank-hours';
import type { TimeEntry } from '../utils/work-time';

const stamp = (day: string, time: string) => `${day}T${time}:00-03:00`;
const entry = (kind: TimeEntry['tipo'], day: string, time: string): TimeEntry => ({ tipo: kind, data: day, registrado_em: stamp(day, time) });

describe('bank-hours', () => {
  it('soma o banco estimado do app a créditos e débitos externos sem sobrescrever nenhum deles', () => {
    const entries = [
      entry('entrada', '2026-11-03', '08:00'), entry('saida_almoco', '2026-11-03', '12:00'),
      entry('volta_almoco', '2026-11-03', '13:00'), entry('saida', '2026-11-03', '18:00'),
    ];
    expect(calculateBankBalance(entries, [{ saldo_minutos: 300 }, { saldo_minutos: -30 }], stamp('2026-11-03', '18:00')))
      .toEqual({ appMinutes: 60, externalMinutes: 270, totalMinutes: 330 });
  });

  it('preserva saldos externos negativos quando não há horas extras calculadas', () => {
    expect(calculateBankBalance([], [{ saldo_minutos: -90 }])).toEqual({ appMinutes: 0, externalMinutes: -90, totalMinutes: -90 });
  });

  it('calcula o exemplo de 2h no aplicativo mais 5h informadas pela empresa como 7h', () => {
    const entries = [
      entry('entrada', '2026-11-03', '08:00'), entry('saida_almoco', '2026-11-03', '12:00'),
      entry('volta_almoco', '2026-11-03', '13:00'), entry('saida', '2026-11-03', '19:00'),
    ];
    expect(calculateBankBalance(entries, [{ saldo_minutos: 300 }], stamp('2026-11-03', '19:00')).totalMinutes).toBe(420);
  });
});
