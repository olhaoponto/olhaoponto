import { describe, expect, it } from 'vitest';
import type { TimeEntry } from '@/types/app';
import { mergeEntries } from '@/store/app-store';

const entry = (id: string, registrado_em: string): TimeEntry => ({
  id,
  user_id: 'user-1',
  data: registrado_em.slice(0, 10),
  tipo: 'entrada',
  registrado_em,
  horario_informado_manual: false,
  editado: false,
  justificativa: null,
  criado_em: registrado_em,
  atualizado_em: registrado_em,
});

describe('mergeEntries', () => {
  it('substitui por ID, preserva outros períodos e ordena por horário', () => {
    const current = [entry('muito-tarde', '2026-11-20T12:00:00.000Z'), entry('dia-anterior', '2026-11-01T08:00:00.000Z')];
    const incoming = [entry('muito-tarde', '2026-11-20T07:30:00.000Z'), entry('novo', '2026-11-10T09:00:00.000Z')];
    const result = mergeEntries(current, incoming);
    expect(result.map((item) => item.id)).toEqual(['dia-anterior', 'novo', 'muito-tarde']);
    expect(result.find((item) => item.id === 'muito-tarde')?.registrado_em).toBe('2026-11-20T07:30:00.000Z');
  });
});
