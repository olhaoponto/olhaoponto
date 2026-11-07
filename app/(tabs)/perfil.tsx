import { useEffect, useState } from 'react';
import { Appearance, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, BackNavigationButton, KeyboardModalContent, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { changePassword, deleteAccount, logout, updateEmail, updateProfile } from '@/services/auth-service';
import { exportJson } from '@/services/export-service';
import { loadAllEntries, syncPendingEntries } from '@/services/time-entry-service';
import { useAppStore } from '@/store/app-store';
import { useThemeContext } from '@/lib/theme-provider';
import type { AlertPreferences, WorkSchedule } from '@/types/app';
import { DEFAULT_WORK_SCHEDULE, getActiveWorkSchedule, getExpectedWorkMinutes, getWorkSchedules, validateWorkSchedule } from '@/utils/work-schedules';

const isStrong = (value: string) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function PerfilScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const { setColorScheme } = useThemeContext();
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
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [draftSchedule, setDraftSchedule] = useState<WorkSchedule>({ ...DEFAULT_WORK_SCHEDULE, id: 'schedule-draft' });
  const prefs: AlertPreferences = profile?.preferencias_alerta || {};
  const schedules = getWorkSchedules(prefs, profile?.almoco_minutos ?? 60);
  const activeSchedule = getActiveWorkSchedule(prefs, profile?.almoco_minutos ?? 60);
  const selectedTheme = typeof prefs.tema === 'string' ? prefs.tema : 'system';
  const profileId = profile?.id;
  const profileName = profile?.nome || '';
  const profileEmail = profile?.email || '';

  // Draft fields follow profile changes from Auth; user edits remain local until Save.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setName(profileName); setEmail(profileEmail); }, [profileId, profileName, profileEmail]);
  useEffect(() => { if (profileId) void AsyncStorage.getItem(`olhaponto:${profileId}:biometric`).then((value) => setBiometricEnabled(value === 'true')).catch(() => setBiometricEnabled(false)); }, [profileId]);

  const savePreferences = async (patch: Partial<AlertPreferences>, columns: Record<string, number> = {}) => {
    if (!profile) return;
    setSaving(true); setError(''); setMessage('');
    const merged = { ...prefs, ...patch };
    const result = await updateProfile({ ...columns, preferencias_alerta: merged } as Parameters<typeof updateProfile>[0]);
    setSaving(false);
    if (result.error || !result.data) { setError(result.error || 'Não foi possível salvar a preferência.'); return; }
    setProfile(result.data);
    setMessage('Preferência atualizada.');
  };

  const saveSchedule = async () => {
    if (!profile) return;
    const validationMessage = validateWorkSchedule(draftSchedule);
    if (validationMessage) { setScheduleError(validationMessage); return; }
    const existing = schedules.some((schedule) => schedule.id === draftSchedule.id);
    const nextSchedules = existing
      ? schedules.map((schedule) => schedule.id === draftSchedule.id ? { ...draftSchedule, name: draftSchedule.name.trim() } : schedule)
      : [...schedules, { ...draftSchedule, name: draftSchedule.name.trim() }];
    const merged = { ...prefs, work_schedules: nextSchedules, active_work_schedule_id: draftSchedule.id };
    setSaving(true); setError(''); setScheduleError('');
    const result = await updateProfile({ preferencias_alerta: merged, almoco_minutos: draftSchedule.lunch_minutes });
    setSaving(false);
    if (result.error || !result.data) { setScheduleError(result.error || 'Não foi possível salvar a jornada.'); return; }
    setProfile(result.data);
    setScheduleModal(false);
    setMessage('Jornada salva e selecionada para os próximos alertas.');
  };

  const selectSchedule = async (schedule: WorkSchedule) => {
    await savePreferences({ active_work_schedule_id: schedule.id }, { almoco_minutos: schedule.lunch_minutes });
  };

  const saveActiveLunchMinutes = async (value: number) => {
    const nextSchedules = schedules.map((schedule) => schedule.id === activeSchedule.id ? { ...schedule, lunch_minutes: value } : schedule);
    await savePreferences({ work_schedules: nextSchedules }, { almoco_minutos: value });
  };

  const openScheduleEditor = (schedule?: WorkSchedule) => {
    setDraftSchedule(schedule ? { ...schedule, work_days: [...schedule.work_days] } : {
      ...DEFAULT_WORK_SCHEDULE,
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Jornada ${schedules.length + 1}`,
      lunch_minutes: profile?.almoco_minutos ?? 60,
    });
    setScheduleError('');
    setScheduleModal(true);
  };

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

  const chooseTheme = async (theme: 'system' | 'light' | 'dark') => {
    if (theme === 'system') setColorScheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
    else setColorScheme(theme);
    await savePreferences({ tema: theme });
  };

  const toggleBiometrics = async (value: boolean) => {
    if (value) {
      const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (!hardware || !enrolled) { setError('Cadastre uma biometria nas configurações do aparelho antes de ativar esta opção.'); return; }
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirme para ativar a biometria no Olha o Ponto', cancelLabel: 'Cancelar' });
      if (!auth.success) return;
    }
    if (!profile) return;
    try {
      const key = `olhaponto:${profile.id}:biometric`;
      if (value) await AsyncStorage.setItem(key, 'true'); else await AsyncStorage.removeItem(key);
      setBiometricEnabled(value);
      setMessage(value ? 'Biometria ativada neste aparelho.' : 'Biometria desativada neste aparelho.');
      setError('');
    } catch { setError('Não foi possível salvar a preferência de biometria neste aparelho.'); }
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

  const handleLogout = async () => {
    setSaving(true); setError('');
    const synced = await syncPendingEntries();
    if (!synced.data || synced.data.failed > 0) {
      setSaving(false);
      setError(synced.error || 'Há batidas aguardando sincronização. Conecte-se à internet e tente novamente antes de sair.');
      return;
    }
    await logout();
    setSaving(false);
    router.replace('/login');
  };
  const roleLabel = profile?.role === 'admin' ? 'Administrador' : 'Usuário';

  if (!profile) return <ScreenShell><AppText variant="body">Carregando perfil...</AppText></ScreenShell>;

  return (
    <ScreenShell contentStyle={styles.page}>
      <BackNavigationButton label="Voltar ao Hoje" onPress={() => router.replace('/(tabs)/index')} />
      <PageHeading eyebrow="Suas preferências" title="Perfil" subtitle="Conta e controles pessoais." right={<View style={[styles.avatar, { backgroundColor: `${colors.teal}25` }]}><AppText variant="title" color={colors.deepTeal}>{profile.nome.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</AppText></View>} />
      <SurfaceCard style={styles.identityCard}><View style={{ flex: 1, gap: 4 }}><AppText variant="subtitle">{profile.nome}</AppText><AppText variant="small" color={colors.muted}>{profile.email}</AppText></View><StatusPill tone={profile.role === 'admin' ? 'yellow' : 'teal'}>{roleLabel.toUpperCase()}</StatusPill></SurfaceCard>
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
        <AppText variant="subtitle">Limites e almoço</AppText>
        <AppText variant="small" color={colors.muted}>Limite diário pessoal · nunca acima de 10h</AppText>
        <View style={styles.choices}>{[480, 540, 600].map((value) => <Pressable key={value} onPress={() => savePreferences({}, { limite_minutos: value })} accessibilityRole="button" accessibilityState={{ selected: profile.limite_minutos === value }} style={[styles.choice, { borderColor: profile.limite_minutos === value ? colors.deepTeal : colors.border, backgroundColor: profile.limite_minutos === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={profile.limite_minutos === value ? colors.deepTeal : colors.foreground}>{formatLimit(value)}</AppText></Pressable>)}</View>
        <AppText variant="small" color={colors.muted}>Duração prevista do almoço</AppText>
        <View style={styles.choices}>{[30, 45, 60, 90].map((value) => <Pressable key={value} onPress={() => saveActiveLunchMinutes(value)} accessibilityRole="button" accessibilityState={{ selected: activeSchedule.lunch_minutes === value }} style={[styles.choice, { borderColor: activeSchedule.lunch_minutes === value ? colors.deepTeal : colors.border, backgroundColor: activeSchedule.lunch_minutes === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={activeSchedule.lunch_minutes === value ? colors.deepTeal : colors.foreground}>{value} min</AppText></Pressable>)}</View>
        <AppText variant="tiny" color={colors.muted}>O almoço selecionado na jornada ativa é usado para projetar a saída e calcular o aviso de retorno; o intervalo real não conta como hora trabalhada.</AppText>
      </SurfaceCard>

      <SurfaceCard style={{ gap: 12 }}>
        <AppText variant="subtitle">Jornadas de trabalho</AppText>
        <AppText variant="small" color={colors.muted}>Escolha uma jornada para os alertas de início, almoço e fim. O padrão é 08:00–18:00, com 1h de almoço, de segunda a quinta; na sexta, 08:00–17:00, também com 1h.</AppText>
        {schedules.map((schedule) => {
          const selected = schedule.id === activeSchedule.id;
          const days = schedule.work_days.map((day) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day]).join(' · ');
          return <View key={schedule.id} style={[styles.scheduleRow, { borderColor: selected ? colors.deepTeal : colors.border, backgroundColor: selected ? `${colors.teal}12` : colors.input }]}>
            <Pressable style={{ flex: 1, gap: 4 }} onPress={() => void selectSchedule(schedule)} accessibilityRole="button" accessibilityState={{ selected }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AppText variant="small" style={{ fontWeight: '700' }}>{schedule.name}</AppText>{selected ? <StatusPill tone="teal">ATIVA</StatusPill> : null}</View>
              <AppText variant="small" color={colors.muted}>{schedule.start_time}–{schedule.end_time} · {schedule.lunch_minutes} min almoço · {formatLimit(getExpectedWorkMinutes(schedule))} líquidas</AppText>
              <AppText variant="tiny" color={colors.muted}>{days}</AppText>
            </Pressable>
            <Pressable onPress={() => openScheduleEditor(schedule)} accessibilityRole="button" accessibilityLabel={`Editar ${schedule.name}`} style={styles.editSchedule}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.deepTeal} /></Pressable>
          </View>;
        })}
        <ActionButton title="Adicionar outra jornada" variant="outline" onPress={() => openScheduleEditor()} />
        <AppText variant="tiny" color={colors.muted}>O alerta de jornada completa usa o horário final fixo da jornada ativa, mesmo se a entrada ocorrer mais tarde. O teto de segurança de 10h trabalhadas continua valendo.</AppText>
      </SurfaceCard>

      <SurfaceCard>
        <AppText variant="subtitle">Alertas e aparência</AppText>
        <AppText variant="small" color={colors.muted}>Aviso de retorno antes do fim do almoço</AppText>
        <View style={styles.choices}>{[5, 10, 15].map((value) => <Pressable key={value} onPress={() => savePreferences({ lunch_return_warning_minutes: value })} accessibilityRole="button" accessibilityState={{ selected: (prefs.lunch_return_warning_minutes ?? 5) === value }} style={[styles.choice, { borderColor: (prefs.lunch_return_warning_minutes ?? 5) === value ? colors.deepTeal : colors.border, backgroundColor: (prefs.lunch_return_warning_minutes ?? 5) === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={(prefs.lunch_return_warning_minutes ?? 5) === value ? colors.deepTeal : colors.foreground}>{value} min antes</AppText></Pressable>)}</View>
        <PreferenceSwitch label="Notificações de jornada" value={prefs.enabled !== false} onChange={(value) => savePreferences({ enabled: value })} />
        <PreferenceSwitch label="Som de alerta" value={prefs.som !== false} onChange={(value) => savePreferences({ som: value })} />
        <PreferenceSwitch label="Vibração" value={prefs.vibracao !== false} onChange={(value) => savePreferences({ vibracao: value })} />
        <PreferenceSwitch label="Rotação do contador Hoje" value={prefs.rotacao_contador !== false} onChange={(value) => savePreferences({ rotacao_contador: value })} />
        <AppText variant="tiny" color={colors.muted}>Desative para manter o contador sempre na posição vertical, mesmo ao girar o aparelho. A rotação fica limitada à tela Hoje.</AppText>
        <PreferenceSwitch label="Biometria ao abrir" value={biometricEnabled} onChange={toggleBiometrics} />
        <AppText variant="small" color={colors.muted}>Tema</AppText>
        <View style={styles.choices}>{(['system', 'light', 'dark'] as const).map((theme) => <Pressable key={theme} onPress={() => chooseTheme(theme)} accessibilityRole="button" accessibilityState={{ selected: selectedTheme === theme }} style={[styles.choice, { borderColor: selectedTheme === theme ? colors.deepTeal : colors.border, backgroundColor: selectedTheme === theme ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={selectedTheme === theme ? colors.deepTeal : colors.foreground}>{theme === 'system' ? 'Sistema' : theme === 'light' ? 'Claro' : 'Escuro'}</AppText></Pressable>)}</View>
      </SurfaceCard>

      <SurfaceCard>
        <AppText variant="subtitle">Seus dados</AppText>
        <AppText variant="small" color={colors.muted}>Exporte seus registros pessoais ou revise os termos aceitos.</AppText>
        <ActionButton title="Exportar meus dados (JSON)" variant="outline" onPress={exportAll} loading={exporting} />
        <ActionButton title="Termos de uso e privacidade" variant="ghost" onPress={() => router.push('/terms')} />
        <ActionButton title="Sobre o aplicativo" variant="ghost" onPress={() => router.push('/about')} />
        {profile.role === 'admin' ? <ActionButton title="Administração de contas" variant="secondary" onPress={() => router.push('/admin')} icon={<MaterialCommunityIcons name="account-cog-outline" size={19} color={colors.deepTeal} />} /> : null}
      </SurfaceCard>

      <SurfaceCard style={{ borderColor: `${colors.error}60` }}>
        <AppText variant="subtitle" color={colors.error}>Zona de segurança</AppText>
        <AppText variant="small" color={colors.muted}>Apagar minha conta remove seu perfil e todas as batidas e preferências associadas. Essa ação não pode ser desfeita.</AppText>
        <ActionButton title="APAGAR MINHA CONTA" variant="danger" onPress={() => { setDeleteWord(''); setError(''); setDeleteModal(true); }} />
        <ActionButton title="Sair da conta" variant="outline" onPress={handleLogout} />
      </SurfaceCard>

      <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Olha o Ponto · versão 1.0.0</AppText>

      <Modal visible={scheduleModal} transparent animationType="fade" onRequestClose={() => setScheduleModal(false)}>
        <KeyboardModalContent><SurfaceCard style={styles.modalCard}>
          <View style={styles.modalHead}><AppText variant="subtitle">Configurar jornada</AppText><Pressable onPress={() => setScheduleModal(false)} accessibilityRole="button"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View>
          <TextField label="Nome" value={draftSchedule.name} onChangeText={(value) => setDraftSchedule((current) => ({ ...current, name: value }))} placeholder="Ex.: Jornada comercial" maxLength={50} />
          <View style={styles.timeFields}><TextField label="Início (HH:mm)" value={draftSchedule.start_time} onChangeText={(value) => setDraftSchedule((current) => ({ ...current, start_time: value }))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="08:00" /><TextField label="Fim (HH:mm)" value={draftSchedule.end_time} onChangeText={(value) => setDraftSchedule((current) => ({ ...current, end_time: value }))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="18:00" /></View>
          <AppText variant="small" color={colors.muted}>Duração do almoço</AppText>
          <View style={styles.choices}>{[30, 45, 60, 90, 120].map((value) => <Pressable key={value} onPress={() => setDraftSchedule((current) => ({ ...current, lunch_minutes: value }))} accessibilityRole="button" accessibilityState={{ selected: draftSchedule.lunch_minutes === value }} style={[styles.choice, { borderColor: draftSchedule.lunch_minutes === value ? colors.deepTeal : colors.border, backgroundColor: draftSchedule.lunch_minutes === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={draftSchedule.lunch_minutes === value ? colors.deepTeal : colors.foreground}>{value} min</AppText></Pressable>)}</View>
          <AppText variant="small" color={colors.muted}>Dias de trabalho</AppText>
          <View style={styles.choices}>{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, day) => {
            const selected = draftSchedule.work_days.includes(day);
            return <Pressable key={day} onPress={() => setDraftSchedule((current) => ({ ...current, work_days: selected ? current.work_days.filter((value) => value !== day) : [...current.work_days, day].sort((a, b) => a - b) }))} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.choice, { borderColor: selected ? colors.deepTeal : colors.border, backgroundColor: selected ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={selected ? colors.deepTeal : colors.foreground}>{label}</AppText></Pressable>;
          })}</View>
          {scheduleError ? <AppText variant="small" color={colors.error}>{scheduleError}</AppText> : null}
          <ActionButton title="Salvar jornada" onPress={saveSchedule} loading={saving} />
          <ActionButton title="Cancelar" variant="outline" onPress={() => setScheduleModal(false)} />
        </SurfaceCard></KeyboardModalContent>
      </Modal>

      <Modal visible={passwordModal} transparent animationType="fade" onRequestClose={() => setPasswordModal(false)}><KeyboardModalContent><SurfaceCard style={styles.modalCard}><View style={styles.modalHead}><AppText variant="subtitle">Alterar senha</AppText><Pressable onPress={() => setPasswordModal(false)} accessibilityRole="button"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View><TextField label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" /><TextField label="Confirmar nova senha" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" /><AppText variant="tiny" color={colors.muted}>Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</AppText><PreferenceSwitch label="Mostrar senha" value={showPassword} onChange={setShowPassword} />{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title="Salvar senha" onPress={saveNewPassword} loading={saving} /><ActionButton title="Cancelar" variant="outline" onPress={() => setPasswordModal(false)} /></SurfaceCard></KeyboardModalContent></Modal>
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}><KeyboardModalContent><SurfaceCard style={styles.modalCard}><AppText variant="title" color={colors.error}>Excluir sua conta?</AppText><AppText variant="body">Confirme digitando APAGAR. Seu usuário, perfil, batidas e preferências serão removidos permanentemente.</AppText><TextField label="Digite APAGAR" value={deleteWord} onChangeText={setDeleteWord} autoCapitalize="characters" autoCorrect={false} /><AppText variant="tiny" color={colors.muted}>Você será desconectado assim que a exclusão for concluída.</AppText>{error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}<ActionButton title="Excluir conta definitivamente" variant="danger" onPress={handleDelete} loading={saving} disabled={deleteWord !== 'APAGAR'} /><ActionButton title="Cancelar" variant="outline" onPress={() => setDeleteModal(false)} /></SurfaceCard></KeyboardModalContent></Modal>
    </ScreenShell>
  );
}

function formatLimit(minutes: number) { return `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}`; }
function PreferenceSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void | Promise<void> }) {
  const colors = useAppColors();
  return <View style={styles.switchRow}><AppText variant="small" style={{ flex: 1 }}>{label}</AppText><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.teal }} thumbColor={value ? colors.deepTeal : '#F2F5F3'} accessibilityRole="switch" accessibilityState={{ checked: value }} /></View>;
}

const styles = StyleSheet.create({
  page: { gap: 15, paddingTop: 18 },
  avatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  identityCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 66, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, alignItems: 'center' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  editSchedule: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24B3A21A' },
  timeFields: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DFEAE6' },
  backdrop: { flex: 1, backgroundColor: '#081A1880', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 13 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
