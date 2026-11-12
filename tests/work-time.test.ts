import {
  calculateDailyTotals,
  calculatePeriodTotals,
  calculateWorkedMinutes,
  calculateWorkedSeconds,
  formatMinutesHHMM,
  getBahiaDate,
  getNextPunch,
  projectEndTime,
  safeClockOutTimestamp,
  validateEntries,
  validatePunch,
  type TimeEntry,
} from '../utils/work-time';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
  toBeNull(): void;
  toEqual(expected: unknown): void;
  toMatchObject(expected: object): void;
};

const entry = (tipo: TimeEntry['tipo'], time: string, data?: string): TimeEntry => ({ tipo, registrado_em: time, data });
const at = (hour: number, minute = 0, day = '2026-11-03') => `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`;

describe('work-time', () => {
  it('calcula contador vivo antes da saída para almoço', () => {
    expect(calculateWorkedMinutes([entry('entrada', at(8))], at(10, 15))).toBe(135);
    expect(calculateWorkedSeconds([entry('entrada', at(8))], at(10, 15, '2026-11-03'))).toBe(8100);
  });

  it('pausa durante almoço e retoma depois da volta', () => {
    const beforeLunch = [entry('entrada', at(8)), entry('saida_almoco', at(12))];
    expect(calculateWorkedMinutes(beforeLunch, at(13))).toBe(240);
    const afterLunch = [...beforeLunch, entry('volta_almoco', at(13))];
    expect(calculateWorkedMinutes(afterLunch, at(15, 30))).toBe(390);
  });

  it('projeta fim com almoço padrão antes e intervalo real depois da volta', () => {
    const entries = [entry('entrada', at(8)), entry('saida_almoco', at(12))];
    expect(projectEndTime(entries)).toBe(new Date(at(19)).toISOString());
    expect(projectEndTime([...entries, entry('volta_almoco', at(12, 45))])).toBe(new Date(at(18, 45)).toISOString());
  });

  it('valida as batidas até exatamente 10h e bloqueia qualquer excesso', () => {
    const entries = [entry('entrada', at(8)), entry('saida_almoco', at(12)), entry('volta_almoco', at(13))];
    expect(validatePunch(entries, entry('saida', at(19)), at(19)).valid).toBe(true);
    const blocked = validatePunch(entries, entry('saida', at(19, 1)), at(19, 1));
    expect(blocked.valid).toBe(false);
    expect(blocked.reason).toBe('daily_limit_exceeded');
  });

  it('registra saída no último minuto permitido quando o botão crítico é acionado tarde', () => {
    const entries = [entry('entrada', at(8)), entry('saida_almoco', at(12)), entry('volta_almoco', at(13))];
    const requestedAt = new Date(at(19, 2));
    const delayed = safeClockOutTimestamp(entries, requestedAt, 600, 60);
    expect(delayed.timestamp).toBe(new Date(at(19)).toISOString());
    expect(delayed.capped).toBe(true);
    expect(validatePunch(entries, entry('saida', delayed.timestamp), requestedAt, 600).valid).toBe(true);
    expect(safeClockOutTimestamp(entries, new Date(at(19)), 600, 60).capped).toBe(false);
  });

  it('aplica as mesmas regras a batida digitada manualmente', () => {
    const entries = [entry('entrada', at(8)), entry('saida_almoco', at(12)), entry('volta_almoco', at(13))];
    const manual = { ...entry('saida', at(19, 1)), horario_informado_manual: true };
    expect(validatePunch(entries, manual, at(19, 1)).reason).toBe('daily_limit_exceeded');
  });

  it('rejeita futuro, ordem incorreta, duplicidade e sequência inválida', () => {
    const start = entry('entrada', at(8));
    expect(validatePunch([], start, at(7, 59)).reason).toBe('future');
    expect(validatePunch([start], entry('saida_almoco', at(7, 59)), at(8)).reason).toBe('out_of_order');
    expect(validatePunch([start], start, at(9)).reason).toBe('duplicate_type');
    expect(validatePunch([], entry('volta_almoco', at(8, 30)), at(9)).reason).toBe('unexpected_type');
  });

  it('interpreta data local de Bahia corretamente na virada de dia UTC', () => {
    expect(getBahiaDate('2026-11-04T02:30:00.000Z')).toBe('2026-11-03');
    expect(getBahiaDate('2026-11-04T03:30:00.000Z')).toBe('2026-11-04');
    expect(validatePunch([], entry('entrada', '2026-11-04T02:30:00.000Z', '2026-11-04'), '2026-11-04T02:45:00.000Z').reason).toBe('wrong_date');
  });

  it('calcula HH:MM, próximos passos e extras acima da jornada do dia', () => {
    const dayOne = [entry('entrada', at(8)), entry('saida_almoco', at(12)), entry('volta_almoco', at(13)), entry('saida', at(17))];
    const dayTwo = [entry('entrada', at(8, 30, '2026-11-04')), entry('saida_almoco', at(12, 30, '2026-11-04')), entry('volta_almoco', at(13, 30, '2026-11-04')), entry('saida', at(18, 30, '2026-11-04'))];
    expect(formatMinutesHHMM(525)).toBe('08:45');
    expect(getNextPunch([entry('entrada', at(8))])).toBe('saida_almoco');
    expect(getNextPunch(dayOne)).toBeNull();
    const daily = calculateDailyTotals([...dayOne, ...dayTwo]);
    expect(daily.map(({ workedMinutes, overtimeMinutes }) => [workedMinutes, overtimeMinutes])).toEqual([[480, 0], [540, 0]]);
    expect(calculatePeriodTotals([...dayOne, ...dayTwo])).toMatchObject({ workedMinutes: 1020, overtimeMinutes: 0, workedHHMM: '17:00', overtimeHHMM: '00:00' });
  });

  it('considera 8h como jornada normal na sexta-feira', () => {
    const friday = [entry('entrada', at(8, 0, '2026-11-06')), entry('saida_almoco', at(12, 0, '2026-11-06')), entry('volta_almoco', at(13, 0, '2026-11-06')), entry('saida', at(17, 30, '2026-11-06'))];
    expect(calculateDailyTotals(friday)[0].overtimeMinutes).toBe(30);
  });

  it('valida um conjunto de quatro batidas em sequência', () => {
    expect(validateEntries([entry('entrada', at(8)), entry('saida_almoco', at(12)), entry('volta_almoco', at(13)), entry('saida', at(17))], at(17)).valid).toBe(true);
  });
});
