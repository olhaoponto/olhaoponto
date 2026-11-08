import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { getDailyWelcome, type MascotTheme } from '@/utils/welcome-message';

const DURATION_MS = 6500;
const mascotImages: Record<MascotTheme, number> = {
  base: require('../assets/images/mascot/clock-base.png'),
  christmas: require('../assets/images/mascot/clock-christmas.png'),
  newyear: require('../assets/images/mascot/clock-newyear.png'),
  carnival: require('../assets/images/mascot/clock-carnival.png'),
  junina: require('../assets/images/mascot/clock-junina.png'),
};

export function WelcomeSplash({ onContinue }: { onContinue: () => void }) {
  const colors = useAppColors();
  const welcome = useMemo(() => getDailyWelcome(new Date()), []);
  const [progress] = useState(() => new Animated.Value(0));
  const completed = useRef(false);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) finish(); });
    return () => animation.stop();
  }, [finish, progress]);

  return (
    <ScreenShell scroll={false} edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.page}>
      <View style={styles.content}>
        <View style={styles.brand}>
          <AppText variant="tiny" color={colors.deepTeal} style={styles.brandLabel}>OLHA O PONTO</AppText>
          <AppText variant="title" style={styles.brandTitle}>{welcome.greeting}</AppText>
          <AppText variant="small" color={colors.muted} style={styles.brandSubtitle}>Que bom ter você por aqui.</AppText>
        </View>

        <View style={[styles.mascotFrame, { backgroundColor: `${colors.teal}10`, borderColor: colors.border }]}>
          <Image
            source={mascotImages[welcome.theme]}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Mascote relógio do Olha o Ponto"
            style={styles.mascot}
          />
        </View>

        <SurfaceCard style={styles.messageCard}>
          <AppText variant="tiny" color={colors.deepTeal} style={styles.seasonLabel}>{welcome.seasonLabel}</AppText>
          <AppText variant="subtitle" style={styles.message}>{welcome.message}</AppText>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]} accessibilityLabel="Abertura do aplicativo" accessibilityRole="progressbar">
            <Animated.View style={[styles.progressFill, { backgroundColor: colors.teal, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <AppText variant="tiny" color={colors.muted} style={styles.autoClose}>Abrindo sua jornada…</AppText>
          <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Continuar para Hoje" style={styles.continueButton}>
            <AppText variant="small" color={colors.deepTeal} style={{ fontWeight: '700' }}>Ir para Hoje agora</AppText>
          </Pressable>
        </SurfaceCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', paddingTop: 20, paddingBottom: 22, gap: 14 },
  content: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 12 },
  brand: { alignItems: 'center', gap: 2 },
  brandLabel: { letterSpacing: 1.8, fontWeight: '700' },
  brandTitle: { textAlign: 'center' },
  brandSubtitle: { textAlign: 'center' },
  mascotFrame: { width: 258, height: 258, maxWidth: '78%', borderRadius: 130, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mascot: { width: '94%', height: '94%' },
  messageCard: { width: '100%', alignItems: 'center', gap: 11, paddingTop: 19, paddingBottom: 14 },
  seasonLabel: { letterSpacing: 1.2, fontWeight: '700', textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 500, lineHeight: 26 },
  progressTrack: { alignSelf: 'stretch', height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 3 },
  progressFill: { height: '100%', borderRadius: 999 },
  autoClose: { textAlign: 'center' },
  continueButton: { minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
