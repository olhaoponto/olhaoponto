import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { adminCreateUser, adminResetPassword, adminSetUserStatus, listProfiles } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';
import type { Profile } from '@/types/app';

const isStrong = (value: string) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function AdminScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const current = useAppStore((state) => state.profile);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [statusTarget, setStatusTarget] = useState<Profile | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    const result = await listProfiles();
    if (result.data) setProfiles(result.data);
    else setError(result.error || 'Não foi possível carregar as contas.');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (current?.role !== 'admin' || !current.ativo) return;
    let alive = true;
    void listProfiles().then((result) => {
      if (!alive) return;
      if (result.data) setProfiles(result.data); else setError(result.error || 'Não foi possível carregar as contas.');
      setLoading(false);
    });
    return () => { alive = false; };
  }, [current?.id, current?.role, current?.ativo]);

  const createUser = async () => {
    setError(''); setSuccess('');
    if (!nome.trim() || !email.trim()) { setError('Informe nome e e-mail.'); return; }
    if (!isStrong(temporaryPassword)) { setError('A senha provisória precisa ter 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo.'); return; }
    setBusy(true);
    const result = await adminCreateUser({ nome: nome.trim(), email: email.trim(), senhaProvisoria: temporaryPassword });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setNome(''); setEmail(''); setTemporaryPassword(''); setSuccess('Conta criada. Compartilhe a senha provisória com a pessoa por um canal seguro; ela deverá trocá-la no primeiro acesso.');
    await refresh();
  };

  const resetUserPassword = async () => {
    if (!resetTarget) return;
    setError('');
    if (!isStrong(resetPassword)) { setError('Use 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo.'); return; }
    setBusy(true);
    const result = await adminResetPassword({ user_id: resetTarget.id, nova_senha: resetPassword });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setSuccess(`Senha de ${resetTarget.nome} redefinida. A nova senha é provisória e deverá ser trocada no próximo login.`);
    setResetTarget(null); setResetPassword('');
  };

  const setUserStatus = async () => {
    if (!statusTarget) return;
    setBusy(true); setError('');
    const result = await adminSetUserStatus({ user_id: statusTarget.id, ativo: !statusTarget.ativo });
    setBusy(false);
    if (result.error) { setError(result.error); setStatusTarget(null); return; }
    setSuccess(`${statusTarget.ativo ? 'Conta desativada' : 'Conta ativada'}: ${statusTarget.nome}.`);
    setStatusTarget(null);
    await refresh();
  };

  if (!current || current.role !== 'admin' || !current.ativo) {
    return <ScreenShell><AppText variant="title">Acesso restrito</AppText><AppText variant="body" color={colors.muted}>Somente administradores ativos podem gerenciar contas.</AppText><ActionButton title="Voltar" onPress={() => router.replace('/(tabs)')} /></ScreenShell>;
  }

  return (
    <ScreenShell contentStyle={styles.page}>
      <PageHeading eyebrow="Acesso administrativo" title="Contas de usuários" subtitle="Gerencie apenas identidade e acesso — nunca as batidas." right={<MaterialCommunityIcons name="account-cog-outline" size={28} color={colors.deepTeal} />} />
      <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>A administração pode ver nomes, e-mails e status das contas, mas não pode consultar os registros de ponto de outras pessoas. Cada usuário recebe uma senha provisória e deve trocá-la ao entrar.</AppText></SurfaceCard>
      {success ? <AppText variant="small" color={colors.deepTeal}>{success}</AppText> : null}
      {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}

      <SurfaceCard>
        <AppText variant="subtitle">Cadastrar usuário</AppText>
        <TextField label="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" autoComplete="name" />
        <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <TextField label="Senha provisória" value={temporaryPassword} onChangeText={setTemporaryPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" />
        <AppText variant="tiny" color={colors.muted}>Mínimo de 12 caracteres, incluindo maiúscula, minúscula, número e símbolo. Nunca envie a senha por canal público.</AppText>
        <ActionButton title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} variant="ghost" onPress={() => setShowPassword((value) => !value)} />
        <ActionButton title="Criar conta" onPress={createUser} loading={busy} disabled={!nome.trim() || !email.trim() || !temporaryPassword} />
      </SurfaceCard>

      <View style={styles.listHeading}><AppText variant="subtitle">Usuários cadastrados</AppText><Pressable onPress={refresh} accessibilityRole="button" accessibilityLabel="Atualizar lista"><MaterialCommunityIcons name="refresh" size={22} color={colors.deepTeal} /></Pressable></View>
      {loading ? <ActivityIndicator color={colors.deepTeal} /> : null}
      {!loading && profiles.length === 0 ? <SurfaceCard><AppText variant="small" color={colors.muted}>Ainda não há perfis para mostrar.</AppText></SurfaceCard> : null}
      {profiles.map((item) => <SurfaceCard key={item.id} style={styles.userCard}>
        <View style={{ flex: 1, gap: 4 }}><View style={styles.userName}><AppText variant="subtitle" style={{ flex: 1 }}>{item.nome}</AppText><StatusPill tone={item.ativo ? 'teal' : 'danger'}>{item.ativo ? 'ATIVO' : 'INATIVO'}</StatusPill></View><AppText variant="small" color={colors.muted}>{item.email}</AppText><AppText variant="tiny" color={colors.muted}>{item.role === 'admin' ? 'Administrador' : 'Usuário'}{item.senha_provisoria ? ' · troca de senha pendente' : ''}</AppText></View>
        <View style={styles.actions}><Pressable onPress={() => { setError(''); setResetTarget(item); }} accessibilityRole="button" accessibilityLabel={`Redefinir senha de ${item.nome}`} style={[styles.iconButton, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="key-change" size={19} color={colors.deepTeal} /></Pressable>{item.id !== current.id ? <Pressable onPress={() => { setError(''); setStatusTarget(item); }} accessibilityRole="button" accessibilityLabel={item.ativo ? `Desativar ${item.nome}` : `Ativar ${item.nome}`} style={[styles.iconButton, { backgroundColor: item.ativo ? `${colors.error}18` : `${colors.teal}20` }]}><MaterialCommunityIcons name={item.ativo ? 'account-cancel-outline' : 'account-check-outline'} size={19} color={item.ativo ? colors.error : colors.deepTeal} /></Pressable> : null}</View>
      </SurfaceCard>)}
      <ActionButton title="Voltar ao aplicativo" variant="outline" onPress={() => router.replace('/(tabs)')} />

      <Modal visible={Boolean(resetTarget)} transparent animationType="fade" onRequestClose={() => setResetTarget(null)}><View style={styles.backdrop}><SurfaceCard style={styles.modalCard}><AppText variant="subtitle">Redefinir senha</AppText><AppText variant="small" color={colors.muted}>{resetTarget?.nome} terá que criar uma senha pessoal no próximo login.</AppText><TextField label="Nova senha provisória" value={resetPassword} onChangeText={setResetPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" /><AppText variant="tiny" color={colors.muted}>Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</AppText>{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title="Redefinir senha" onPress={resetUserPassword} loading={busy} disabled={!resetPassword} /><ActionButton title="Cancelar" variant="outline" onPress={() => setResetTarget(null)} /></SurfaceCard></View></Modal>
      <Modal visible={Boolean(statusTarget)} transparent animationType="fade" onRequestClose={() => setStatusTarget(null)}><View style={styles.backdrop}><SurfaceCard style={styles.modalCard}><AppText variant="subtitle">{statusTarget?.ativo ? 'Desativar conta?' : 'Ativar conta?'}</AppText><AppText variant="body" color={colors.muted}>{statusTarget?.ativo ? 'A pessoa perderá acesso ao aplicativo.' : 'A pessoa poderá voltar a entrar com sua conta.'}</AppText>{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title={statusTarget?.ativo ? 'Confirmar desativação' : 'Confirmar ativação'} variant={statusTarget?.ativo ? 'danger' : 'primary'} onPress={setUserStatus} loading={busy} /><ActionButton title="Cancelar" variant="outline" onPress={() => setStatusTarget(null)} /></SurfaceCard></View></Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 15, paddingTop: 18 },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: '#081A1880', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 },
});
