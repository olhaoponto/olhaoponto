import { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, AppText, ScreenShell } from '@/components/ui';
import { WeeklyMissionCard } from '@/components/WeeklyMissionCard';
import { RankingPodium } from '@/components/RankingPodium';
import { useAppStore } from '@/store/app-store';
import { loadEntriesForCompleteHistory } from '@/services/time-entry-service';
import { loadDayStatuses } from '@/services/day-status-service';
import { getBahiaDate } from '@/utils/work-time';
import { getWeekDateRange } from '@/utils/day-status';
import { getWeeklyMissionSummary } from '@/utils/weekly-mission';
import type { DayStatusRecord, TimeEntry } from '@/types/app';

export default function JourneyScreen() {
  const router = useRouter();
  const session = useAppStore((state) => state.session);
  const profile = useAppStore((state) => state.profile);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [statuses, setStatuses] = useState<DayStatusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const today = getBahiaDate(new Date());
  const weekRange = getWeekDateRange(today);
  useEffect(() => {
    let active = true;
    if (!session?.user.id) { setLoading(false); return () => { active = false; }; }
    void Promise.all([loadEntriesForCompleteHistory(), loadDayStatuses(weekRange.startDate, weekRange.endDate)]).then(([entryResult, statusResult]) => {
      if (!active) return;
      setEntries(entryResult.data ?? []);
      setStatuses(statusResult.data ?? []);
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.user.id, weekRange.startDate, weekRange.endDate]);
  const summary = useMemo(() => getWeeklyMissionSummary(today, entries, statuses, profile?.preferencias_alerta, profile?.almoco_minutos ?? 60), [today, entries, statuses, profile?.preferencias_alerta, profile?.almoco_minutos]);
  return <ScreenShell contentStyle={{ gap: 16, paddingTop: 18 }}>
    <ActionButton title="Voltar para Hoje" variant="ghost" onPress={() => router.back()} icon={<MaterialCommunityIcons name="arrow-left" size={19} color="#0B6A63" />} />
    <AppText variant="title">Sua jornada</AppText>
    <AppText variant="small" color="#607875">O mapa e o quebra-cabeça ficam aqui para a Home continuar rápida e focada no registro do ponto.</AppText>
    {loading ? <AppText variant="small" color="#607875">Carregando seu caminho…</AppText> : <><WeeklyMissionCard summary={summary} onOpenMirror={() => router.push('/(tabs)/espelho')} /><RankingPodium /></>}
  </ScreenShell>;
}
