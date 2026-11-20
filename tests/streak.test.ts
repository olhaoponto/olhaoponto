import { describe, expect, it } from 'vitest';
import { computeStreak } from '../utils/streak';

type Entry = { data: string };
type Status = { data: string; status: 'working' | 'rest' | 'absence' | 'medical_leave' };

const days = (...data: string[]): Entry[] => data.map((item) => ({ data: item }));
const punches = (date: string, count = 4): Entry[] => Array.from({ length: count }, () => ({ data: date }));

const today = '2026-11-20';

describe('computeStreak', () => {
  it('conta dias completos consecutivos e sinaliza hoje incompleto em risco', () => {
    const result = computeStreak([...punches('2026-11-19'), ...punches('2026-11-18'), ...days(today, today)], [], today);
    expect(result).toEqual({ atual: 2, recorde: 2, emRisco: true });
  });

  it('pula folga e atestado sem quebrar nem somar', () => {
    const result = computeStreak(
      [...punches(today), ...punches('2026-11-18')],
      [{ data: '2026-11-19', status: 'rest' }],
      today,
    );
    expect(result.atual).toBe(2);
    expect(result.emRisco).toBe(false);
  });

  it('faz falta quebrar a sequência', () => {
    const result = computeStreak(
      [...punches(today), ...punches('2026-11-18')],
      [{ data: '2026-11-19', status: 'absence' }],
      today,
    );
    expect(result).toEqual({ atual: 1, recorde: 1, emRisco: false });
  });

  it('não quebra por hoje incompleto e mantém a sequência até ontem', () => {
    const result = computeStreak(
      [...punches('2026-11-19'), ...punches('2026-11-18'), ...days(today)],
      [],
      today,
    );
    expect(result.atual).toBe(2);
    expect(result.emRisco).toBe(true);
  });

  it('preserva o recorde anterior quando a sequência atual é menor', () => {
    const result = computeStreak(punches(today), [], today, 7);
    expect(result).toEqual({ atual: 1, recorde: 7, emRisco: false });
  });
});
