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
const percent = (value: number) => `${value}%` as `${number}%`;

export default function SevenStepsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const [now] = useState(() => new Date());
  const [state, setState] = useState<SevenStepsState | null>(null);
  const [loading, setLoading] = useState(true);
  const jump = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const today = useMemo(() => getBahiaDate(now), [now]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let active = true;
    const start = shiftCivilDate(today, -20);
    const months = [...new Set([start.slice(0, 7), today.slice(0, 7)])];
    void Promise.all([
      Promise.all(months.map((month) => loadEntriesByMonth(`${month}-01`))),
      loadDayStatuses(start, today),
    ]).then(async ([entryResults, statuses]) => {
      const entriesById = new Map<string, TimeEntry>();
      for (const result of entryResults) for (const entry of result.data ?? []) {
        if (entry.data >= start && entry.data <= today) entriesById.set(entry.id, entry);
      }
      const next = await loadSevenSteps({
        civilDate: today,
        entries: [...entriesById.values()],
        statuses: (statuses.data ?? []) as (Pick<DayStatusRecord, 'data'> & { status: string })[],
        preferences: profile.preferencias_alerta,
      });
      if (active) {
        setState(next);
        setLoading(false);
        jump.setValue(0);
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(jump, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(jump, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start();
      }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile, today, jump]);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(ringPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(ringPulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [ringPulse]);

  const step = Math.min(state?.step ?? 0, 7);
  const currentIndex = state?.completed ? 6 : Math.min(step, 6);
  const currentStone = STONES[currentIndex];
  const mascotStyle = {
    left: percent((currentStone.x / SCENE_W) * 100),
    top: percent(((currentStone.y - 8) / SCENE_H) * 100),
    width: percent((58 / SCENE_W) * 100),
    aspectRatio: 1,
    marginLeft: percent(-(58 / SCENE_W) * 50),
    marginTop: percent(-(58 / SCENE_H) * 100),
    transform: [{ translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, -42] }) }],
  };
  const ringStyle = {
    left: percent((currentStone.x / SCENE_W) * 100),
    top: percent(((currentStone.y + 8) / SCENE_H) * 100),
    width: percent((62 / SCENE_W) * 100),
    aspectRatio: 1,
    marginLeft: percent(-(62 / SCENE_W) * 50),
    marginTop: percent(-(62 / SCENE_H) * 50),
    opacity: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] }),
    transform: [{ scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
  };

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
      <View style={styles.sceneWrap} accessibilityLabel="Caminho do Sete Passos no rio">
        <SceneArt step={step} completed={!!state?.completed} />
        {!loading && state && !state.completed ? <Animated.View style={[styles.currentRing, ringStyle]} /> : null}
        {!loading && state ? <Animated.View style={[styles.mascot, mascotStyle]}><Image source={MASCOT} resizeMode="contain" style={styles.mascotImage} accessibilityLabel="Mascote relógio sobre a pedra atual" /></Animated.View> : null}
        {loading ? <View style={styles.loading}><AppText variant="small" color="#FFFFFF">Preparando seu caminho...</AppText></View> : null}
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
