import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, AppText, ClockMascot, ScreenShell, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { changePassword, getProfile } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';

function isStrongPassword(value: string) {
  return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!isStrongPassword(password)) { setError('Use 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo.'); return; }
    if (password !== confirmation) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    const changed = await changePassword(password);
    if (changed.error) { setError(changed.error); setLoading(false); return; }
    const profile = await getProfile();
    if (profile.data) useAppStore.getState().setProfile(profile.data);
    setLoading(false);
    if (!profile.data?.aceite_termos_em) router.replace('/terms');
    else router.replace('/(tabs)');
  };

  return (
    <ScreenShell contentStyle={styles.page}>
      <View style={styles.hero}><ClockMascot size={88} worried /><AppText variant="title" style={{ textAlign: 'center' }}>Um último ajuste</AppText><AppText variant="body" color={colors.muted} style={{ textAlign: 'center' }}>Por segurança, escolha uma nova senha pessoal.</AppText></View>
      <SurfaceCard>
        <TextField label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
        <TextField label="Confirme a nova senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
        <AppText variant="tiny" color={colors.muted}>Mínimo de 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.</AppText>
        <AppText variant="tiny" color={password && !isStrongPassword(password) ? colors.error : colors.deepTeal}>{password ? (isStrongPassword(password) ? 'Senha forte.' : 'Ainda falta atender aos requisitos.') : 'Sua senha é pessoal e não aparece para a administração.'}</AppText>
        {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
        <ActionButton title={show ? 'Ocultar senha' : 'Mostrar senha'} variant="ghost" onPress={() => setShow((value) => !value)} />
        <ActionButton title="Salvar nova senha" onPress={handleSave} loading={loading} disabled={!password || !confirmation} />
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ page: { justifyContent: 'center', gap: 24, paddingVertical: 24 }, hero: { alignItems: 'center', gap: 8 } });
