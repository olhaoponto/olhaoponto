import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const CHUNK_SIZE = 1500;
const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const countText = await SecureStore.getItemAsync(`${key}:chunks`);
      if (countText) {
        const count = Number(countText);
        if (!Number.isInteger(count) || count < 1 || count > 20) return null;
        const parts = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}:chunk:${index}`)));
        if (parts.every((part) => part !== null)) return parts.join('');
      }
    } catch { /* SecureStore indisponível: tenta migrar a sessão legada */ }
    try {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy) {
        await secureStorage.setItem(key, legacy);
        await AsyncStorage.removeItem(key);
      }
      return legacy;
    } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    const chunks = Array.from({ length: Math.max(1, Math.ceil(value.length / CHUNK_SIZE)) }, (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
    if (chunks.length > 20) throw new Error('Sessão excede o limite de armazenamento seguro.');
    try {
      const previous = Number(await SecureStore.getItemAsync(`${key}:chunks`) || 0);
      await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}:chunk:${index}`, chunk)));
      await SecureStore.setItemAsync(`${key}:chunks`, String(chunks.length));
      for (let index = chunks.length; index < previous; index++) await SecureStore.deleteItemAsync(`${key}:chunk:${index}`);
      await AsyncStorage.removeItem(key).catch(() => undefined);
    } catch {
      // Fallback preserves sign-in in test environments where platform secure storage is unavailable.
      await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      const count = Number(await SecureStore.getItemAsync(`${key}:chunks`) || 0);
      await SecureStore.deleteItemAsync(`${key}:chunks`).catch(() => undefined);
      for (let index = 0; index < Math.min(count, 20); index++) await SecureStore.deleteItemAsync(`${key}:chunk:${index}`).catch(() => undefined);
    } catch { /* ignora SecureStore indisponível */ }
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};

// Native session tokens use SecureStore; the web preview uses browser localStorage.
const authStorage = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.localStorage : undefined)
  : secureStorage;

export const supabase = createClient(
  supabaseUrl || 'https://configuration-required.invalid',
  supabaseAnonKey || 'configuration-required',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);
