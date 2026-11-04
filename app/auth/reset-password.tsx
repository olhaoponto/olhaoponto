import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { ActionButton, AppText, ScreenShell, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { changePassword } from '@/services/auth-service';
import { supabase } from '@/services/supabase';

function strong(value: string) { return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value); }

export default function ResetPasswordScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const activate = async (url?: string | null) => {
      if (url) {
        const parsed = Linking.parse(url);
        const accessToken = typeof parsed.queryParams?.access_token === 'string' ? parsed.queryParams.access_token : null;
        const refreshToken = typeof parsed.queryParams?.refresh_token === 'string' ? parsed.queryParams.refresh_token : null;
        const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
        if (code) await supabase.auth.exchangeCodeForSession(code);
        else if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
      const { data } = await supabase.auth.getSession();
      if (active) { setReady(Boolean(data.session)); setLoading(false); if (!data.session) setError('Abra novamente o link mais recente enviado ao seu e-mail.'); }
    };
    void Linking.getInitialURL().then(activate).catch(() => { if (active) { setError('Não foi possível validar o link.'); setLoading(false); } });
    const subscription = Linking.addEventListener('url', ({ url }) => { setLoading(true); void activate(url); });
    return () => { active = false; subscription.remove(); };
  }, []);

  const handleSave = async () => {
    setError('');
    if (!strong(password)) { setError('Use 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo.'); return; }
    if (password !== confirmation) { setError('As senhas não coincidem.'); return; }
    setSaving(true);
    const result = await changePassword(password);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    router.replace('/login');
  };

  return (
    <ScreenShell contentStyle={{ flex: 1, justifyContent: 'center' }}>
      <SurfaceCard>
        <AppText variant="title">Criar nova senha</AppText>
        {loading ? <AppText variant="body" color={colors.muted}>Validando seu link...</AppText> : null}
        {ready ? <>
          <TextField label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
          <TextField label="Confirme a senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
          <AppText variant="tiny" color={colors.muted}>Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</AppText>
        </> : null}
        {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
        {ready ? <ActionButton title="Salvar senha" onPress={handleSave} loading={saving} disabled={!password || !confirmation} /> : null}
        {!ready && !loading ? <ActionButton title="Voltar ao login" variant="outline" onPress={() => router.replace('/login')} /> : null}
      </SurfaceCard>
    </ScreenShell>
  );
}
