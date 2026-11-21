import { describe, expect, it } from 'vitest';
import { evaluateAchievementRules } from '@/utils/achievements';

const entry = (data: string, tipo: 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida') => ({ data, tipo });
const completeDay = (data: string) => [entry(data, 'entrada'), entry(data, 'saida_almoco'), entry(data, 'volta_almoco'), entry(data, 'saida')];

const base = () => ({
  today: '2026-11-20',
  entries: [] as { data: string; tipo: 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida' }[],
  statuses: [] as { data: string; status: 'working' | 'rest' | 'absence' | 'medical_leave' }[],
  streak: { atual: 0, recorde: 0, emRisco: false },
  missionEvents: [] as { week: string; event: string }[],
  totalCycles: 0,
});

describe('regras de conquistas', () => {
  it('desbloqueia primeiro ponto e dia completo', () => {
    const input = base();
    input.entries = completeDay('2026-11-19');
    expect(evaluateAchievementRules(input)).toEqual(expect.arrayContaining(['primeiro_ponto', 'dia_completo']));
  });

  it('reconhece uma semana perfeita com cinco dias completos', () => {
    const input = base();
    input.entries = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].flatMap(completeDay);
    expect(evaluateAchievementRules(input)).toContain('semana_perfeita');
  });

  it('usa o recorde da sequência para os marcos', () => {
    const input = base();
    input.streak.recorde = 100;
    expect(evaluateAchievementRules(input)).toEqual(expect.arrayContaining(['sequencia_7', 'sequencia_30', 'sequencia_100']));
  });

  it('reconhece eventos, mês fechado e Sete Passos', () => {
    const input = base();
    input.statuses = [{ data: '2026-10-03', status: 'working' }];
    input.missionEvents = [
      { week: '2026-10-05', event: 'review_mirror' },
      { week: '2026-10-12', event: 'review_mirror' },
      { week: '2026-10-19', event: 'review_mirror' },
      { week: '2026-10-26', event: 'review_mirror' },
      { week: '2026-11-20', event: 'help_colleague' },
    ];
    input.totalCycles = 1;
    expect(evaluateAchievementRules(input)).toEqual(expect.arrayContaining(['mes_completo', 'espelho_em_dia', 'colega_amigo', 'sete_passos']));
  });

  it('não concede o mês quando há falta', () => {
    const input = base();
    input.statuses = [{ data: '2026-10-03', status: 'absence' }];
    expect(evaluateAchievementRules(input)).not.toContain('mes_completo');
  });
});
