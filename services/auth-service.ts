import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types/app';
import { useAppStore } from '../store/app-store';
import { getAuthenticatedSession, SESSION_REQUIRED_MESSAGE } from './auth-session';
import { supabase } from './supabase';

export interface AuthResult<T = void> { data: T | null; error: string | null; }

const friendly = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
  if (/auth session missing|authsessionmissingerror|session missing/i.test(message)) return SESSION_REQUIRED_MESSAGE;
  const known: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User not found': 'Não foi possível localizar uma conta com esse e-mail.',
  };
  return known[message] || message;
};
const profileCacheKey = (id: string) => `olhaponto:${id}:profile`;
async function cacheProfile(profile: Profile): Promise<void> {
  try { await AsyncStorage.setItem(profileCacheKey(profile.id), JSON.stringify(profile)); } catch { /* cache local opcional */ }
}

export async function login(email: string, password: string): Promise<AuthResult<{ user: User; session: Session }>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { data: null, error: friendly(error) };
    if (!data.user || !data.session) return { data: null, error: 'O login não iniciou uma sessão válida. Confira sua conexão e tente novamente.' };
    useAppStore.getState().setSession(data.session);
    return { data: { user: data.user, session: data.session }, error: null };
  } catch (error) {
    return { data: null, error: friendly(error) };
  }
}

export async function logout(): Promise<AuthResult> {
  const { session } = await getAuthenticatedSession();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  useAppStore.getState().setSession(null);
  useAppStore.getState().setProfile(null);
  useAppStore.getState().setEntries([]);
  if (session?.user) await clearLocalUserData(session.user.id);
  return { data: null, error: error ? friendly(error) : null };
}

/** Redirects to olhaponto://auth/reset-password; register this URI in Supabase Auth URL Configuration. */
export async function recoverPassword(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'olhaponto://auth/reset-password' });
    return { data: null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function getProfile(userId?: string): Promise<AuthResult<Profile>> {
  let id = userId;
  if (!id) {
    const auth = await getAuthenticatedSession();
    if (!auth.session) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
    id = auth.session.user.id;
  }
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) {
      const profile = data as Profile;
      await cacheProfile(profile);
      return { data: profile, error: null };
    }
    try {
      const cached = await AsyncStorage.getItem(profileCacheKey(id));
      if (cached) return { data: JSON.parse(cached) as Profile, error: 'offline_cache' };
    } catch { /* cache ausente ou ilegível */ }
    return { data: null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function updateProfile(updates: Partial<Pick<Profile, 'nome' | 'almoco_minutos' | 'limite_minutos' | 'fuso' | 'preferencias_alerta'>>): Promise<AuthResult<Profile>> {
  const auth = await getAuthenticatedSession();
  const user = auth.session?.user;
  if (!user) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  try {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select('*').single();
    if (data) await cacheProfile(data as Profile);
    return { data: data as Profile | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function updateEmail(email: string): Promise<AuthResult> {
  const auth = await getAuthenticatedSession();
  if (!auth.session) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  try {
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    return { data: null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function acceptTerms(version: string): Promise<AuthResult<Profile>> {
  const auth = await getAuthenticatedSession();
  const user = auth.session?.user;
  if (!user) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  try {
    const { data, error } = await supabase.from('profiles').update({
      aceite_termos_em: new Date().toISOString(),
      aceite_termos_versao: version,
    }).eq('id', user.id).select('*').single();
    if (data) await cacheProfile(data as Profile);
    return { data: data as Profile | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export async function changePassword(password: string): Promise<AuthResult> {
  const auth = await getAuthenticatedSession();
  if (!auth.session) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  try {
    const { data, error } = await supabase.auth.updateUser({ password, data: { senha_provisoria: false } });
    if (error) return { data: null, error: friendly(error) };
    // The auth.users metadata trigger mirrors senha_provisoria=false to profiles.
    return { data: null, error: data.user ? null : 'Não foi possível confirmar a atualização da senha.' };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

async function invoke<T = unknown>(functionName: string, body: Record<string, unknown>): Promise<AuthResult<T>> {
  const auth = await getAuthenticatedSession();
  if (!auth.session) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    return { data: data as T | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

export const adminCreateUser = (body: { email: string; nome: string; senhaProvisoria: string }) => invoke<{ user_id: string }>('admin-create-user', body);
export const adminResetPassword = (body: { user_id: string; nova_senha: string }) => invoke('admin-reset-password', body);
export const adminSetUserStatus = (body: { user_id: string; ativo: boolean }) => invoke('admin-set-user-status', body);

export async function deleteAccount(confirmation: string): Promise<AuthResult> {
  if (confirmation !== 'APAGAR') return { data: null, error: 'Digite APAGAR para confirmar a exclusão.' };
  const result = await invoke('delete-account', { confirmacao: confirmation });
  if (!result.error) await logout();
  return { data: null, error: result.error };
}

export async function listProfiles(): Promise<AuthResult<Profile[]>> {
  const auth = await getAuthenticatedSession();
  const user = auth.session?.user;
  if (!user) return { data: null, error: auth.error || SESSION_REQUIRED_MESSAGE };
  const profile = await getProfile(user.id);
  if (profile.error || profile.data?.role !== 'admin' || !profile.data.ativo) return { data: null, error: profile.error || 'Apenas administradores ativos podem consultar perfis.' };
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('nome');
    return { data: data as Profile[] | null, error: error ? friendly(error) : null };
  } catch (error) { return { data: null, error: friendly(error) }; }
}

async function clearLocalUserData(userId: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const userKeys = keys.filter((key) => key.startsWith(`olhaponto:${userId}:`));
  if (userKeys.length) await AsyncStorage.multiRemove(userKeys);
}
