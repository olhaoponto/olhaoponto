import { describe, expect, it } from 'vitest';
import { formatAgendaDateInput, formatAgendaTimeInput, parseAgendaDateTime, parseAgendaReminderMinutes } from '../utils/agenda';

describe('dados de reuniões da Agenda', () => {
  it('interpreta data e hora locais válidas sem deslocar o horário digitado', () => {
    const meeting = parseAgendaDateTime('07/11/2026', '14:30');
    expect(meeting?.getFullYear()).toBe(2026);
    expect(meeting?.getMonth()).toBe(10);
    expect(meeting?.getDate()).toBe(7);
    expect(formatAgendaTimeInput(meeting!)).toBe('14:30');
    expect(formatAgendaDateInput(meeting!)).toBe('07/11/2026');
  });

  it('rejeita data impossível e formato de hora inválido', () => {
    expect(parseAgendaDateTime('31/02/2026', '10:00')).toBe(null);
    expect(parseAgendaDateTime('07/11/2026', '24:00')).toBe(null);
    expect(parseAgendaDateTime('2026-11-07', '10:00')).toBe(null);
  });

  it('aceita lembretes inteiros positivos até 24 horas', () => {
    expect(parseAgendaReminderMinutes('2')).toBe(2);
    expect(parseAgendaReminderMinutes('1440')).toBe(1440);
    expect(parseAgendaReminderMinutes('0')).toBe(null);
    expect(parseAgendaReminderMinutes('1.5')).toBe(null);
    expect(parseAgendaReminderMinutes('1441')).toBe(null);
  });
});
