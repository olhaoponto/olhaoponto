import AsyncStorage from '@react-native-async-storage/async-storage';

export type MissionEvent = 'help_colleague' | 'review_mirror' | 'complete_day';
const keyFor = (userId: string, week: string) => `olhaponto:${userId}:mission-events:${week}`;
function weekStart(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  return new Date(Date.UTC(year, month - 1, day - mondayOffset, 12)).toISOString().slice(0, 10);
}

export async function recordMissionEvent(userId: string, week: string, event: MissionEvent): Promise<void> {
  const key = keyFor(userId, weekStart(week));
  try {
    const current = JSON.parse((await AsyncStorage.getItem(key)) || '[]') as string[];
    if (!current.includes(event)) await AsyncStorage.setItem(key, JSON.stringify([...current, event]));
  } catch { /* progresso local não pode bloquear a tarefa principal */ }
}

export async function loadMissionEvents(userId: string, week: string): Promise<MissionEvent[]> {
  try {
    const value = JSON.parse((await AsyncStorage.getItem(keyFor(userId, weekStart(week)))) || '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is MissionEvent => item === 'help_colleague' || item === 'review_mirror' || item === 'complete_day') : [];
  } catch { return []; }
}
