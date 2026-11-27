import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
    try {
      const result = await login(email, password);
      if (result.error || !result.data) { setError(result.error || 'Não foi possível entrar.'); return; }
      const { user, session } = result.data;
      if (!session?.access_token || session.user.id !== user.id) {
        await supabase.auth.signOut({ scope: 'local' });
        useAppStore.getState().setSession(null);
        setError('Não foi possível confirmar sua sessão. Entre novamente.');
        return;
      }
      useAppStore.getState().setSession(session);
      const profileResult = await getProfile(user.id);
      const profile = profileResult.data;
      if (!profile) {
        await supabase.auth.signOut({ scope: 'local' });
        useAppStore.getState().setSession(null);
        useAppStore.getState().setProfile(null);
        setError(profileResult.error || 'Não foi possível carregar seu perfil. Confira a conexão e tente novamente.');
        return;
      }
      if (!profile.ativo) {
        await supabase.auth.signOut({ scope: 'local' });
        useAppStore.getState().setSession(null);
        useAppStore.getState().setProfile(null);
        setError('Esta conta está desativada. Fale com a administração.');
        return;
      }
      useAppStore.getState().setProfile(profile);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(`olhaponto:${profile.id}:profile`, JSON.stringify(profile));
      else await AsyncStorage.setItem(`olhaponto:${profile.id}:profile`, JSON.stringify(profile));
      if (profile.senha_provisoria || user.user_metadata?.senha_provisoria === true) router.replace('/change-password');
      else if (!profile.aceite_termos_em) router.replace('/terms');
      else router.replace('/welcome');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir o acesso. Confira sua conexão e tente novamente.');
    } finally { setLoading(false); }
  };

  const handleRecover = async () => {
    setError(''); setMessage('');
    if (!email.trim()) { setError('Informe seu e-mail para receber as instruções de recuperação.'); return; }
    setLoading(true);
    try {
      const result = await recoverPassword(email);
      if (result.error) setError(result.error);
      else setMessage('Se houver uma conta associada a esse e-mail, enviaremos as instruções para trocar a senha.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível solicitar a recuperação. Tente novamente.'); }
    finally { setLoading(false); }
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
        <TextField label="Senha" value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="password" textContentType="password" returnKeyType="done" onSubmitEditing={handleLogin} accessibilityLabel="Senha" rightAccessory={<Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'} hitSlop={8} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} color={colors.deepTeal} size={22} /></Pressable>} />
        {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
        {message ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{message}</AppText> : null}
        <ActionButton title="Entrar" onPress={handleLogin} loading={loading} disabled={!email.trim() || !password} />
        <ActionButton title="Esqueci minha senha" variant="outline" onPress={handleRecover} disabled={!email.trim() || loading} />
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
