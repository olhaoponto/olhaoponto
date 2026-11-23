import type { Session } from '@supabase/supabase-js';
import { useAppStore } from '../store/app-store';
import { supabase } from './supabase';
import { recordAuthSessionCall } from '@/utils/perf-metrics';

export const SESSION_REQUIRED_MESSAGE = 'Sua sessão não está ativa. Entre novamente para continuar.';
const SESSION_REFRESH_MARGIN_SECONDS = 60;
let sessionLookup: Promise<{ session: Session | null; error: string | null }> | null = null;

function isFresh(session: Session | null): session is Session {
  return Boolean(session?.access_token && session.expires_at && session.expires_at > Math.floor(Date.now() / 1000) + SESSION_REFRESH_MARGIN_SECONDS);
}

async function resolveAuthenticatedSession(): Promise<{ session: Session | null; error: string | null }> {
  try {
    recordAuthSessionCall();
    const current = await supabase.auth.getSession();
    if (current.data.session) {
      useAppStore.getState().setSession(current.data.session);
      return { session: current.data.session, error: null };
    }

    const fallback = useAppStore.getState().session;
    if (fallback?.access_token && fallback.refresh_token) {
      const restored = await supabase.auth.setSession({
        access_token: fallback.access_token,
        refresh_token: fallback.refresh_token,
      });
      if (!restored.error && restored.data.session) {
        useAppStore.getState().setSession(restored.data.session);
        return { session: restored.data.session, error: null };
      }
      return { session: fallback, error: null };
    }

    return { session: null, error: SESSION_REQUIRED_MESSAGE };
  } catch {
    const fallback = useAppStore.getState().session;
    if (fallback?.access_token && fallback.refresh_token) return { session: fallback, error: null };
    return { session: null, error: SESSION_REQUIRED_MESSAGE };
  }
}

export async function getAuthenticatedSession(): Promise<{ session: Session | null; error: string | null }> {
  const stored = useAppStore.getState().session;
  if (isFresh(stored)) return { session: stored, error: null };
  if (!sessionLookup) {
    sessionLookup = resolveAuthenticatedSession().finally(() => { sessionLookup = null; });
  }
  return sessionLookup;
}
