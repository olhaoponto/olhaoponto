import { describe, expect, it } from 'vitest';
import { cacheWindowStart, pruneDayStatuses, pruneTimeEntries, rowsChanged } from '@/utils/local-history-cache';
import type { TimeEntry } from '@/types/app';

const today = '2026-11-23';
const makeEntry = (id: string, data: string, tipo: TimeEntry['tipo'], pending = false): TimeEntry => ({
  id,
  user_id: 'user-1',
  data,
  tipo,
  registrado_em: `${data}T09:00:00.000Z`,
  horario_informado_manual: false,
  editado: false,
  justificativa: null,
  criado_em: `${data}T09:00:00.000Z`,
  atualizado_em: `${data}T09:00:00.000Z`,
  ...(pending ? { _pending: true } : {}),
});

describe('cache local de histórico', () => {
  it('poda a janela antiga, mas preserva pendências offline', () => {
    const rows = [
      makeEntry('old', '2026-01-01', 'entrada'),
      makeEntry('recent', today, 'entrada'),
      makeEntry('pending-old', '2025-01-01', 'saida', true),
    ];
    expect(pruneTimeEntries(rows, today).map((row) => row.id)).toEqual(['recent', 'pending-old']);
  });

  it('migra status antigo no primeiro acesso e mantém status pendente', () => {
    const rows = [
      { user_id: 'u', data: cacheWindowStart(today, 150), status: 'rest' as const, atualizado_em: 'x' },
      { user_id: 'u', data: '2020-01-01', status: 'absence' as const, atualizado_em: 'x' },
      { user_id: 'u', data: '2020-01-01', status: 'medical_leave' as const, atualizado_em: 'x', _pending: true },
    ];
    expect(pruneDayStatuses(rows, today).map((row) => row.data)).toEqual(['2026-06-27', '2020-01-01']);
  });

  it('detecta quando uma gravação seria desnecessária', () => {
    const rows = [{ id: 'a' }];
    expect(rowsChanged(rows, rows)).toBe(false);
    expect(rowsChanged(rows, [{ id: 'b' }])).toBe(true);
  });
});
