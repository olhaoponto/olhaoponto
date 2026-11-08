import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { ActionButton, AppText, KeyboardModalContent, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { changePassword, deleteAccount, updateEmail, updateProfile } from '@/services/auth-service';
import { exportJson } from '@/services/export-service';
import { loadAllEntries } from '@/services/time-entry-service';
import { useAppStore } from '@/store/app-store';

const isStrong = (value: string) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function PerfilScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const profileId = profile?.id;
  const profileName = profile?.nome || '';
  const profileEmail = profile?.email || '';

  // Draft fields follow profile changes from Auth; user edits remain local until Save.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setName(profileName); setEmail(profileEmail); }, [profileId, profileName, profileEmail]);

  const savePersonalInfo = async () => {
    if (!profile) return;
    if (!name.trim()) { setError('Informe seu nome.'); return; }
    setSaving(true); setError(''); setMessage('');
    const result = await updateProfile({ nome: name.trim() });
    if (result.error || !result.data) { setSaving(false); setError(result.error || 'Não foi possível atualizar seu perfil.'); return; }
    setProfile(result.data);
    if (email.trim().toLowerCase() !== profile.email.toLowerCase()) {
      const emailResult = await updateEmail(email);
      if (emailResult.error) { setSaving(false); setError(emailResult.error); return; }
      setMessage('Nome salvo. Enviamos um link de confirmação para o novo e-mail; ele será atualizado após a confirmação.');
    } else setMessage('Seus dados foram atualizados.');
    setSaving(false);
  };

  const exportAll = async () => {
    if (!profile) return;
    setExporting(true); setError(''); setMessage('');
    const result = await loadAllEntries();
    if (!result.data) { setError(result.error || 'Não foi possível buscar seus dados.'); setExporting(false); return; }
    try { await exportJson(profile, result.data, 'todos'); setMessage(result.error ? 'Dados salvos neste aparelho exportados; a conexão não permitiu atualizar o histórico.' : 'Arquivo JSON com todos os seus registros pronto para compartilhar.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível exportar seus dados.'); }
    setExporting(false);
  };

  const saveNewPassword = async () => {
    setError('');
    if (!isStrong(newPassword)) { setError('Use 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo.'); return; }
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setSaving(true);
    try {
      const result = await changePassword(newPassword);
      if (result.error) { setError(result.error); return; }
      setPasswordModal(false); setNewPassword(''); setConfirmPassword(''); setMessage('Senha alterada com sucesso.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível alterar a senha. Tente novamente.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (deleteWord !== 'APAGAR') { setError('Digite APAGAR exatamente para confirmar.'); return; }
    setSaving(true); setError('');
    const result = await deleteAccount(deleteWord);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setDeleteModal(false);
    router.replace('/login');
  };

  const roleLabel = profile?.role === 'admin' ? 'Administrador' : 'Usuário';
  if (!profile) return <ScreenShell><AppText variant="body">Carregando perfil...</AppText></ScreenShell>;

  return (
    <ScreenShell contentStyle={styles.page}>
      <TabNavigationCard active={null} />
      <PageHeading eyebrow="Sua conta" title="Perfil" subtitle="Seus dados pessoais e segurança da conta." right={<AccountMenuButton />} />
      <SurfaceCard style={styles.identityCard}>
        <View style={{ flex: 1, gap: 4 }}><AppText variant="subtitle">{profile.nome}</AppText><AppText variant="small" color={colors.muted}>{profile.email}</AppText></View>
        <StatusPill tone={profile.role === 'admin' ? 'yellow' : 'teal'}>{roleLabel.toUpperCase()}</StatusPill>
      </SurfaceCard>
      {message ? <AppText variant="small" color={colors.deepTeal}>{message}</AppText> : null}
      {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}

      <SurfaceCard>
        <AppText variant="subtitle">Dados da conta</AppText>
        <TextField label="Nome" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
        <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <AppText variant="tiny" color={colors.muted}>A troca de e-mail só vale depois que você confirmar o link enviado pelo Supabase.</AppText>
        <ActionButton title="Salvar dados" onPress={savePersonalInfo} loading={saving} />
        <ActionButton title="Alterar senha" variant="outline" onPress={() => { setError(''); setPasswordModal(true); }} />
      </SurfaceCard>

      <SurfaceCard>
        <AppText variant="subtitle">Seus dados e informações</AppText>
        <AppText variant="small" color={colors.muted}>Exporte seus registros pessoais ou consulte as informações do aplicativo.</AppText>
        <ActionButton title="Exportar meus dados (JSON)" variant="outline" onPress={exportAll} loading={exporting} />
        <ActionButton title="Termos de uso e privacidade" variant="ghost" onPress={() => router.push('/terms')} />
        <ActionButton title="Sobre o aplicativo" variant="ghost" onPress={() => router.push('/about')} />
        {profile.role === 'admin' ? <ActionButton title="Administração de contas" variant="secondary" onPress={() => router.push('/admin')} icon={<MaterialCommunityIcons name="account-cog-outline" size={19} color={colors.deepTeal} />} /> : null}
      </SurfaceCard>

      <SurfaceCard style={{ borderColor: `${colors.error}60` }}>
        <AppText variant="subtitle" color={colors.error}>Zona de segurança</AppText>
        <AppText variant="small" color={colors.muted}>Apagar minha conta remove seu perfil e todas as batidas e preferências associadas. Essa ação não pode ser desfeita.</AppText>
        <ActionButton title="APAGAR MINHA CONTA" variant="danger" onPress={() => { setDeleteWord(''); setError(''); setDeleteModal(true); }} />
      </SurfaceCard>

      <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Olha o Ponto · versão 1.0.1</AppText>

      <Modal visible={passwordModal} transparent animationType="fade" onRequestClose={() => setPasswordModal(false)}>
        <KeyboardModalContent><SurfaceCard style={styles.modalCard}>
          <View style={styles.modalHead}><AppText variant="subtitle">Alterar senha</AppText><Pressable onPress={() => setPasswordModal(false)} accessibilityRole="button" accessibilityLabel="Fechar alteração de senha"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View>
          <TextField label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" />
          <TextField label="Confirmar nova senha" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" />
          <AppText variant="tiny" color={colors.muted}>Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</AppText>
          <PreferenceSwitch label="Mostrar senha" value={showPassword} onChange={setShowPassword} />
          {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
          <ActionButton title="Salvar senha" onPress={saveNewPassword} loading={saving} />
          <ActionButton title="Cancelar" variant="outline" onPress={() => setPasswordModal(false)} />
        </SurfaceCard></KeyboardModalContent>
      </Modal>
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}>
        <KeyboardModalContent><SurfaceCard style={styles.modalCard}>
          <AppText variant="title" color={colors.error}>Excluir sua conta?</AppText>
          <AppText variant="body">Confirme digitando APAGAR. Seu usuário, perfil, batidas e preferências serão removidos permanentemente.</AppText>
          <TextField label="Digite APAGAR" value={deleteWord} onChangeText={setDeleteWord} autoCapitalize="characters" autoCorrect={false} />
          <AppText variant="tiny" color={colors.muted}>Você será desconectado assim que a exclusão for concluída.</AppText>
          {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
          <ActionButton title="Excluir conta definitivamente" variant="danger" onPress={handleDelete} loading={saving} disabled={deleteWord !== 'APAGAR'} />
          <ActionButton title="Cancelar" variant="outline" onPress={() => setDeleteModal(false)} />
        </SurfaceCard></KeyboardModalContent>
      </Modal>
    </ScreenShell>
  );
}

function PreferenceSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useAppColors();
  return <View style={styles.switchRow}><AppText variant="small" style={{ flex: 1 }}>{label}</AppText><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.teal }} thumbColor={value ? colors.deepTeal : '#F2F5F3'} accessibilityRole="switch" accessibilityState={{ checked: value }} /></View>;
}

const styles = StyleSheet.create({
  page: { gap: 15, paddingTop: 18 },
  identityCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DFEAE6' },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 13 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
