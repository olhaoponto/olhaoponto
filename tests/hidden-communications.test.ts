import { describe, expect, it } from 'vitest';
import { addHiddenCommunicationId, parseHiddenCommunicationIds, pruneHiddenCommunicationIds, serializeHiddenCommunicationIds } from '../utils/hidden-communications';

describe('hidden communications', () => {
  it('parseia JSON válido, remove duplicados e ignora valores inválidos', () => {
    expect(parseHiddenCommunicationIds(JSON.stringify(['a', 'a', 4, '', 'b']))).toEqual(['a', 'b']);
    expect(parseHiddenCommunicationIds('quebrado')).toEqual([]);
  });

  it('serializa apenas os IDs válidos', () => {
    expect(serializeHiddenCommunicationIds(['a', 'a', '', 'b'])).toBe('["a","b"]');
  });

  it('adiciona um ID sem duplicar', () => {
    expect(addHiddenCommunicationId(['a'], 'a')).toEqual(['a']);
    expect(addHiddenCommunicationId(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('mantém no máximo 200 IDs mais recentes', () => {
    const ids = Array.from({ length: 205 }, (_, index) => `id-${index}`);
    expect(pruneHiddenCommunicationIds(ids)).toHaveLength(200);
    expect(pruneHiddenCommunicationIds(ids)[0]).toBe('id-5');
  });
});
