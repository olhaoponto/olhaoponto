import { describe, expect, it } from 'vitest';
import { serveCached } from '@/utils/cache-first';

describe('cache-first', () => {
  it('chama o callback com uma cópia assim que o cache é servido', () => {
    const source = [{ id: 'cached' }];
    let callbackRows: { id: string }[] | undefined;
    const result = serveCached(source, (rows) => { callbackRows = rows; });

    expect(callbackRows).toEqual(source);
    expect(callbackRows).not.toBe(source);
    expect(result).toEqual(source);
  });
});
