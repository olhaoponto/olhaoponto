import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText, ScreenShell } from '@/components/ui';
import { getDailyWelcome, getWelcomeMessageStorageKey, type WelcomeScene } from '@/utils/welcome-message';
import { useAppStore } from '@/store/app-store';

const DURATION_MS = 11500;
const sceneImages: Record<WelcomeScene, number> = {
  'bem-estar': require('../assets/boasvindas/bem-estar.webp'),
  motivacao: require('../assets/boasvindas/motivacao.webp'),
  organizacao: require('../assets/boasvindas/organizacao.webp'),
  gratidao: require('../assets/boasvindas/gratidao.webp'),
  humor: require('../assets/boasvindas/humor.webp'),
  ponto: require('../assets/boasvindas/ponto.webp'),
  natal: require('../assets/boasvindas/natal.webp'),
  anonovo: require('../assets/boasvindas/anonovo.webp'),
  carnaval: require('../assets/boasvindas/carnaval.webp'),
  junina: require('../assets/boasvindas/junina.webp'),
};

export function WelcomeSplash({ onContinue }: { onContinue: () => void }) {
  const sessionUserId = useAppStore((state) => state.session?.user.id ?? null);
  const profile = useAppStore((state) => state.profile);
  const userId = profile?.ativo === true && profile.id === sessionUserId ? sessionUserId : null;
  const openedAt = useMemo(() => new Date(), []);
  const [welcome, setWelcome] = useState(() => getDailyWelcome(openedAt));
  const [progress] = useState(() => new Animated.Value(0));
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
    const animation = Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) finish(); });
    return () => animation.stop();
  }, [finish, progress]);

  return (
    <ScreenShell scroll={false} edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.page}>
      <ImageBackground source={sceneImages[welcome.scene]} resizeMode="cover" imageStyle={styles.sceneImage} style={styles.background}>
        <View style={styles.content}>
          <View style={styles.copy}>
            <View style={[styles.accentBar, { backgroundColor: welcome.accent }]} />
            <AppText variant="tiny" color={welcome.accent} style={styles.seasonLabel}>{welcome.seasonLabel}</AppText>
            <AppText color={welcome.accent} style={styles.quote} accessibilityLabel="Aspas da mensagem">“</AppText>
            <AppText color="#0B4F5C" style={styles.message} adjustsFontSizeToFit numberOfLines={6}>{welcome.message}</AppText>
            <AppText color={welcome.accent} style={styles.author}>{welcome.author}</AppText>
          </View>
          <View style={styles.footer}>
            <View style={styles.progressTrack} accessibilityLabel="Abertura do aplicativo" accessibilityRole="progressbar">
              <Animated.View style={[styles.progressFill, { backgroundColor: welcome.accent, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
                <View style={styles.clockDot} accessibilityLabel="Progresso da abertura"><View style={styles.clockHandShort} /><View style={styles.clockHandLong} /></View>
              </Animated.View>
            </View>
            <AppText color="#0B4F5C" style={styles.brand}>OLHA O PONTO</AppText>
            <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Entrar em Hoje agora" style={[styles.continueButton, { borderColor: welcome.accent }]}><AppText variant="small" color="#0B4F5C" style={styles.continueText}>Entrar em Hoje agora</AppText></Pressable>
          </View>
        </View>
      </ImageBackground>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingVertical: 0 },
  background: { flex: 1, width: '100%', minHeight: '100%' },
  sceneImage: { bottom: 0 },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 28, paddingBottom: 20 },
  copy: { maxWidth: 520, paddingTop: 4 },
  accentBar: { width: 44, height: 5, borderRadius: 3, marginBottom: 12 },
  seasonLabel: { letterSpacing: 2, fontWeight: '800', marginBottom: 12 },
  quote: { fontSize: 64, lineHeight: 50, fontWeight: '700', opacity: 0.35, height: 50 },
  message: { fontSize: 28, lineHeight: 35, fontWeight: '700', maxWidth: 500 },
  author: { alignSelf: 'flex-end', fontSize: 15, lineHeight: 22, fontWeight: '600', marginTop: 14 },
  footer: { gap: 10, width: '100%' },
  progressTrack: { height: 12, borderRadius: 8, backgroundColor: '#0B4F5C1F', overflow: 'visible' },
  progressFill: { height: 12, borderRadius: 8, minWidth: 14, alignItems: 'flex-end', justifyContent: 'center' },
  clockDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0B4F5C', alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  clockHandShort: { position: 'absolute', width: 2, height: 7, backgroundColor: '#0B4F5C', top: 6, borderRadius: 2 },
  clockHandLong: { position: 'absolute', width: 2, height: 8, backgroundColor: '#0B4F5C', transform: [{ rotate: '125deg' }], top: 8, left: 12, borderRadius: 2 },
  brand: { letterSpacing: 3, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  continueButton: { alignSelf: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF66' },
  continueText: { fontWeight: '700' },
});
