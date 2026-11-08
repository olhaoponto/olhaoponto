import { describe, expect, it } from 'vitest';
import { calculateLunchReturnTimes, getLunchReturnWarningMinutes, parseLunchReturnWarningMinutes } from '../utils/lunch-return';

describe('retorno real do almoço', () => {
  it('calcula 13:26 + 60 min = 14:26 e avisa às 14:21 com 5 min de antecedência', () => {
    const timing = calculateLunchReturnTimes('2026-11-07T13:26:00-03:00', 60, 5);
    expect(timing?.returnAt.toISOString()).toBe('2026-11-07T17:26:00.000Z');
    expect(timing?.warningAt.toISOString()).toBe('2026-11-07T17:21:00.000Z');
  });

  it('aceita antecedência personalizada de 2 minutos e usa-a no cálculo', () => {
    const timing = calculateLunchReturnTimes('2026-11-07T13:26:00-03:00', 60, 2);
    expect(parseLunchReturnWarningMinutes('2')).toBe(2);
    expect(timing?.warningAt.toISOString()).toBe('2026-11-07T17:24:00.000Z');
  });

  it('usa cinco minutos como padrão e rejeita valor zero, decimal e acima do limite', () => {
    expect(getLunchReturnWarningMinutes(undefined)).toBe(5);
    expect(parseLunchReturnWarningMinutes('0')).toBe(null);
    expect(parseLunchReturnWarningMinutes('2.5')).toBe(null);
    expect(parseLunchReturnWarningMinutes('181')).toBe(null);
  });

  it('não calcula para timestamp ou duração inválidos', () => {
    expect(calculateLunchReturnTimes('data inválida', 60, 5)).toBe(null);
    expect(calculateLunchReturnTimes('2026-11-07T13:26:00-03:00', 481, 5)).toBe(null);
  });
});
