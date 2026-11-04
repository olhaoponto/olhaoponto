import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, AppText, ClockMascot, ScreenShell, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { login, getProfile, recoverPassword } from '@/services/auth-service';
import { supabase } from '@/services/supabase';
import { useAppStore } from '@/store/app-store';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true); setError(''); setMessage('');
    const result = await login(email, password);
    if (result.error || !result.data) { setError(result.error || 'Não foi possível entrar.'); setLoading(false); return; }
    const profileResult = await getProfile(result.data.user.id);
    const profile = profileResult.data;
    if (!profile) {
      setError(profileResult.error || 'Não foi possível carregar seu perfil. Tente novamente.');
      await supabase.auth.signOut(); setLoading(false); return;
    }
    if (!profile.ativo) {
      await supabase.auth.signOut(); setError('Esta conta está desativada. Fale com a administração.'); setLoading(false); return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    useAppStore.getState().setSession(sessionData.session);
    useAppStore.getState().setProfile(profile);
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(`olhaponto:${profile.id}:profile`, JSON.stringify(profile));
    else await AsyncStorage.setItem(`olhaponto:${profile.id}:profile`, JSON.stringify(profile));
    setLoading(false);
    if (profile.senha_provisoria || result.data.user.user_metadata?.senha_provisoria === true) router.replace('/change-password');
    else if (!profile.aceite_termos_em) router.replace('/terms');
    else router.replace('/(tabs)');
  };

  const handleRecover = async () => {
    setError(''); setMessage('');
    if (!email.trim()) { setError('Informe seu e-mail para receber as instruções de recuperação.'); return; }
    setLoading(true);
    const result = await recoverPassword(email);
    setLoading(false);
    if (result.error) setError(result.error);
    else setMessage('Se houver uma conta associada a esse e-mail, enviaremos as instruções para trocar a senha.');
  };

  return (
    <ScreenShell contentStyle={styles.page}>
      <View style={styles.brand}>
        <ClockMascot size={92} />
        <AppText variant="title" style={{ textAlign: 'center' }}>Olha o Ponto</AppText>
        <AppText variant="body" color={colors.muted} style={{ textAlign: 'center', maxWidth: 320 }}>Uma pausa amiga para cuidar da sua jornada.</AppText>
      </View>
      <SurfaceCard style={styles.card}>
        <View style={{ gap: 4 }}>
          <AppText variant="subtitle">Que bom ter você por aqui</AppText>
          <AppText variant="small" color={colors.muted}>Entre com a conta criada pela administração.</AppText>
        </View>
        <TextField label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@empresa.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" accessibilityLabel="E-mail" />
        <TextField label="Senha" value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="password" textContentType="password" returnKeyType="done" onSubmitEditing={handleLogin} accessibilityLabel="Senha" />
        <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
          <AppText variant="small" color={colors.deepTeal}>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</AppText>
        </Pressable>
        {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
        {message ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{message}</AppText> : null}
        <ActionButton title="Entrar" onPress={handleLogin} loading={loading} disabled={!email.trim() || !password} />
        <ActionButton title="Esqueci minha senha" variant="outline" onPress={handleRecover} disabled={!email.trim()} />
      </SurfaceCard>
      <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center', maxWidth: 320, alignSelf: 'center' }}>Acesso privado. Não há cadastro aberto neste aplicativo.</AppText>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', gap: 24, paddingTop: 28, paddingBottom: 34 },
  brand: { alignItems: 'center', gap: 8 },
  card: { gap: 16 },
});
