import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { getDailyWelcome, getWelcomeMessageStorageKey, type MascotTheme } from '@/utils/welcome-message';
import { useAppStore } from '@/store/app-store';

const DURATION_MS = 11500;
const mascotImages: Record<MascotTheme, number> = {
  base: require('../assets/images/mascot/clock-base.png'),
  christmas: require('../assets/images/mascot/clock-christmas.png'),
  newyear: require('../assets/images/mascot/clock-newyear.png'),
  carnival: require('../assets/images/mascot/clock-carnival.png'),
  junina: require('../assets/images/mascot/clock-junina.png'),
};

export function WelcomeSplash({ onContinue }: { onContinue: () => void }) {
  const colors = useAppColors();
  const sessionUserId = useAppStore((state) => state.session?.user.id ?? null);
  const profile = useAppStore((state) => state.profile);
  const userId = profile?.ativo === true && profile.id === sessionUserId ? sessionUserId : null;
  const openedAt = useMemo(() => new Date(), []);
  const [welcome, setWelcome] = useState(() => getDailyWelcome(openedAt));
  const [progress] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));
  const completed = useRef(false);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    let active = true;
    const loadWelcome = async () => {
      let previousMessage: string | null = null;
      const storageKey = userId ? getWelcomeMessageStorageKey(userId) : null;
      if (storageKey) {
        try { previousMessage = await AsyncStorage.getItem(storageKey); } catch { previousMessage = null; }
      }
      if (!active) return;
      const nextWelcome = getDailyWelcome(openedAt, { previousMessage });
      setWelcome(nextWelcome);
      if (storageKey) {
        try { await AsyncStorage.setItem(storageKey, nextWelcome.message); } catch { /* opening must remain usable */ }
      }
    };
    void loadWelcome();
    return () => { active = false; };
  }, [openedAt, userId]);

  useEffect(() => {
    const progressAnimation = Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: false });
    const floatAnimation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1700, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1700, useNativeDriver: true }),
    ]));
    const glowAnimation = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ]));
    progressAnimation.start(({ finished }) => { if (finished) finish(); });
    floatAnimation.start();
    glowAnimation.start();
    return () => { progressAnimation.stop(); floatAnimation.stop(); glowAnimation.stop(); };
  }, [finish, float, glow, progress]);

  const mascotLift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.42] });

  return (
    <ScreenShell scroll={false} edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.page}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.brandLockup}>
            <View style={[styles.brandMark, { backgroundColor: colors.deepTeal }]}><MaterialCommunityIcons name="clock-check-outline" size={19} color="#FFFFFF" /></View>
            <View><AppText variant="tiny" color={colors.deepTeal} style={styles.brandKicker}>OLHA O PONTO</AppText><AppText variant="small" style={styles.brandPromise}>Seu tempo, com mais cuidado.</AppText></View>
          </View>
          <View style={[styles.livePill, { backgroundColor: `${colors.yellow}30` }]}><View style={[styles.liveDot, { backgroundColor: colors.yellow }]} /><AppText variant="tiny" color={colors.deepTeal}>PREPARANDO</AppText></View>
        </View>

        <View style={styles.hero}>
          <Animated.View style={[styles.orbit, { borderColor: `${colors.teal}35`, transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
          <View style={[styles.sun, { backgroundColor: `${colors.yellow}30` }]} />
          <Animated.View style={[styles.mascotFrame, { backgroundColor: `${colors.teal}12`, borderColor: `${colors.teal}35`, transform: [{ translateY: mascotLift }] }]}>
            <Image source={mascotImages[welcome.theme]} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Mascote relógio do Olha o Ponto" style={styles.mascot} />
          </Animated.View>
          <View style={[styles.heroCaption, { backgroundColor: colors.card, borderColor: colors.border }]}><MaterialCommunityIcons name="star-four-points-outline" size={15} color={colors.coral} /><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800' }}>UMA PAUSA PARA COMEÇAR BEM</AppText></View>
        </View>

        <View style={styles.titleBlock}><AppText variant="title" style={styles.title}>{welcome.greeting}</AppText><AppText variant="small" color={colors.muted} style={styles.subtitle}>O relógio já está cuidando do seu próximo passo.</AppText></View>

        <SurfaceCard style={[styles.messageCard, { borderColor: `${colors.teal}45` }]}>
          <View style={styles.messageHeading}><View style={[styles.quoteMark, { backgroundColor: `${colors.coral}20` }]}><MaterialCommunityIcons name="format-quote-open" size={21} color={colors.coral} /></View><View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={styles.seasonLabel}>{welcome.seasonLabel}</AppText><AppText variant="tiny" color={colors.muted}>Recado do mascote para hoje</AppText></View><MaterialCommunityIcons name="clock-time-four-outline" size={21} color={colors.teal} /></View>
          <AppText variant="subtitle" style={styles.message}>{welcome.message}</AppText>
          <View style={styles.progressHeader}><AppText variant="tiny" color={colors.muted}>Abrindo sua jornada</AppText><AppText variant="tiny" color={colors.deepTeal}>já já</AppText></View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]} accessibilityLabel="Abertura do aplicativo" accessibilityRole="progressbar"><Animated.View style={[styles.progressFill, { backgroundColor: colors.teal, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>
          <View style={styles.steps}><View style={[styles.step, { backgroundColor: colors.teal }]} /><View style={[styles.step, { backgroundColor: `${colors.teal}70` }]} /><View style={[styles.step, { backgroundColor: `${colors.teal}35` }]} /><View style={[styles.step, { backgroundColor: `${colors.teal}20` }]} /></View>
          <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Continuar para Hoje" style={[styles.continueButton, { backgroundColor: colors.deepTeal }]}><AppText variant="small" color="#FFFFFF" style={{ fontWeight: '800' }}>Entrar em Hoje agora</AppText><MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" /></Pressable>
        </SurfaceCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', paddingTop: 18, paddingBottom: 20 },
  content: { width: '100%', alignItems: 'center', gap: 13 },
  topBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandKicker: { letterSpacing: 1.6, fontWeight: '800' },
  brandPromise: { fontSize: 11 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  hero: { width: '100%', height: 250, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  orbit: { position: 'absolute', width: 245, height: 245, borderRadius: 80, borderWidth: 2, transform: [{ rotate: '-8deg' }] },
  sun: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  mascotFrame: { width: 208, height: 208, borderRadius: 62, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mascot: { width: '94%', height: '94%' },
  heroCaption: { position: 'absolute', bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  titleBlock: { alignItems: 'center', gap: 2 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  messageCard: { width: '100%', gap: 11, padding: 16, borderWidth: 1 },
  messageHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  quoteMark: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  seasonLabel: { letterSpacing: 1.1, fontWeight: '800' },
  message: { textAlign: 'left', lineHeight: 27 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { alignSelf: 'stretch', height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  steps: { flexDirection: 'row', gap: 5 },
  step: { flex: 1, height: 4, borderRadius: 999 },
  continueButton: { minHeight: 46, borderRadius: 15, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
