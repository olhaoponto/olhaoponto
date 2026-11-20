import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, SurfaceCard, useAppColors } from '@/components/ui';
import type { AlertPreferences, DayStatusRecord, TimeEntry } from '@/types/app';
import { loadSevenSteps, type SevenStepsState } from '@/services/seven-steps-service';

export function SevenStepsCard({ civilDate, entries, statuses, preferences }: {
  civilDate: string;
  entries: readonly TimeEntry[];
  statuses: readonly (Pick<DayStatusRecord, 'data'> & { status: string })[];
  preferences?: AlertPreferences | null;
}) {
  const router = useRouter();
  const colors = useAppColors();
  const [state, setState] = useState<SevenStepsState | null>(null);

  useEffect(() => {
    let active = true;
    void loadSevenSteps({ civilDate, entries, statuses, preferences }).then((next) => {
      if (active) setState(next);
    });
    return () => { active = false; };
  }, [civilDate, entries, statuses, preferences]);

  const step = Math.min(state?.step ?? 0, 7);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir Sete Passos"
      onPress={() => router.push('/sete-passos')}
    >
      <SurfaceCard style={styles.card}>
        <View style={styles.heading}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="subtitle">Sete Passos</AppText>
            <AppText variant="small" color={colors.muted}>{step}/7 dias</AppText>
          </View>
          <AppText variant="title" color={colors.deepTeal} style={styles.arrow}>›</AppText>
        </View>
        <View style={styles.track} accessibilityLabel={`${step} de 7 dias concluídos`}>
          {Array.from({ length: 7 }, (_, index) => {
            const done = index < step;
            const current = !state?.completed && index === Math.min(step, 6);
            return (
              <View key={index} style={styles.pointWrap}>
                <View style={[styles.point, {
                  backgroundColor: done ? colors.teal : current ? colors.deepTeal : `${colors.muted}55`,
                  borderColor: done || current ? `${colors.teal}CC` : `${colors.muted}88`,
                }]}>
                  {done ? <AppText variant="tiny" color="#FFFFFF" style={styles.bold}>✓</AppText> : null}
                </View>
              </View>
            );
          })}
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, paddingVertical: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { fontSize: 30, lineHeight: 32, fontWeight: '400' },
  track: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 },
  pointWrap: { flex: 1, alignItems: 'center' },
  point: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '800', lineHeight: 13 },
});
