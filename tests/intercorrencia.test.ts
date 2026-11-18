import { describe, expect, it } from 'vitest';
import { calculateOccurrenceDebitMinutes, type TimeEntry, validateOccurrenceTime } from '../utils/work-time';

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
  it('rejeita encerramento futuro ou anterior à primeira batida', () => {
    const entries = [entry('entrada', '2026-11-02', '08:00')];
    expect(validateOccurrenceTime(entries, '2026-11-02T18:01:00-03:00', '2026-11-02T18:00:00-03:00')).toBe('O horário de encerramento não pode ser futuro.');
    expect(validateOccurrenceTime(entries, '2026-11-02T07:59:00-03:00', '2026-11-02T18:00:00-03:00')).toBe('O horário de encerramento não pode ser anterior à primeira batida.');
  });
});
