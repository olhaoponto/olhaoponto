import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppText, ScreenShell, useAppColors } from '@/components/ui';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { getProfile } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';

const STEPS = ['Conectando ao banco...', 'Sincronizando batidas...', 'Preparando seu espelho de ponto...'];
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SplashRoute() {
  const router = useRouter();
  const colors = useAppColors();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [float] = useState(() => new Animated.Value(0));
  const setSession = useAppStore((state) => state.setSession);
  const setProfile = useAppStore((state) => state.setProfile);
  const setOffline = useAppStore((state) => state.setOffline);
  const mascotSize = Math.min(190, Math.max(145, width * 0.52), height * 0.25);

  const continueStartup = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env local.');
      setStep(0);
      await pause(300);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = data.session;
      setSession(session);
      setStep(1);
      await pause(300);
      if (!session) {
        setStep(2);
        await pause(250);
        router.replace('/login');
        return;
      }

      const profileResult = await getProfile(session.user.id);
      let profile = profileResult.data;
      let cameFromCache = false;
      if (!profile) {
        try {
          const saved = await AsyncStorage.getItem(`olhaponto:${session.user.id}:profile`);
          if (saved) { profile = JSON.parse(saved); cameFromCache = true; }
        } catch { /* cache ausente ou ilegível */ }
      }
      if (!profile) throw new Error(profileResult.error || 'Não foi possível carregar seu perfil. Confira a conexão e tente novamente.');
      if (!cameFromCache) await AsyncStorage.setItem(`olhaponto:${session.user.id}:profile`, JSON.stringify(profile));
      setProfile(profile);
      setOffline(cameFromCache || profileResult.error === 'offline_cache');
      setStep(2);
      await pause(350);
      if (!profile.ativo) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setError('Esta conta está desativada. Fale com a administração.');
        setBusy(false);
        return;
      }
      const biometricEnabled = await AsyncStorage.getItem(`olhaponto:${session.user.id}:biometric`).catch(() => null);
      if (biometricEnabled === 'true') {
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloqueie o Olha o Ponto', cancelLabel: 'Tentar novamente' });
        if (!auth.success) throw new Error('Não foi possível confirmar sua biometria. Tente novamente.');
      }
      if (profile.senha_provisoria || session.user.user_metadata?.senha_provisoria === true) router.replace('/change-password');
      else if (!profile.aceite_termos_em) router.replace('/terms');
      else router.replace('/welcome');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o aplicativo.');
      setBusy(false);
    }
  }, [router, setOffline, setProfile, setSession]);

  useEffect(() => { void continueStartup(); }, [continueStartup]);
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [float]);

  const progress = `${Math.round(((step + 1) / STEPS.length) * 100)}%` as `${number}%`;
  return (
    <ScreenShell scroll={false} contentStyle={[styles.container, { backgroundColor: '#E4F5F2' }]}>
      <View style={styles.decorations} pointerEvents="none">
        <View style={[styles.cloud, styles.cloudOne]} /><View style={[styles.cloud, styles.cloudTwo]} /><View style={[styles.cloud, styles.cloudThree]} />
        <AppText color="#FFFFFFAA" style={[styles.star, styles.starOne]}>✦</AppText><AppText color="#FFFFFFAA" style={[styles.star, styles.starTwo]}>✧</AppText><AppText color="#FFFFFFAA" style={[styles.star, styles.starThree]}>·</AppText>
      </View>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [6, -6] }) }] }}>
          <Image source={require('../assets/images/mascot/clock-base.png')} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Mascote relógio do Olha o Ponto" style={{ width: mascotSize, height: mascotSize }} />
        </Animated.View>
        <AppText color="#0B4F5C" style={styles.brand}>OLHA O PONTO</AppText>
        <AppText color="#1E7F74" style={styles.tagline}>Seu tempo, com mais cuidado.</AppText>
      </View>
      <View style={styles.status}>
        {error ? <View style={styles.errorBox}>
          <AppText variant="subtitle" color="#0B4F5C">Vamos tentar de novo?</AppText><AppText variant="small" color={colors.muted}>{error}</AppText>
          <Pressable onPress={continueStartup} accessibilityRole="button" accessibilityLabel="Tentar novamente" style={styles.retry}><AppText color="#FFFFFF" style={styles.retryText}>{busy ? 'Tentando…' : 'Tentar novamente'}</AppText></Pressable>
          <Pressable onPress={() => router.replace('/login')} accessibilityRole="button" accessibilityLabel="Ir para o login"><AppText color="#0B4F5C" style={styles.loginText}>Ir para o login</AppText></Pressable>
        </View> : <>
          <View style={styles.progressTrack} accessibilityLabel="Progresso de abertura" accessibilityRole="progressbar"><View style={[styles.progressFill, { width: progress }]}><View style={styles.clockDot}><View style={styles.clockHandShort} /><View style={styles.clockHandLong} /></View></View></View>
          <AppText color="#0B4F5C" style={styles.step}>{STEPS[step]}</AppText>
          <ActivityIndicator color="#1E7F74" size="small" />
        </>}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 24, overflow: 'hidden' },
  decorations: StyleSheet.absoluteFill,
  cloud: { position: 'absolute', width: 112, height: 28, borderRadius: 22, backgroundColor: '#FFFFFF66' },
  cloudOne: { top: '13%', left: '-8%' }, cloudTwo: { top: '24%', right: '-10%', transform: [{ scale: 0.75 }] }, cloudThree: { bottom: '18%', left: '4%', transform: [{ scale: 0.55 }] },
  star: { position: 'absolute', fontSize: 24 }, starOne: { top: '18%', right: '18%' }, starTwo: { top: '34%', left: '15%' }, starThree: { bottom: '28%', right: '12%', fontSize: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  brand: { fontSize: 23, fontWeight: '800', letterSpacing: 3, marginTop: 4 }, tagline: { fontSize: 15, fontWeight: '600' },
  status: { width: '100%', gap: 10, alignItems: 'center', minHeight: 76, justifyContent: 'flex-end' },
  progressTrack: { width: '100%', height: 12, borderRadius: 8, backgroundColor: '#0B4F5C1F', overflow: 'visible' }, progressFill: { height: 12, minWidth: 14, borderRadius: 8, backgroundColor: '#1E7F74', alignItems: 'flex-end', justifyContent: 'center' },
  clockDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0B4F5C', alignItems: 'center', justifyContent: 'center', marginRight: -10 }, clockHandShort: { position: 'absolute', width: 2, height: 7, backgroundColor: '#0B4F5C', top: 6 }, clockHandLong: { position: 'absolute', width: 2, height: 8, backgroundColor: '#0B4F5C', transform: [{ rotate: '125deg' }], top: 8, left: 12 },
  step: { textAlign: 'center', fontSize: 13, fontWeight: '600' }, errorBox: { width: '100%', alignItems: 'center', gap: 10, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF88' }, retry: { backgroundColor: '#0B4F5C', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 }, retryText: { fontWeight: '800' }, loginText: { fontWeight: '700' },
});
