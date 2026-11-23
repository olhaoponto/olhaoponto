import { describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '@/utils/supabase-fetch';

describe('fetch com timeout do Supabase', () => {
  it('propaga a resposta quando chega antes do limite', async () => {
    const response = new Response('ok');
    const fetchImpl = vi.fn(async () => response);

    await expect(fetchWithTimeout('https://example.test', undefined, 100, fetchImpl)).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith('https://example.test', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('aborta a requisição quando excede o limite', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
    }));

    await expect(fetchWithTimeout('https://example.test', undefined, 5, fetchImpl)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
