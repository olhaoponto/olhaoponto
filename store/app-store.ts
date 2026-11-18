import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, TimeEntry } from '../types/app';

export interface AppState {
  session: Session | null;
  sessionInitialized: boolean;
  profile: Profile | null;
  entries: TimeEntry[];
  loading: boolean;
  offline: boolean;
  error: string | null;
  journeyVersion: number;
  pieceNotice: string | null;
  setSession: (session: Session | null) => void;
  setSessionInitialized: (initialized: boolean) => void;
  setProfile: (profile: Profile | null) => void;
  setEntries: (entries: TimeEntry[]) => void;
  mergeEntries: (entries: TimeEntry[]) => void;
  upsertEntry: (entry: TimeEntry) => void;
  removeEntry: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setOffline: (offline: boolean) => void;
  setError: (error: string | null) => void;
  bumpJourney: (notice?: string) => void;
  clearPieceNotice: () => void;
  reset: () => void;
}
const initial = { session: null, sessionInitialized: false, profile: null, entries: [], loading: false, offline: false, error: null, journeyVersion: 0, pieceNotice: null };
export function mergeEntries(current: readonly TimeEntry[], incoming: readonly TimeEntry[]): TimeEntry[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em));
}
export const useAppStore = create<AppState>((set) => ({
  ...initial,
  setSession: (session) => set({ session, sessionInitialized: true }),
  setSessionInitialized: (sessionInitialized) => set({ sessionInitialized }),
  setProfile: (profile) => set({ profile }),
  setEntries: (entries) => set({ entries }),
  mergeEntries: (incoming) => set((state) => ({ entries: mergeEntries(state.entries, incoming) })),
  upsertEntry: (entry) => set((state) => ({ entries: mergeEntries(state.entries, [entry]) })),
  removeEntry: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setOffline: (offline) => set({ offline }),
  setError: (error) => set({ error }),
  bumpJourney: (notice) => set((state) => ({ journeyVersion: state.journeyVersion + 1, pieceNotice: notice ?? state.pieceNotice })),
  clearPieceNotice: () => set({ pieceNotice: null }),
  reset: () => set({ ...initial }),
}));
