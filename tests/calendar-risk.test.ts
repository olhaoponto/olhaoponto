import { describe, expect, it } from 'vitest';
import { estimateTypicalEntryTime, projectWorkedRangeAt, projectWorkedMinutesAt, zonedDateTime } from '../utils/calendar-risk';
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

describe('risco de excesso de jornada em reuniões', () => {
  it('alerta para o exemplo de 07:31 até 19:31: o cenário de almoço feito chega a 11h', () => {
    const start = entry('entrada', '2026-11-08', '07:31');
    const end = zonedDateTime('2026-11-08', '19:31')!;
    expect(projectWorkedMinutesAt([start], '2026-11-08', end, 60)).toBe(660);
    expect(projectWorkedRangeAt([start], '2026-11-08', end, 60)).toEqual({ minimumMinutes: 660, maximumMinutes: 720, breakEvidence: 'estimated' });
  });

  it('trata exatamente 10h como limite, não como excesso confirmado', () => {
    const start = entry('entrada', '2026-11-08', '07:31');
    const projection = projectWorkedRangeAt([start], '2026-11-08', zonedDateTime('2026-11-08', '18:31')!, 60);
    expect(projection?.minimumMinutes).toBe(600);
    expect(projection?.maximumMinutes).toBe(660);
  });

  it('usa as batidas reais de almoço e não presume hora fixa', () => {
    const entries = [
      entry('entrada', '2026-11-08', '07:31'),
      entry('saida_almoco', '2026-11-08', '13:26'),
      entry('volta_almoco', '2026-11-08', '14:26'),
    ];
    expect(projectWorkedRangeAt(entries, '2026-11-08', zonedDateTime('2026-11-08', '19:31')!, 60)).toEqual({ minimumMinutes: 660, maximumMinutes: 660, breakEvidence: 'recorded' });
  });

  it('não desconta almoço futuro quando o evento termina antes da saída real', () => {
    const entries = [entry('entrada', '2026-11-08', '07:31'), entry('saida_almoco', '2026-11-08', '12:00')];
    expect(projectWorkedRangeAt(entries, '2026-11-08', zonedDateTime('2026-11-08', '11:00')!, 60)).toEqual({ minimumMinutes: 209, maximumMinutes: 209, breakEvidence: 'not-started' });
  });

  it('estima entrada futura pela mediana dos cinco registros mais recentes e exige três dias', () => {
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
});
