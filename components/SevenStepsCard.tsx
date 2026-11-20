import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { AppText, SurfaceCard, useAppColors } from '@/components/ui';
import type { AlertPreferences, DayStatusRecord, TimeEntry } from '@/types/app';
import { loadSevenSteps, type SevenStepsState } from '@/services/seven-steps-service';

export function SevenStepsCard({ civilDate, entries, statuses, preferences }: {
  civilDate: string;
  entries: readonly TimeEntry[];
  statuses: readonly (Pick<DayStatusRecord, 'data'> & { status: string })[];
  preferences?: AlertPreferences | null;
}) {
  const colors = useAppColors();
  const [state, setState] = useState<SevenStepsState | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void loadSevenSteps({ civilDate, entries, statuses, preferences }).then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [civilDate, entries, statuses, preferences]);

  useEffect(() => {
    if (!state || state.completed) { pulse.stopAnimation(); pulse.setValue(0); return undefined; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, state?.completed]);

  const step = state?.step ?? 0;
  const currentStone = state?.completed ? -1 : Math.min(step, 6);
  return <SurfaceCard style={styles.card}>
    <View style={styles.heading}>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="subtitle">Sete Passos</AppText>
        <AppText variant="small" color={colors.muted}>Uma sequência gentil de dias resolvidos.</AppText>
      </View>
      <AppText variant="small" color={colors.deepTeal} style={styles.bold}>{Math.min(step, 7)}/7 passos</AppText>
    </View>
    <View style={styles.path} accessibilityLabel={`${Math.min(step, 7)} de 7 passos concluídos`}>
      {Array.from({ length: 7 }, (_, index) => {
        const done = index < step;
        const current = index === currentStone;
        return <View key={index} style={[styles.stoneSlot, { transform: [{ translateX: index % 2 === 0 ? -7 : 7 }] }]}>
          <Animated.View style={[styles.stone, {
            backgroundColor: done ? colors.teal : current ? colors.deepTeal : `${colors.muted}55`,
            borderColor: done || current ? `${colors.teal}CC` : `${colors.muted}88`,
            opacity: current ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) : done ? 1 : 0.62,
            transform: current ? [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] : undefined,
          }]}>
            <AppText variant="tiny" color={done || current ? '#FFFFFF' : colors.muted} style={styles.bold}>{index + 1}</AppText>
          </Animated.View>
        </View>;
      })}
    </View>
    {state?.completed ? <AppText variant="small" color={colors.deepTeal}>Parabéns! Você completou 7 passos e ganhou 1 peça bônus.</AppText> : state && step === 0 ? <AppText variant="small" color={colors.muted}>Recomece hoje, um passo de cada vez.</AppText> : <AppText variant="small" color={colors.muted}>Continue no seu ritmo: cada dia resolvido conta um passo.</AppText>}
  </SurfaceCard>;
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  path: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', minHeight: 82, paddingHorizontal: 8 },
  stoneSlot: { width: '25%', minWidth: 42, alignItems: 'center', marginVertical: 4 },
  stone: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '800' },
});
