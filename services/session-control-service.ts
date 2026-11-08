import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const baselineKey = (userId: string) => `olhaponto:${userId}:session-control-baseline`;

type ControlResult = { forced: boolean; error: string | null };

function tokenIssuedAtMs(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart || typeof globalThis.atob !== 'function') return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
    const claims = JSON.parse(globalThis.atob(base64)) as { iat?: unknown };
    const issuedAt = Number(claims.iat);
    return Number.isFinite(issuedAt) && issuedAt > 0 ? issuedAt * 1000 : null;
  } catch { return null; }
}

async function readForcedLogoutAt(userId: string): Promise<{ value: string | null; error: string | null }> {
  try {
    const { data, error } = await (supabase as any)
      .from('user_session_controls')
      .select('forced_logout_at')
      .eq('user_id', userId)
      .maybeSingle();
    return { value: (data?.forced_logout_at as string | null | undefined) ?? null, error: error?.message ?? null };
  } catch (error) { return { value: null, error: error instanceof Error ? error.message : 'Falha ao consultar o controle de sessão.' }; }
}

/** Initializes a baseline only for a new password sign-in, never on access-token refresh. */
export async function captureSessionControlBaseline(session: Session): Promise<ControlResult> {
  const remote = await readForcedLogoutAt(session.user.id);
  if (remote.error) return { forced: false, error: remote.error };
  const marker = remote.value ?? '';
  if (marker) {
    const markerMs = new Date(marker).getTime();
    const issuedAtMs = tokenIssuedAtMs(session.access_token);
    if (!Number.isFinite(markerMs) || issuedAtMs === null || issuedAtMs <= markerMs) return { forced: true, error: null };
  }
  try { await AsyncStorage.setItem(baselineKey(session.user.id), marker); } catch { /* o JWT permanece suficiente no próximo início, se necessário */ }
  return { forced: false, error: null };
}

/** A changed server marker forces every online app session to sign out on its next check. */
export async function checkSessionControl(session: Session): Promise<ControlResult> {
  const remote = await readForcedLogoutAt(session.user.id);
  if (remote.error) return { forced: false, error: remote.error };
  const marker = remote.value ?? '';
  let baseline: string | null = null;
  try { baseline = await AsyncStorage.getItem(baselineKey(session.user.id)); } catch { /* compara o iat do JWT */ }
  if (baseline !== null) return { forced: baseline !== marker, error: null };
  if (marker) {
    const markerMs = new Date(marker).getTime();
    const issuedAtMs = tokenIssuedAtMs(session.access_token);
    if (!Number.isFinite(markerMs) || issuedAtMs === null || issuedAtMs <= markerMs) return { forced: true, error: null };
  }
  try { await AsyncStorage.setItem(baselineKey(session.user.id), marker); } catch { /* a próxima checagem fará a comparação pelo JWT */ }
  return { forced: false, error: null };
}

export async function recordUserPresence(): Promise<void> {
  try { await (supabase as any).rpc('heartbeat_presence'); } catch { /* heartbeat é best-effort e não bloqueia o app */ }
}
