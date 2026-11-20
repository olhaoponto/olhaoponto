import { describe, expect, it } from 'vitest';
import type { DayStatusRecord, TimeEntry } from '@/types/app';
import { computeSevenSteps } from '@/utils/seven-steps';

const row = (date: string, type: TimeEntry['tipo']): TimeEntry => ({
  id: `${date}-${type}`, user_id: 'user-1', data: date, tipo: type,
  registrado_em: `${date}T12:00:00-03:00`, horario_informado_manual: false,
  editado: false, justificativa: null, criado_em: `${date}T12:00:00-03:00`, atualizado_em: `${date}T12:00:00-03:00`,
});
const fullDay = (date: string): TimeEntry[] => (['entrada', 'saida_almoco', 'volta_almoco', 'saida'] as const).map((type) => row(date, type));
const status = (data: string, value: string): DayStatusRecord => ({ user_id: 'user-1', data, status: value as DayStatusRecord['status'], atualizado_em: `${data}T12:00:00Z` });
const weekdays = ['2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];

describe('seven steps', () => {
  it('calcula uma sequência simples de dias úteis resolvidos', () => {
    const result = computeSevenSteps('2026-11-06', weekdays.flatMap(fullDay), []);
    expect(result).toMatchObject({ step: 7, completed: true, rewardDue: true, lastResolvedDate: '2026-11-06' });
  });

  it('ignora uma folga no meio sem quebrar a sequência', () => {
    const result = computeSevenSteps('2026-11-06', [...fullDay('2026-11-02'), ...fullDay('2026-11-03'), ...fullDay('2026-11-05'), ...fullDay('2026-11-06')], [status('2026-11-04', 'rest')]);
    expect(result.step).toBe(4);
  });

  it('zera ao encontrar um dia útil passado não resolvido', () => {
    const result = computeSevenSteps('2026-11-06', [...fullDay('2026-11-05'), row('2026-11-04', 'entrada')], []);
    expect(result.step).toBe(1);
    expect(result.lastResolvedDate).toBe('2026-11-05');
  });

  it('não zera a sequência quando hoje ainda está pendente', () => {
    const result = computeSevenSteps('2026-11-06', [...fullDay('2026-11-05'), ...fullDay('2026-11-04'), row('2026-11-06', 'entrada')], []);
    expect(result.step).toBe(2);
    expect(result.lastResolvedDate).toBe('2026-11-05');
  });

  it('não conta fins de semana nem deixa que eles quebrem', () => {
    const result = computeSevenSteps('2026-11-08', [...fullDay('2026-11-06'), ...fullDay('2026-11-05')], []);
    expect(result.step).toBe(2);
  });

  it('não deixa a mesma sequência gerar recompensa duas vezes', () => {
    const result = computeSevenSteps('2026-11-06', weekdays.flatMap(fullDay), [], undefined, '2026-11-06');
    expect(result).toMatchObject({ step: 0, completed: false, rewardDue: false });
  });
});
