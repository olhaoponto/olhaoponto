import { describe, expect, it } from 'vitest';
import type { DayOccurrence, DayStatusRecord } from '@/types/app';
import { keepCachedOnError, mergeDayOccurrence, mergeDayOccurrences, mergeDayStatuses } from './day-cache-merge';

const occurrence = (workDate: string, pending = false): DayOccurrence => ({
  id: `occ-${workDate}`,
  user_id: 'user-1',
  work_date: workDate,
  motivo: 'Pessoal',
  occurred_at: `${workDate}T12:00:00.000Z`,
  observacao: null,
  debito_minutos: 30,
  created_at: `${workDate}T12:00:00.000Z`,
  ...(pending ? { _pending: true } : {}),
});

const status = (data: string, pending = false): DayStatusRecord => ({
  user_id: 'user-1',
  data,
  status: 'working',
  atualizado_em: `${data}T12:00:00.000Z`,
  ...(pending ? { _pending: true } : {}),
});

describe('daily cache remote merge rules', () => {
  it('removes a non-pending occurrence when the successful remote response is empty', () => {
    const result = mergeDayOccurrence([occurrence('2026-11-27')], '2026-11-27', null);
    expect(result.data).toBeNull();
    expect(result.rows).toEqual([]);
  });

  it('keeps a pending occurrence when the successful remote response is empty', () => {
    const pending = occurrence('2026-11-27', true);
    const result = mergeDayOccurrence([pending], '2026-11-27', null);
    expect(result.data).toEqual(pending);
    expect(result.rows).toEqual([pending]);
  });

  it('keeps only pending occurrences missing from a successful list response', () => {
    const pending = occurrence('2026-11-26', true);
    expect(mergeDayOccurrences([occurrence('2026-11-25'), pending], [])).toEqual([pending]);
  });

  it('applies the same empty-response rule to statuses inside the requested range', () => {
    const result = mergeDayStatuses([status('2026-11-27')], [], '2026-11-27', '2026-11-27');
    expect(result).toEqual([]);
    expect(mergeDayStatuses([status('2026-11-27', true)], [], '2026-11-27', '2026-11-27')).toEqual([status('2026-11-27', true)]);
  });

  it('preserves the local result when the remote request fails', () => {
    const local = [occurrence('2026-11-27'), occurrence('2026-11-26', true)];
    expect(keepCachedOnError(local)).toEqual(local);
  });
});
