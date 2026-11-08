import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { ActionButton, AppText, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { adminCreateUser, adminForceUserLogout, adminListPresence, adminResetPassword, adminSetUserStatus, listProfiles } from '@/services/auth-service';
import { BROADCAST_PRESETS, deleteAdminBroadcast, loadAdminBroadcasts, saveAdminBroadcast, setAdminBroadcastActive } from '@/services/communications-service';
import { useAppStore } from '@/store/app-store';
import type { BroadcastMessage, BroadcastType, Profile, UserPresence } from '@/types/app';

const isStrong = (value: string) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function AdminScreen() {
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
  const [logoutTarget, setLogoutTarget] = useState<Profile | null>(null);
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [editingBroadcastId, setEditingBroadcastId] = useState<string | null>(null);
  const [deleteBroadcastTarget, setDeleteBroadcastTarget] = useState<BroadcastMessage | null>(null);
  const [broadcastType, setBroadcastType] = useState<BroadcastType>('maintenance');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    const [result, presenceResult, broadcastResult] = await Promise.all([listProfiles(), adminListPresence(), loadAdminBroadcasts()]);
    if (result.data) setProfiles(result.data); else setError(result.error || 'Não foi possível carregar as contas.');
    if (presenceResult.data) setPresence(presenceResult.data.presence);
    else setError((currentError) => currentError || presenceResult.error || 'Não foi possível carregar a presença recente.');
    if (broadcastResult.data) setBroadcasts(broadcastResult.data);
    else setError((currentError) => currentError || broadcastResult.error || 'Não foi possível carregar os comunicados.');
    setLoading(false);
  }, []);

  const refreshPresence = useCallback(async () => {
    const result = await adminListPresence();
    if (result.data) setPresence(result.data.presence);
  }, []);

  useEffect(() => {
    if (current?.role !== 'admin' || !current.ativo) return;
    let active = true;
    void (async () => { await Promise.resolve(); if (active) void refresh(); })();
    const timer = setInterval(() => { void refreshPresence(); }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [current?.id, current?.role, current?.ativo, refresh, refreshPresence]);

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

  const forceLogout = async () => {
    if (!logoutTarget) return;
    setBusy(true); setError('');
    const result = await adminForceUserLogout(logoutTarget.id);
    setBusy(false);
    if (result.error) { setError(result.error); setLogoutTarget(null); return; }
    setSuccess(`Solicitação registrada para ${logoutTarget.nome}. Os aparelhos on-line com a versão atual do app sairão em até 30 segundos.`);
    setLogoutTarget(null);
    await refresh();
  };

  const selectBroadcastPreset = (preset: (typeof BROADCAST_PRESETS)[number]) => {
    setEditingBroadcastId(null); setBroadcastType(preset.message_type); setBroadcastTitle(preset.title); setBroadcastMessage(preset.message); setError('');
  };

  const editBroadcast = (item: BroadcastMessage) => {
    setEditingBroadcastId(item.id); setBroadcastType(item.message_type); setBroadcastTitle(item.title); setBroadcastMessage(item.message); setError('');
  };

  const resetBroadcastForm = () => { setEditingBroadcastId(null); setBroadcastType('maintenance'); setBroadcastTitle(''); setBroadcastMessage(''); };

  const publishBroadcast = async () => {
    setError(''); setSuccess(''); setBusy(true);
    const result = await saveAdminBroadcast({ ...(editingBroadcastId ? { id: editingBroadcastId } : {}), title: broadcastTitle, message: broadcastMessage, message_type: broadcastType });
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setSuccess(editingBroadcastId ? 'Comunicado atualizado.' : 'Comunicado publicado para os usuários ativos.');
    resetBroadcastForm();
    await refresh();
  };

  const toggleBroadcast = async (item: BroadcastMessage) => {
    setBusy(true); setError('');
    const result = await setAdminBroadcastActive(item.id, !item.active);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setSuccess(item.active ? 'Comunicado pausado.' : 'Comunicado publicado novamente.');
    await refresh();
  };

  const removeBroadcast = async () => {
    if (!deleteBroadcastTarget) return;
    setBusy(true); setError('');
    const result = await deleteAdminBroadcast(deleteBroadcastTarget.id);
    setBusy(false);
    if (result.error) { setError(result.error); setDeleteBroadcastTarget(null); return; }
    setSuccess('Comunicado removido.'); setDeleteBroadcastTarget(null);
    await refresh();
  };

  if (!current || current.role !== 'admin' || !current.ativo) {
    return <ScreenShell contentStyle={styles.page}><TabNavigationCard /><AppText variant="title">Acesso restrito</AppText><AppText variant="body" color={colors.muted}>Somente administradores ativos podem gerenciar contas.</AppText></ScreenShell>;
  }

  return (
    <ScreenShell contentStyle={styles.page}>
      <TabNavigationCard />
      <PageHeading eyebrow="Acesso administrativo" title="Contas de usuários" subtitle="Gerencie apenas identidade e acesso — nunca as batidas." right={<AccountMenuButton />} />
      <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>A administração pode ver nomes, e-mails e status das contas, mas não pode consultar os registros de ponto de outras pessoas. Cada usuário recebe uma senha provisória e deve trocá-la ao entrar.</AppText></SurfaceCard>
      <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>“Ativo agora” significa que a versão atual do app enviou um sinal nos últimos 2 minutos; não é uma lista de tokens ou dispositivos. O logout solicitado encerra a sessão da versão atual quando o aparelho estiver on-line, em até 30 segundos; aparelhos sem conexão verificarão ao retornar.</AppText></SurfaceCard>
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
      {profiles.map((item) => {
        const userPresence = presence.find((entry) => entry.user_id === item.id);
        const presenceLabel = userPresence?.active_recently ? 'ATIVO AGORA' : userPresence ? 'SEM ATIVIDADE RECENTE' : 'SEM SINAL RECENTE';
        const lastSeen = userPresence ? `Último sinal: ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(userPresence.last_seen_at))}` : 'O aparelho ainda não enviou sinal nesta versão.';
        return <SurfaceCard key={item.id} style={styles.userCard}>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={styles.userName}><AppText variant="subtitle" style={{ flex: 1 }}>{item.nome}</AppText><StatusPill tone={item.ativo ? 'teal' : 'danger'}>{item.ativo ? 'ATIVO' : 'INATIVO'}</StatusPill></View>
            <AppText variant="small" color={colors.muted}>{item.email}</AppText>
            <AppText variant="tiny" color={colors.muted}>{item.role === 'admin' ? 'Administrador' : 'Usuário'}{item.senha_provisoria ? ' · troca de senha pendente' : ''}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}><StatusPill tone={userPresence?.active_recently ? 'teal' : 'neutral'}>{presenceLabel}</StatusPill><AppText variant="tiny" color={colors.muted}>{lastSeen}</AppText></View>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => { setError(''); setResetTarget(item); }} accessibilityRole="button" accessibilityLabel={`Redefinir senha de ${item.nome}`} style={[styles.iconButton, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="key-change" size={19} color={colors.deepTeal} /></Pressable>
            {item.id !== current.id ? <>
              <Pressable onPress={() => { setError(''); setLogoutTarget(item); }} accessibilityRole="button" accessibilityLabel={`Forçar saída de ${item.nome}`} style={[styles.iconButton, { backgroundColor: `${colors.yellow}40` }]}><MaterialCommunityIcons name="logout" size={19} color={colors.deepTeal} /></Pressable>
              <Pressable onPress={() => { setError(''); setStatusTarget(item); }} accessibilityRole="button" accessibilityLabel={item.ativo ? `Desativar ${item.nome}` : `Ativar ${item.nome}`} style={[styles.iconButton, { backgroundColor: item.ativo ? `${colors.error}18` : `${colors.teal}20` }]}><MaterialCommunityIcons name={item.ativo ? 'account-cancel-outline' : 'account-check-outline'} size={19} color={item.ativo ? colors.error : colors.deepTeal} /></Pressable>
            </> : null}
          </View>
        </SurfaceCard>;
      })}

      <SurfaceCard style={{ gap: 12 }}>
        <AppText variant="subtitle">Comunicados de manutenção e atualização</AppText>
        <AppText variant="small" color={colors.muted}>Escolha um texto padrão para começar, edite-o ou escreva uma mensagem personalizada. Ao publicar, ela aparece no Hoje dos usuários ativos com o mascote.</AppText>
        <View style={styles.presetChoices}>{BROADCAST_PRESETS.map((preset) => <Pressable key={preset.id} onPress={() => selectBroadcastPreset(preset)} accessibilityRole="button" style={[styles.presetButton, { borderColor: colors.border, backgroundColor: colors.input }]}><AppText variant="tiny" color={colors.deepTeal}>{preset.label}</AppText></Pressable>)}</View>
        <TextField label="Título" value={broadcastTitle} onChangeText={setBroadcastTitle} maxLength={100} placeholder="Ex.: Manutenção programada" />
        <TextField label="Mensagem para os usuários" value={broadcastMessage} onChangeText={setBroadcastMessage} multiline numberOfLines={5} maxLength={2000} style={styles.broadcastText} placeholder="Escreva a mensagem que aparecerá com o mascote." />
        <AppText variant="tiny" color={colors.muted}>{broadcastMessage.length}/2000 caracteres · tipo: {broadcastType === 'maintenance' ? 'manutenção' : broadcastType === 'update' ? 'atualização' : 'aviso'}</AppText>
        <ActionButton title={editingBroadcastId ? 'Salvar alterações' : 'Publicar comunicado'} onPress={publishBroadcast} loading={busy} disabled={!broadcastTitle.trim() || !broadcastMessage.trim()} />
        {editingBroadcastId ? <ActionButton title="Cancelar edição" variant="outline" onPress={resetBroadcastForm} disabled={busy} /> : null}
        <AppText variant="small" style={{ fontWeight: '600' }}>Mensagens cadastradas</AppText>
        {broadcasts.length ? broadcasts.map((item) => <View key={item.id} style={[styles.broadcastRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1, gap: 4 }}><View style={styles.userName}><AppText variant="body" style={{ flex: 1, fontWeight: '700' }}>{item.title}</AppText><StatusPill tone={item.active ? 'teal' : 'neutral'}>{item.active ? 'PUBLICADA' : 'PAUSADA'}</StatusPill></View><AppText variant="tiny" color={colors.muted}>{item.message_type === 'maintenance' ? 'Manutenção' : item.message_type === 'update' ? 'Atualização' : 'Aviso'} · {item.message}</AppText></View>
          <View style={styles.actions}><Pressable onPress={() => editBroadcast(item)} accessibilityRole="button" accessibilityLabel={`Editar comunicado ${item.title}`} style={[styles.iconButton, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.deepTeal} /></Pressable><Pressable onPress={() => void toggleBroadcast(item)} accessibilityRole="button" accessibilityLabel={item.active ? `Pausar comunicado ${item.title}` : `Publicar comunicado ${item.title}`} style={[styles.iconButton, { backgroundColor: colors.input }]}><MaterialCommunityIcons name={item.active ? 'pause' : 'play'} size={18} color={colors.deepTeal} /></Pressable><Pressable onPress={() => setDeleteBroadcastTarget(item)} accessibilityRole="button" accessibilityLabel={`Remover comunicado ${item.title}`} style={[styles.iconButton, { backgroundColor: `${colors.error}18` }]}><MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} /></Pressable></View>
        </View>) : <AppText variant="small" color={colors.muted}>Nenhum comunicado cadastrado.</AppText>}
      </SurfaceCard>

      <Modal visible={Boolean(resetTarget)} transparent animationType="fade" onRequestClose={() => setResetTarget(null)}><View style={styles.backdrop}><SurfaceCard style={styles.modalCard}><AppText variant="subtitle">Redefinir senha</AppText><AppText variant="small" color={colors.muted}>{resetTarget?.nome} terá que criar uma senha pessoal no próximo login.</AppText><TextField label="Nova senha provisória" value={resetPassword} onChangeText={setResetPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" /><AppText variant="tiny" color={colors.muted}>Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</AppText>{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title="Redefinir senha" onPress={resetUserPassword} loading={busy} disabled={!resetPassword} /><ActionButton title="Cancelar" variant="outline" onPress={() => setResetTarget(null)} /></SurfaceCard></View></Modal>
      <Modal visible={Boolean(statusTarget)} transparent animationType="fade" onRequestClose={() => setStatusTarget(null)}><View style={styles.backdrop}><SurfaceCard style={styles.modalCard}><AppText variant="subtitle">{statusTarget?.ativo ? 'Desativar conta?' : 'Ativar conta?'}</AppText><AppText variant="body" color={colors.muted}>{statusTarget?.ativo ? 'A pessoa perderá acesso ao aplicativo.' : 'A pessoa poderá voltar a entrar com sua conta.'}</AppText>{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title={statusTarget?.ativo ? 'Confirmar desativação' : 'Confirmar ativação'} variant={statusTarget?.ativo ? 'danger' : 'primary'} onPress={setUserStatus} loading={busy} /><ActionButton title="Cancelar" variant="outline" onPress={() => setStatusTarget(null)} /></SurfaceCard></View></Modal>
      <Modal visible={Boolean(logoutTarget)} transparent animationType="fade" onRequestClose={() => setLogoutTarget(null)}><View style={styles.backdrop}><SurfaceCard style={styles.modalCard}><AppText variant="subtitle">Forçar saída do app?</AppText><AppText variant="body" color={colors.muted}>{logoutTarget?.nome} será solicitado a sair na próxima verificação de sessão. Se estiver on-line e usar a versão atual, isso ocorrerá em até 30 segundos; poderá entrar novamente depois.</AppText>{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title="Registrar pedido de saída" variant="danger" onPress={forceLogout} loading={busy} /><ActionButton title="Cancelar" variant="outline" onPress={() => setLogoutTarget(null)} disabled={busy} /></SurfaceCard></View></Modal>
      <Modal visible={Boolean(deleteBroadcastTarget)} transparent animationType="fade" onRequestClose={() => setDeleteBroadcastTarget(null)}><View style={styles.backdrop}><SurfaceCard style={styles.modalCard}><AppText variant="subtitle">Remover comunicado?</AppText><AppText variant="body" color={colors.muted}>“{deleteBroadcastTarget?.title}” deixará de aparecer para todos os usuários. Essa remoção não apaga nenhum dado de ponto.</AppText>{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title="Remover comunicado" variant="danger" onPress={removeBroadcast} loading={busy} /><ActionButton title="Cancelar" variant="outline" onPress={() => setDeleteBroadcastTarget(null)} disabled={busy} /></SurfaceCard></View></Modal>
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
  presetChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  broadcastText: { minHeight: 112, textAlignVertical: 'top' },
  broadcastRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  backdrop: { flex: 1, backgroundColor: '#081A1880', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 },
});
