import { memo, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { loadStreak, markStreakMilestones, type StreakResult } from '@/services/streak-service';
import { getBahiaDate } from '@/utils/work-time';

export const StreakBadge = memo(function StreakBadge({ compact = false }: { compact?: boolean }) {
  const colors = useAppColors();
  const profileId = useAppStore((state) => state.profile?.id);
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [milestone, setMilestone] = useState<number | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const today = getBahiaDate(new Date());

  useEffect(() => {
    if (!profileId) { setStreak(null); return undefined; }
    let active = true;
    void loadStreak(today).then(async (result) => {
      if (!active || !result) return;
      setStreak(result);
      const reached = await markStreakMilestones(result.atual);
      if (active) setMilestone(reached);
    }).catch(() => { if (active) setStreak(null); });
    return () => { active = false; };
  }, [profileId, today]);

  useEffect(() => {
    if (!streak?.emRisco) { pulse.setValue(0); return undefined; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, streak?.emRisco]);

  if (!streak) return null;
  const atRiskColor = colors.warning;
  const iconColor = streak.atual === 0 ? colors.muted : streak.emRisco ? atRiskColor : colors.coral;
  return (
    <View style={[styles.container, compact && styles.compact, streak.atual === 0 ? styles.empty : streak.emRisco ? styles.risk : null]} accessibilityLabel={`Sequência de ${streak.atual} dias. Recorde: ${streak.recorde}${streak.emRisco ? '. Bata o ponto para manter sua sequência' : ''}`}>
      <Animated.View style={{ opacity: streak.emRisco ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) : 1 }}>
        <MaterialCommunityIcons name="fire" size={compact ? 18 : 20} color={iconColor} />
      </Animated.View>
      <View style={styles.copy}>
        <View style={styles.row}><AppText variant="small" color={iconColor} style={{ fontWeight: '700' }}>{streak.atual} {streak.atual === 1 ? 'dia' : 'dias'}</AppText><AppText variant="tiny" color={colors.muted}>Recorde: {streak.recorde}</AppText></View>
        {streak.emRisco ? <AppText variant="tiny" color={atRiskColor}>Bata o ponto para manter sua sequência</AppText> : null}
        {milestone ? <AppText variant="tiny" color={colors.deepTeal}>Parabéns! Marco de {milestone} dias alcançado.</AppText> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#EF796714', width: '100%' },
  compact: { alignSelf: 'center', maxWidth: 440, paddingVertical: 7 },
  empty: { backgroundColor: '#8A989514' },
  risk: { backgroundColor: '#F2C64824' },
  copy: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
});
