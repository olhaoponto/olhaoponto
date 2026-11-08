import { describe, expect, it } from 'vitest';
import { estimateTypicalEntryTime, projectWorkedMinutesAt, projectWorkedRangeAt, zonedDateTime } from '../utils/calendar-risk';
import type { TimeEntry } from '../types/app';

const entry = (tipo: TimeEntry['tipo'], date: string, clock: string): TimeEntry => ({
  id: `${tipo}-${date}-${clock}`,
  user_id: 'user-1',
  data: date,
  tipo,
  registrado_em: new Date(`${date}T${clock}:00-03:00`).toISOString(),
  horario_informado_manual: false,
  editado: false,
  justificativa: null,
  criado_em: new Date(`${date}T08:00:00-03:00`).toISOString(),
  atualizado_em: new Date(`${date}T08:00:00-03:00`).toISOString(),
});

describe('calendar-risk', () => {
  it('sinaliza 11 horas trabalhadas entre entrada 07:31 e reunião até 19:31, descontando 60 minutos', () => {
    const start = entry('entrada', '2026-11-08', '07:31');
    const end = zonedDateTime('2026-11-08', '19:31')!;
    expect(projectWorkedMinutesAt([start], '2026-11-08', end, 60)).toBe(660);
    expect(projectWorkedRangeAt([start], '2026-11-08', end, 60)).toEqual({ minimumMinutes: 660, maximumMinutes: 720, breakEvidence: 'estimated' });
  });

  it('não considera que ultrapassou quando o fim equivale exatamente a dez horas trabalhadas', () => {
    const start = entry('entrada', '2026-11-08', '07:31');
    const end = zonedDateTime('2026-11-08', '18:31')!;
    expect(projectWorkedMinutesAt([start], '2026-11-08', end, 60)).toBe(600);
    expect(projectWorkedRangeAt([start], '2026-11-08', end, 60)?.maximumMinutes).toBe(660);
  });

  it('usa o intervalo real quando as batidas de saída e volta existem', () => {
    const entries = [
      entry('entrada', '2026-11-08', '07:31'),
      entry('saida_almoco', '2026-11-08', '12:00'),
      entry('volta_almoco', '2026-11-08', '12:45'),
    ];
    expect(projectWorkedMinutesAt(entries, '2026-11-08', zonedDateTime('2026-11-08', '19:31')!, 60)).toBe(675);
    expect(projectWorkedRangeAt(entries, '2026-11-08', zonedDateTime('2026-11-08', '19:31')!, 60)).toEqual({ minimumMinutes: 675, maximumMinutes: 675, breakEvidence: 'recorded' });
  });

  it('usa retorno previsto a partir da batida real de almoço ainda sem batida de volta', () => {
    const entries = [entry('entrada', '2026-11-08', '07:31'), entry('saida_almoco', '2026-11-08', '12:00')];
    expect(projectWorkedMinutesAt(entries, '2026-11-08', zonedDateTime('2026-11-08', '19:31')!, 60)).toBe(660);
  });

  it('não desconta uma pausa futura quando a reunião termina antes da batida real de saída', () => {
    const entries = [entry('entrada', '2026-11-08', '07:31'), entry('saida_almoco', '2026-11-08', '12:00')];
    const end = zonedDateTime('2026-11-08', '11:00')!;
    expect(projectWorkedRangeAt(entries, '2026-11-08', end, 60)).toEqual({ minimumMinutes: 209, maximumMinutes: 209, breakEvidence: 'not-started' });
  });

  it('mostra uma faixa quando a reunião termina antes de qualquer batida de almoço', () => {
    const start = entry('entrada', '2026-11-08', '07:31');
    const end = zonedDateTime('2026-11-08', '12:00')!;
    expect(projectWorkedRangeAt([start], '2026-11-08', end, 60)).toEqual({ minimumMinutes: 209, maximumMinutes: 269, breakEvidence: 'estimated' });
  });

  it('estima entrada futura pela mediana das cinco entradas mais recentes e exige ao menos três dias', () => {
    const history = [
      entry('entrada', '2026-11-02', '07:25'),
      entry('entrada', '2026-11-03', '07:31'),
      entry('entrada', '2026-11-04', '07:35'),
      entry('entrada', '2026-11-05', '07:29'),
      entry('entrada', '2026-11-06', '07:33'),
    ];
    expect(estimateTypicalEntryTime(history, '2026-11-09')).toEqual({ time: '07:31', minutesAfterMidnight: 451, sampleDays: 5 });
    expect(estimateTypicalEntryTime(history.slice(0, 2), '2026-11-09')).toBeNull();
  });

  it('retorna null para cálculo sem entrada registrada nem horário estimado', () => {
    expect(projectWorkedMinutesAt([], '2026-11-08', zonedDateTime('2026-11-08', '19:31')!, 60)).toBeNull();
  });
});
