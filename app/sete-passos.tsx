import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, AppText, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { loadEntriesByMonth } from '@/services/time-entry-service';
import { loadDayStatuses } from '@/services/day-status-service';
import { loadSevenSteps, type SevenStepsState } from '@/services/seven-steps-service';
import { getBahiaDate } from '@/utils/work-time';
import type { DayStatusRecord, TimeEntry } from '@/types/app';
import { SCENE_H, SCENE_W, STONES, SceneArt } from '@/components/SevenStepsArt';

const shiftCivilDate = (civilDate: string, amount: number) => {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
};
const MASCOT = require('../assets/images/mascot/clock-base.png');

export default function SevenStepsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const [now] = useState(() => new Date());
  const [state, setState] = useState<SevenStepsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sceneW, setSceneW] = useState(0);
  const jump = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const today = useMemo(() => getBahiaDate(now), [now]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let active = true;
    const start = shiftCivilDate(today, -20);
    const months = [...new Set([start.slice(0, 7), today.slice(0, 7)])];
    let cachedEntries: TimeEntry[] = [];
    let cachedStatuses: DayStatusRecord[] = [];
    const updateState = async () => {
      const entriesById = new Map<string, TimeEntry>();
      for (const entry of cachedEntries) {
        if (entry.data >= start && entry.data <= today) entriesById.set(entry.id, entry);
      }
      const next = await loadSevenSteps({
        civilDate: today,
        entries: [...entriesById.values()],
        statuses: cachedStatuses as (Pick<DayStatusRecord, 'data'> & { status: string })[],
        preferences: profile.preferencias_alerta,
      });
      if (active) {
        setState(next);
        setLoading(false);
      }
    };
    void Promise.all([
      Promise.all(months.map((month) => loadEntriesByMonth(`${month}-01`, {
        onCached: (cached) => { cachedEntries = [...cachedEntries.filter((entry) => !cached.some((item) => item.id === entry.id)), ...cached]; void updateState(); },
      }))).then((results) => { cachedEntries = results.flatMap((result) => result.data ?? []); return updateState(); }),
      loadDayStatuses(start, today, { onCached: (cached) => { cachedStatuses = cached; void updateState(); } }).then((result) => { cachedStatuses = result.data ?? cachedStatuses; return updateState(); }),
    ]).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile, today]);

  const step = Math.min(state?.step ?? 0, 7);
  const currentIndex = state?.completed ? 6 : Math.min(step, 6);
  const currentStone = STONES[currentIndex];

  useEffect(() => {
    jump.setValue(0);
    if (loading || !state) return undefined;
    const animation = Animated.sequence([
      Animated.delay(80),
      Animated.timing(jump, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(jump, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [currentIndex, loading, state?.completed, jump]);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(ringPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(ringPulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [ringPulse]);

  const scale = sceneW / SCENE_W;
  const mascotSize = 58 * scale;
  const ringSize = 62 * scale;
  const mascotStyle = sceneW > 0 ? {
    left: currentStone.x * scale - mascotSize / 2,
    top: (currentStone.y - 8) * scale - mascotSize,
    width: mascotSize,
    height: mascotSize,
    transform: [{ translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, -42 * scale] }) }],
  } : null;
  const ringStyle = sceneW > 0 ? {
    left: currentStone.x * scale - ringSize / 2,
    top: (currentStone.y + 8) * scale - ringSize / 2,
    width: ringSize,
    height: ringSize,
    opacity: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] }),
    transform: [{ scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
  } : null;

  return (
    <ScreenShell contentStyle={styles.content}>
      <ActionButton title="Voltar" variant="ghost" onPress={() => router.back()} style={styles.back} />
      <SurfaceCard style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="title">Sete Passos</AppText>
            <AppText variant="small" color={colors.muted}>Complete 7 dias seguidos para ganhar o desafio</AppText>
          </View>
          <View style={styles.stats}><AppText variant="small" color={colors.deepTeal}>Dias {step}/7</AppText><AppText variant="small" color={colors.muted}>Ciclos {state?.totalCycles ?? 0}</AppText></View>
        </View>
      </SurfaceCard>
      <View onLayout={({ nativeEvent }) => setSceneW(nativeEvent.layout.width)} style={styles.sceneWrap} accessibilityLabel="Caminho do Sete Passos no rio">
        <SceneArt step={step} completed={!!state?.completed} />
        {!state?.completed && ringStyle ? <Animated.View style={[styles.currentRing, ringStyle]} /> : null}
        {mascotStyle ? <Animated.View style={[styles.mascot, mascotStyle]}><Image source={MASCOT} resizeMode="contain" style={styles.mascotImage} accessibilityLabel="Mascote relógio sobre a pedra atual" /></Animated.View> : null}
      </View>
      {state?.completed ? <SurfaceCard tone="soft" style={styles.message}><AppText variant="subtitle" color={colors.deepTeal}>Parabéns, você chegou ao fim!</AppText><AppText variant="small" color={colors.muted}>Seu desafio foi concluído e uma peça bônus foi adicionada à jornada.</AppText></SurfaceCard> : <AppText variant="small" color={colors.muted} style={styles.gentle}>Cada dia resolvido conta um passo. Vá no seu ritmo.</AppText>}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 24 },
  back: { alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 8 },
  header: { gap: 12, borderRadius: 22, padding: 16 },
  headerTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stats: { alignItems: 'flex-end', gap: 5 },
  sceneWrap: { width: '100%', maxWidth: 420, alignSelf: 'center', aspectRatio: SCENE_W / SCENE_H, borderRadius: 28, overflow: 'hidden', position: 'relative' },
  mascot: { position: 'absolute' },
  mascotImage: { width: '100%', height: '100%' },
  currentRing: { position: 'absolute', borderWidth: 3, borderColor: '#F7C948', borderRadius: 999 },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087C9A55' },
  message: { gap: 5, borderRadius: 18 },
  gentle: { textAlign: 'center', paddingHorizontal: 12 },
});
