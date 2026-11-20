import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ActionButton, AppText, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { loadEntriesByMonth } from '@/services/time-entry-service';
import { loadDayStatuses } from '@/services/day-status-service';
import { loadSevenSteps, type SevenStepsState } from '@/services/seven-steps-service';
import { getBahiaDate } from '@/utils/work-time';
import type { DayStatusRecord, TimeEntry } from '@/types/app';

const shiftCivilDate = (civilDate: string, amount: number) => {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
};
const MASCOT = require('../assets/images/mascot/clock-base.png');
const STONES = [
  { x: 180, y: 605 }, { x: 105, y: 530 }, { x: 245, y: 450 }, { x: 145, y: 370 },
  { x: 260, y: 285 }, { x: 125, y: 205 }, { x: 205, y: 130 },
];

export default function SevenStepsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const [now] = useState(() => new Date());
  const [state, setState] = useState<SevenStepsState | null>(null);
  const [loading, setLoading] = useState(true);
  const jump = useRef(new Animated.Value(0)).current;
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

  const step = Math.min(state?.step ?? 0, 7);
  const currentIndex = state?.completed ? 6 : Math.min(step, 6);
  const currentStone = STONES[currentIndex];
  const mascotSize = 58;
  const mascotStyle = {
    left: currentStone.x - mascotSize / 2,
    top: currentStone.y - mascotSize - 10,
    transform: [{ translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, -42] }) }],
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
        <Svg width="100%" height={700} viewBox="0 0 360 700">
          <Defs>
            <LinearGradient id="river" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#79E4D2" /><Stop offset="0.52" stopColor="#23B9BA" /><Stop offset="1" stopColor="#087C9A" /></LinearGradient>
            <LinearGradient id="shore" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#B9E8B6" /><Stop offset="1" stopColor="#4A9A73" /></LinearGradient>
            <LinearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#8BE0A4" /><Stop offset="1" stopColor="#208B72" /></LinearGradient>
          </Defs>
          <Rect width="360" height="700" fill="url(#river)" />
          <Path d="M0 0 C78 60 42 125 0 172 M360 0 C286 70 323 145 360 204 M0 700 C74 626 39 562 0 520 M360 700 C289 631 327 566 360 515" stroke="url(#shore)" strokeWidth="28" fill="none" opacity="0.95" />
          <G opacity="0.25" fill="none" stroke="#E8FFFF" strokeWidth="3">
            <Path d="M34 115 C73 98 108 132 140 115 S211 97 248 115 S311 130 340 112" /><Path d="M20 250 C64 231 91 263 131 248 S211 229 250 250 S308 264 349 245" /><Path d="M18 445 C58 426 102 465 143 445 S218 426 258 446 S312 459 348 440" /><Path d="M20 570 C67 550 94 585 140 568 S217 550 261 571 S317 582 350 563" />
          </G>
          <G opacity="0.35" fill="#D5FFFF"><Ellipse cx="65" cy="183" rx="35" ry="7" /><Ellipse cx="295" cy="337" rx="42" ry="8" /><Ellipse cx="64" cy="505" rx="26" ry="6" /><Ellipse cx="287" cy="600" rx="34" ry="7" /></G>
          <G stroke="#286E47" strokeWidth="7" strokeLinecap="round" opacity="0.9"><Path d="M10 40 L24 145 M28 48 L10 92 M347 34 L332 150 M330 58 L351 105 M12 640 L28 550 M348 650 L330 548" /></G>
          <G fill="url(#stone)" stroke="#176B60" strokeWidth="3">
            {STONES.map((stone, index) => <G key={index}><Circle cx={stone.x} cy={stone.y} r="27" /><Ellipse cx={stone.x} cy={stone.y - 12} rx="22" ry="9" fill="#D4E8B2" stroke="#8BAE7E" strokeWidth="2" /><Path d={`M${stone.x - 19} ${stone.y - 3} Q${stone.x} ${stone.y + 10} ${stone.x + 19} ${stone.y - 3}`} fill="none" stroke="#B6D38F" strokeWidth="2" /></G>)}
          </G>
          <G transform="translate(128 28)"><Rect width="104" height="60" rx="18" fill="#9B5C3D" stroke="#F4D28C" strokeWidth="4" /><Rect x="10" y="-10" width="84" height="24" rx="12" fill="#F4D28C" /><Path d="M18 31 L87 31 M24 42 L79 42" stroke="#F8E7B2" strokeWidth="3" /><Circle cx="52" cy="23" r="8" fill="#D97B54" /></G>
        </Svg>
        {!loading && state ? <Animated.View style={[styles.mascot, mascotStyle]}><Image source={MASCOT} resizeMode="contain" style={{ width: mascotSize, height: mascotSize }} accessibilityLabel="Mascote relógio sobre a pedra atual" /></Animated.View> : null}
        <View style={styles.rewardLabel}><AppText variant="tiny" color="#FFFFFF" style={styles.rewardText}>Grande recompensa: peça bônus</AppText></View>
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
  sceneWrap: { height: 700, width: '100%', maxWidth: 540, alignSelf: 'center', overflow: 'hidden', borderRadius: 28, position: 'relative' },
  mascot: { position: 'absolute', width: 58, height: 58 },
  rewardLabel: { position: 'absolute', top: 96, alignSelf: 'center', backgroundColor: '#6B3E35DD', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 14 },
  rewardText: { fontWeight: '700' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087C9A55' },
  message: { gap: 5, borderRadius: 18 },
  gentle: { textAlign: 'center', paddingHorizontal: 12 },
});
