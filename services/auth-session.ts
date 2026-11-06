import type { Session } from '@supabase/supabase-js';
import { useAppStore } from '../store/app-store';
import { supabase } from './supabase';

export const SESSION_REQUIRED_MESSAGE = 'Sua sessão não está ativa. Entre novamente para continuar.';

export async function getAuthenticatedSession(): Promise<{ session: Session | null; error: string | null }> {
  try {
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
    }

    return { session: null, error: SESSION_REQUIRED_MESSAGE };
  } catch {
    return { session: null, error: SESSION_REQUIRED_MESSAGE };
  }
}
