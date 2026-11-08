import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppText, ClockMascot, ScreenShell, SurfaceCard, ActionButton, useAppColors } from '@/components/ui';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { getProfile } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';

const STEPS = ['Conectando ao banco...', 'Sincronizando batidas...', 'Preparando seu espelho de ponto...'];
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SplashRoute() {
  const router = useRouter();
  const colors = useAppColors();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setSession = useAppStore((state) => state.setSession);
  const setProfile = useAppStore((state) => state.setProfile);
  const setOffline = useAppStore((state) => state.setOffline);

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

  // The splash starts the real session/network check once when its route becomes active.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void continueStartup(); }, [continueStartup]);

  return (
    <ScreenShell scroll={false} contentStyle={styles.container}>
      <View style={styles.brand}>
        <ClockMascot size={118} />
        <AppText variant="title" style={{ textAlign: 'center' }}>Olha o Ponto</AppText>
        <AppText variant="body" color={colors.muted} style={{ textAlign: 'center' }}>Seu lembrete de jornada com cuidado e bom humor.</AppText>
      </View>
      <SurfaceCard style={styles.loadingCard}>
        {error ? (
          <>
            <AppText variant="subtitle">Vamos tentar de novo?</AppText>
            <AppText variant="small" color={colors.muted}>{error}</AppText>
            <ActionButton title="Tentar novamente" onPress={continueStartup} loading={busy} />
            <ActionButton title="Ir para o login" variant="outline" onPress={() => router.replace('/login')} />
          </>
        ) : (
          <>
            <View style={styles.statusRow}><ActivityIndicator color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>{STEPS[step]}</AppText></View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progress, { width: `${Math.round(((step + 1) / STEPS.length) * 100)}%`, backgroundColor: colors.teal }]} />
            </View>
            <AppText variant="tiny" color={colors.muted}>Seus horários permanecem privados e protegidos.</AppText>
          </>
        )}
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', paddingBottom: 28, gap: 34 },
  brand: { alignItems: 'center', gap: 10 },
  loadingCard: { gap: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 999 },
});
