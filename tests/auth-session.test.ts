import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  getStoredSession: vi.fn(),
  setStoreSession: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, setSession: mocks.setSession } },
}));
vi.mock('../store/app-store', () => ({
  useAppStore: { getState: () => ({ session: mocks.getStoredSession(), setSession: mocks.setStoreSession }) },
}));

import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from '../services/auth-session';

function makeSession(accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4_000_000_000,
    user: { id: 'user-1' },
  } as Session;
}

describe('authenticated session recovery', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.setSession.mockReset();
    mocks.getStoredSession.mockReset();
    mocks.setStoreSession.mockReset();
  });

  it('keeps the current Supabase session as the source of truth', async () => {
    const session = makeSession('fresh-access-token');
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.getStoredSession.mockReturnValue(null);

    const result = await getAuthenticatedSession();

    expect(result).toEqual({ session, error: null });
    expect(mocks.setStoreSession).toHaveBeenCalledWith(session);
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('restores the fresh login session if the auth client temporarily reports none', async () => {
    const cached = makeSession('login-access-token');
    const restored = makeSession('restored-access-token');
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getStoredSession.mockReturnValue(cached);
    mocks.setSession.mockResolvedValue({ data: { session: restored }, error: null });

    const result = await getAuthenticatedSession();

    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: cached.access_token, refresh_token: cached.refresh_token });
    expect(result).toEqual({ session: restored, error: null });
    expect(mocks.setStoreSession).toHaveBeenCalledWith(restored);
  });

  it('returns a clear re-login instruction when neither source has a session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getStoredSession.mockReturnValue(null);

    const result = await getAuthenticatedSession();

    expect(result.session).toBe(null);
    expect(result.error).toBe(SESSION_REQUIRED_MESSAGE);
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
});
