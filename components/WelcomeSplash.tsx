import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, ScreenShell, useAppColors } from '@/components/ui';
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
  const sceneIndex = welcome.message.length % 4;
  const sceneIcons = ['target-account', 'coffee-outline', 'home-heart', 'account-heart-outline'] as const;
  const sceneLabels = ['FOCO COM LEVEZA', 'PAUSA TAMBÉM É META', 'CAMINHO PARA O DESCANSO', 'BOA PRÁTICA EM EQUIPE'];
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
        try { await AsyncStorage.setItem(storageKey, nextWelcome.message); } catch { /* opening remains usable */ }
      }
    };
    void loadWelcome();
    return () => { active = false; };
  }, [openedAt, userId]);

  useEffect(() => {
    const progressAnimation = Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: false });
    const floatAnimation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    const glowAnimation = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1700, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1700, useNativeDriver: true }),
    ]));
    progressAnimation.start(({ finished }) => { if (finished) finish(); });
    floatAnimation.start();
    glowAnimation.start();
    return () => { progressAnimation.stop(); floatAnimation.stop(); glowAnimation.stop(); };
  }, [finish, float, glow, progress]);

  const mascotLift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const mascotScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const haloOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] });

  return (
    <ScreenShell scroll={false} edges={['top', 'bottom', 'left', 'right']} contentStyle={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.stage, { backgroundColor: sceneIndex === 0 ? `${colors.teal}0B` : sceneIndex === 1 ? `${colors.yellow}12` : sceneIndex === 2 ? `${colors.coral}0B` : `${colors.deepTeal}0A` }]}>
        <View style={styles.decorLayer} pointerEvents="none">
          <View style={[styles.cornerOrb, styles.orbTop, { backgroundColor: `${colors.yellow}18` }]} />
          <View style={[styles.cornerOrb, styles.orbBottom, { backgroundColor: `${colors.coral}13` }]} />
          <View style={[styles.routeLine, { borderColor: `${colors.teal}28` }]} />
          <View style={[styles.routeDot, styles.dotOne, { backgroundColor: colors.yellow }]} />
          <View style={[styles.routeDot, styles.dotTwo, { backgroundColor: colors.coral }]} />
          <View style={[styles.routeDot, styles.dotThree, { backgroundColor: colors.teal }]} />
        </View>

        <View style={styles.topBar}>
          <View style={styles.brandLockup}>
            <View style={[styles.brandMark, { backgroundColor: colors.deepTeal }]}><MaterialCommunityIcons name="clock-check-outline" size={19} color="#FFFFFF" /></View>
            <View><AppText variant="tiny" color={colors.deepTeal} style={styles.brandKicker}>OLHA O PONTO</AppText><AppText variant="small" style={styles.brandPromise}>Seu tempo, com mais cuidado.</AppText></View>
          </View>
          <View style={[styles.livePill, { backgroundColor: `${colors.yellow}30` }]}><View style={[styles.liveDot, { backgroundColor: colors.yellow }]} /><AppText variant="tiny" color={colors.deepTeal}>ABRINDO</AppText></View>
        </View>

        <View style={styles.hero}>
          <Animated.View style={[styles.haloOuter, { borderColor: `${colors.teal}30`, transform: [{ scale: haloScale }], opacity: haloOpacity }]} />
          <View style={[styles.haloInner, { borderColor: `${colors.yellow}38`, backgroundColor: `${colors.yellow}10` }]} />
          <Animated.View style={{ transform: [{ translateY: mascotLift }, { scale: mascotScale }, { rotate: sceneIndex === 1 ? '-2deg' : sceneIndex === 2 ? '2deg' : '0deg' }] }}>
            <Image source={mascotImages[welcome.mascotTheme]} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Mascote relógio do Olha o Ponto" style={styles.mascot} />
          </Animated.View>
          <View style={[styles.heroTag, { backgroundColor: colors.deepTeal }]}><MaterialCommunityIcons name={sceneIcons[sceneIndex]} size={14} color={colors.yellow} /><AppText variant="tiny" color="#FFFFFF" style={{ fontWeight: '800' }}>{sceneLabels[sceneIndex]}</AppText></View>
        </View>

        <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: `${colors.teal}35` }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.messageHeader}><View style={[styles.quoteMark, { backgroundColor: `${colors.coral}18` }]}><MaterialCommunityIcons name="format-quote-open" size={22} color={colors.coral} /></View><View style={{ flex: 1, gap: 2 }}><AppText variant="tiny" color={colors.deepTeal} style={styles.seasonLabel}>{welcome.seasonLabel}</AppText><AppText variant="tiny" color={colors.muted}>Um recado do mascote para o seu dia</AppText></View><MaterialCommunityIcons name="clock-time-four-outline" size={22} color={colors.teal} /></View>
          <AppText variant="subtitle" style={styles.message}>{welcome.message}</AppText>
          <View style={styles.progressHeader}><AppText variant="tiny" color={colors.muted}>Preparando sua jornada</AppText><AppText variant="tiny" color={colors.deepTeal} style={{ fontWeight: '800' }}>agora</AppText></View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]} accessibilityLabel="Abertura do aplicativo" accessibilityRole="progressbar"><Animated.View style={[styles.progressFill, { backgroundColor: colors.teal, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>
          <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Continuar para Hoje" style={[styles.continueButton, { backgroundColor: colors.deepTeal }]}><AppText variant="small" color="#FFFFFF" style={{ fontWeight: '800' }}>Entrar em Hoje agora</AppText><MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" /></Pressable>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingVertical: 0 },
  stage: { flex: 1, width: '100%', minHeight: '100%', overflow: 'hidden' },
  decorLayer: { ...StyleSheet.absoluteFill },
  cornerOrb: { position: 'absolute', width: 230, height: 230, borderRadius: 115 },
  orbTop: { top: -130, right: -65 },
  orbBottom: { bottom: 180, left: -145 },
  routeLine: { position: 'absolute', width: 280, height: 480, borderWidth: 2, borderStyle: 'dashed', borderRadius: 140, right: -180, top: 50, transform: [{ rotate: '18deg' }] },
  routeDot: { position: 'absolute', width: 11, height: 11, borderRadius: 6 },
  dotOne: { right: 35, top: 175 },
  dotTwo: { left: 30, top: 275 },
  dotThree: { right: 65, bottom: 245 },
  topBar: { paddingHorizontal: 22, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandKicker: { letterSpacing: 1.6, fontWeight: '800' },
  brandPromise: { fontSize: 11 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  hero: { flex: 1, minHeight: 330, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  haloOuter: { position: 'absolute', width: 310, height: 310, borderRadius: 155, borderWidth: 2 },
  haloInner: { position: 'absolute', width: 268, height: 268, borderRadius: 134, borderWidth: 2 },
  mascot: { width: 310, height: 310 },
  heroTag: { position: 'absolute', bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  bottomSheet: { width: '100%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 22, paddingTop: 9, paddingBottom: 18, gap: 12 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 99, backgroundColor: '#9DB9B3' },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  quoteMark: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  seasonLabel: { letterSpacing: 1.1, fontWeight: '800' },
  message: { lineHeight: 26 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  continueButton: { minHeight: 48, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
