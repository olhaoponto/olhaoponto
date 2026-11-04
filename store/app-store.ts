import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, TimeEntry } from '../types/app';

export interface AppState {
  session: Session | null;
  profile: Profile | null;
  entries: TimeEntry[];
  loading: boolean;
  offline: boolean;
  error: string | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setEntries: (entries: TimeEntry[]) => void;
  upsertEntry: (entry: TimeEntry) => void;
  removeEntry: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setOffline: (offline: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
const initial = { session: null, profile: null, entries: [], loading: false, offline: false, error: null };
export const useAppStore = create<AppState>((set) => ({
  ...initial,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setEntries: (entries) => set({ entries }),
  upsertEntry: (entry) => set((state) => ({ entries: [...state.entries.filter((row) => row.id !== entry.id), entry] })),
  removeEntry: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setOffline: (offline) => set({ offline }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initial }),
}));
