import { useEffect, useState } from 'react';
import { Appearance, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { ActionButton, AppText, KeyboardModalContent, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { updateProfile } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';
import { useThemeContext } from '@/lib/theme-provider';
import type { AlertPreferences, WorkSchedule, WorkScheduleDayOverride, Workday } from '@/types/app';
import { DEFAULT_WORK_SCHEDULE, getActiveWorkSchedule, getExpectedWorkMinutes, getWorkSchedules, validateWorkSchedule } from '@/utils/work-schedules';
import { getLunchReturnWarningMinutes, parseLunchReturnWarningMinutes } from '@/utils/lunch-return';
import { getLunchReminderMinutes, MAX_LUNCH_REMINDER_MINUTES, MIN_LUNCH_REMINDER_MINUTES } from '@/utils/alerts';

const WORK_ALERT_OPTIONS = [
  { key: 'alerta_8h', label: 'Jornada completa (8h)' },
  { key: 'alerta_9h', label: 'Lembrete de 9 horas' },
  { key: 'alerta_9h30', label: 'Lembrete de 9h30' },
  { key: 'alerta_9h45', label: 'Lembrete de 9h45' },
  { key: 'alerta_9h50', label: 'Lembrete de 9h50' },
  { key: 'alerta_9h55', label: 'Lembrete de 9h55' },
] as const;

export default function ConfiguracoesScreen() {
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const { setColorScheme } = useThemeContext();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [draftSchedule, setDraftSchedule] = useState<WorkSchedule>({ ...DEFAULT_WORK_SCHEDULE, id: 'schedule-draft' });
  const [customLunchReturnMinutes, setCustomLunchReturnMinutes] = useState('5');
  const [customLunchReminderMinutes, setCustomLunchReminderMinutes] = useState('240');
  const prefs: AlertPreferences = profile?.preferencias_alerta || {};
  const schedules = getWorkSchedules(prefs, profile?.almoco_minutos ?? 60);
  const activeSchedule = getActiveWorkSchedule(prefs, profile?.almoco_minutos ?? 60);
  const selectedTheme = typeof prefs.tema === 'string' ? prefs.tema : 'system';
  const profileId = profile?.id;
  const savedLunchReturnMinutes = getLunchReturnWarningMinutes(prefs.lunch_return_warning_minutes);
  const savedLunchReminderMinutes = getLunchReminderMinutes(prefs.lunch_reminder_minutes);

  // Keep the editable field aligned with the saved profile preference.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCustomLunchReturnMinutes(String(savedLunchReturnMinutes)); }, [profileId, savedLunchReturnMinutes]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCustomLunchReminderMinutes(String(savedLunchReminderMinutes)); }, [profileId, savedLunchReminderMinutes]);
  useEffect(() => { if (profileId) void AsyncStorage.getItem(`olhaponto:${profileId}:biometric`).then((value) => setBiometricEnabled(value === 'true')).catch(() => setBiometricEnabled(false)); }, [profileId]);

  const savePreferences = async (patch: Partial<AlertPreferences>, columns: Record<string, number> = {}) => {
    if (!profile) return;
    setSaving(true); setError(''); setMessage('');
    const merged = { ...prefs, ...patch };
    const result = await updateProfile({ ...columns, preferencias_alerta: merged } as Parameters<typeof updateProfile>[0]);
    setSaving(false);
    if (result.error || !result.data) { setError(result.error || 'Não foi possível salvar a configuração.'); return; }
    setProfile(result.data);
    setMessage('Configuração atualizada.');
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
    const nextSchedules = schedules.map((schedule) => {
      if (schedule.id !== activeSchedule.id) return schedule;
      const friday = schedule.day_overrides?.[5];
      const day_overrides = friday && friday.lunch_minutes === schedule.lunch_minutes
        ? { ...schedule.day_overrides, 5: { ...friday, lunch_minutes: value } }
        : schedule.day_overrides;
      return { ...schedule, lunch_minutes: value, day_overrides };
    });
    await savePreferences({ work_schedules: nextSchedules }, { almoco_minutos: value });
  };

  const saveCustomLunchReturnWarning = async () => {
    const minutes = parseLunchReturnWarningMinutes(customLunchReturnMinutes);
    if (minutes === null) { setError('Informe um número inteiro entre 1 e 180 minutos.'); return; }
    await savePreferences({ lunch_return_warning_minutes: minutes });
  };

  const saveCustomLunchReminder = async () => {
    const minutes = Number(customLunchReminderMinutes);
    if (!Number.isInteger(minutes) || minutes < MIN_LUNCH_REMINDER_MINUTES || minutes > MAX_LUNCH_REMINDER_MINUTES) {
      setError(`Informe um número inteiro entre ${MIN_LUNCH_REMINDER_MINUTES} e ${MAX_LUNCH_REMINDER_MINUTES} minutos.`);
      return;
    }
    await savePreferences({ lunch_reminder_minutes: minutes });
  };

  const openScheduleEditor = (schedule?: WorkSchedule) => {
    setDraftSchedule(schedule ? { ...schedule, work_days: [...schedule.work_days], day_overrides: schedule.day_overrides ? { ...schedule.day_overrides } : undefined } : {
      ...DEFAULT_WORK_SCHEDULE,
      day_overrides: undefined,
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Jornada ${schedules.length + 1}`,
      lunch_minutes: profile?.almoco_minutos ?? 60,
    });
    setScheduleError('');
    setScheduleModal(true);
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

  if (!profile) return <ScreenShell><AppText variant="body">Carregando configurações...</AppText></ScreenShell>;

  return (
    <ScreenShell contentStyle={styles.page}>
      <TabNavigationCard active={null} />
      <PageHeading eyebrow="Preferências do aplicativo" title="Configurações" subtitle="Ajuste jornada, avisos e aparência." right={<AccountMenuButton />} />
      {message ? <AppText variant="small" color={colors.deepTeal}>{message}</AppText> : null}
      {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}

      <SurfaceCard>
        <AppText variant="subtitle">Limites e almoço</AppText>
        <AppText variant="small" color={colors.muted}>Limite diário pessoal · nunca acima de 10h</AppText>
        <View style={styles.choices}>{[480, 540, 600].map((value) => <Pressable key={value} onPress={() => savePreferences({}, { limite_minutos: value })} accessibilityRole="button" accessibilityState={{ selected: profile.limite_minutos === value }} style={[styles.choice, { borderColor: profile.limite_minutos === value ? colors.deepTeal : colors.border, backgroundColor: profile.limite_minutos === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={profile.limite_minutos === value ? colors.deepTeal : colors.foreground}>{formatLimit(value)}</AppText></Pressable>)}</View>
        <AppText variant="small" color={colors.muted}>Duração do intervalo de almoço</AppText>
        <View style={styles.choices}>{[30, 45, 60, 90].map((value) => <Pressable key={value} onPress={() => saveActiveLunchMinutes(value)} accessibilityRole="button" accessibilityState={{ selected: activeSchedule.lunch_minutes === value }} style={[styles.choice, { borderColor: activeSchedule.lunch_minutes === value ? colors.deepTeal : colors.border, backgroundColor: activeSchedule.lunch_minutes === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={activeSchedule.lunch_minutes === value ? colors.deepTeal : colors.foreground}>{value} min</AppText></Pressable>)}</View>
        <AppText variant="tiny" color={colors.muted}>Depois da batida de saída para almoço, o retorno é calculado pela hora real registrada mais a duração escolhida. Exemplo: saída às 13:26 + 60 min = retorno às 14:26. Não há horário fixo para sair.</AppText>
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
              <AppText variant="small" color={colors.muted}>{scheduleDescription(schedule)}</AppText>
              <AppText variant="tiny" color={colors.muted}>{scheduleDurationDescription(schedule)}</AppText>
              <AppText variant="tiny" color={colors.muted}>{days}</AppText>
            </Pressable>
            <Pressable onPress={() => openScheduleEditor(schedule)} accessibilityRole="button" accessibilityLabel={`Editar ${schedule.name}`} style={styles.editSchedule}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.deepTeal} /></Pressable>
          </View>;
        })}
        <ActionButton title="Adicionar outra jornada" variant="outline" onPress={() => openScheduleEditor()} />
        <AppText variant="tiny" color={colors.muted}>O alerta de jornada completa usa o horário final fixo da jornada ativa, mesmo se a entrada ocorrer mais tarde. O teto de segurança de 10h trabalhadas continua valendo.</AppText>
      </SurfaceCard>

      <SurfaceCard>
        <AppText variant="subtitle">Alertas, aparência e segurança</AppText>
        <PreferenceSwitch label="Aviso preventivo antes do almoço" value={prefs.alerta_pausa_almoco !== false} onChange={(value) => savePreferences({ alerta_pausa_almoco: value })} />
        <TextField label={`Avisar após X minutos de trabalho (${MIN_LUNCH_REMINDER_MINUTES}–${MAX_LUNCH_REMINDER_MINUTES})`} value={customLunchReminderMinutes} onChangeText={setCustomLunchReminderMinutes} keyboardType="number-pad" maxLength={3} placeholder="240" />
        <StatusPill tone="teal">AVISO PREVENTIVO · {savedLunchReminderMinutes} MIN</StatusPill>
        <ActionButton title="Salvar antecedência do aviso de pausa" variant="outline" onPress={saveCustomLunchReminder} loading={saving} />
        <PreferenceSwitch label="Notificar antes de voltar do almoço" value={prefs.alerta_retorno_almoco !== false} onChange={(value) => savePreferences({ alerta_retorno_almoco: value })} />
        <AppText variant="small" color={colors.muted}>Aviso de retorno antes do fim do almoço</AppText>
        <View style={styles.choices}>{[5, 10, 15].map((value) => <Pressable key={value} onPress={() => savePreferences({ lunch_return_warning_minutes: value })} accessibilityRole="button" accessibilityState={{ selected: savedLunchReturnMinutes === value }} style={[styles.choice, { borderColor: savedLunchReturnMinutes === value ? colors.deepTeal : colors.border, backgroundColor: savedLunchReturnMinutes === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={savedLunchReturnMinutes === value ? colors.deepTeal : colors.foreground}>{value} min antes</AppText></Pressable>)}</View>
        <StatusPill tone="teal">AVISO ATUAL · {savedLunchReturnMinutes} MIN ANTES</StatusPill>
        <TextField label="Ou personalize a antecedência (1 a 180 min)" value={customLunchReturnMinutes} onChangeText={setCustomLunchReturnMinutes} keyboardType="number-pad" maxLength={3} placeholder="Ex.: 2" />
        <ActionButton title="Salvar antecedência personalizada" variant="outline" onPress={saveCustomLunchReturnWarning} loading={saving} />
        <PreferenceSwitch label="Notificações de jornada" value={prefs.enabled !== false} onChange={(value) => savePreferences({ enabled: value })} />
        <AppText variant="small" color={colors.muted}>Alertas de jornada que você quer receber</AppText>
        {WORK_ALERT_OPTIONS.map(({ key, label }) => <PreferenceSwitch key={key} label={label} value={prefs[key] !== false} onChange={(value) => savePreferences({ [key]: value })} />)}
        <PreferenceSwitch label="Aviso no fim da jornada programada" value={prefs.alerta_fim_jornada !== false} onChange={(value) => savePreferences({ alerta_fim_jornada: value })} />
        <AppText variant="tiny" color={colors.muted}>O aviso de bloqueio no limite pessoal — no máximo 10 horas — não pode ser desativado. Os alertas usam notificações locais e respeitam as permissões deste aparelho.</AppText>
        <PreferenceSwitch label="Som de alerta" value={prefs.som !== false} onChange={(value) => savePreferences({ som: value })} />
        <PreferenceSwitch label="Vibração" value={prefs.vibracao !== false} onChange={(value) => savePreferences({ vibracao: value })} />
        <PreferenceSwitch label="Rotação do contador Hoje" value={prefs.rotacao_contador !== false} onChange={(value) => savePreferences({ rotacao_contador: value })} />
        <AppText variant="tiny" color={colors.muted}>Desative para manter o contador sempre na posição vertical, mesmo ao girar o aparelho. A rotação fica limitada à tela Hoje.</AppText>
        <PreferenceSwitch label="Biometria ao abrir" value={biometricEnabled} onChange={toggleBiometrics} />
        <AppText variant="small" color={colors.muted}>Tema</AppText>
        <View style={styles.choices}>{(['system', 'light', 'dark'] as const).map((theme) => <Pressable key={theme} onPress={() => chooseTheme(theme)} accessibilityRole="button" accessibilityState={{ selected: selectedTheme === theme }} style={[styles.choice, { borderColor: selectedTheme === theme ? colors.deepTeal : colors.border, backgroundColor: selectedTheme === theme ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={selectedTheme === theme ? colors.deepTeal : colors.foreground}>{theme === 'system' ? 'Sistema' : theme === 'light' ? 'Claro' : 'Escuro'}</AppText></Pressable>)}</View>
      </SurfaceCard>

      <AppText variant="tiny" color={colors.muted} style={{ textAlign: 'center' }}>Olha o Ponto · versão 1.0.1</AppText>

      <Modal visible={scheduleModal} transparent animationType="fade" onRequestClose={() => setScheduleModal(false)}>
        <KeyboardModalContent><SurfaceCard style={styles.modalCard}>
          <View style={styles.modalHead}><AppText variant="subtitle">Configurar jornada</AppText><Pressable onPress={() => setScheduleModal(false)} accessibilityRole="button" accessibilityLabel="Fechar configuração de jornada"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View>
          <TextField label="Nome" value={draftSchedule.name} onChangeText={(value) => setDraftSchedule((current) => ({ ...current, name: value }))} placeholder="Ex.: Jornada comercial" maxLength={50} />
          <View style={styles.timeFields}><TextField label="Início (HH:mm)" value={draftSchedule.start_time} onChangeText={(value) => setDraftSchedule((current) => ({ ...current, start_time: value }))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="08:00" /><TextField label="Fim (HH:mm)" value={draftSchedule.end_time} onChangeText={(value) => setDraftSchedule((current) => ({ ...current, end_time: value }))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="18:00" /></View>
          <AppText variant="small" color={colors.muted}>Duração do almoço</AppText>
          <View style={styles.choices}>{[30, 45, 60, 90, 120].map((value) => <Pressable key={value} onPress={() => setDraftSchedule((current) => ({ ...current, lunch_minutes: value }))} accessibilityRole="button" accessibilityState={{ selected: draftSchedule.lunch_minutes === value }} style={[styles.choice, { borderColor: draftSchedule.lunch_minutes === value ? colors.deepTeal : colors.border, backgroundColor: draftSchedule.lunch_minutes === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={draftSchedule.lunch_minutes === value ? colors.deepTeal : colors.foreground}>{value} min</AppText></Pressable>)}</View>
          <AppText variant="small" color={colors.muted}>Dias de trabalho</AppText>
          <View style={styles.choices}>{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, day) => {
            const selected = draftSchedule.work_days.includes(day);
            return <Pressable key={day} onPress={() => setDraftSchedule((current) => toggleWorkDay(current, day))} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.choice, { borderColor: selected ? colors.deepTeal : colors.border, backgroundColor: selected ? `${colors.teal}20` : colors.input }]}><AppText variant="small" color={selected ? colors.deepTeal : colors.foreground}>{label}</AppText></Pressable>;
          })}</View>
          {draftSchedule.work_days.includes(5) ? <View style={{ gap: 9, paddingTop: 4 }}>
            <PreferenceSwitch label="Horário diferente na sexta-feira" value={Boolean(draftSchedule.day_overrides?.[5])} onChange={(enabled) => setDraftSchedule((current) => toggleFridayOverride(current, enabled))} />
            {draftSchedule.day_overrides?.[5] ? <>
              <AppText variant="tiny" color={colors.muted}>A sexta continua dentro desta mesma jornada ativa.</AppText>
              <View style={styles.timeFields}>
                <TextField label="Início de sexta" value={draftSchedule.day_overrides[5].start_time ?? draftSchedule.start_time} onChangeText={(value) => setDraftSchedule((current) => updateFridayOverride(current, 'start_time', value))} keyboardType="numbers-and-punctuation" maxLength={5} />
                <TextField label="Fim de sexta" value={draftSchedule.day_overrides[5].end_time ?? draftSchedule.end_time} onChangeText={(value) => setDraftSchedule((current) => updateFridayOverride(current, 'end_time', value))} keyboardType="numbers-and-punctuation" maxLength={5} />
              </View>
              <AppText variant="tiny" color={colors.muted}>Almoço na sexta-feira</AppText>
              <View style={styles.choices}>{[30, 45, 60, 90, 120].map((value) => <Pressable key={value} onPress={() => setDraftSchedule((current) => updateFridayOverride(current, 'lunch_minutes', value))} accessibilityRole="button" accessibilityState={{ selected: (draftSchedule.day_overrides?.[5]?.lunch_minutes ?? draftSchedule.lunch_minutes) === value }} style={[styles.choice, { borderColor: (draftSchedule.day_overrides?.[5]?.lunch_minutes ?? draftSchedule.lunch_minutes) === value ? colors.deepTeal : colors.border, backgroundColor: (draftSchedule.day_overrides?.[5]?.lunch_minutes ?? draftSchedule.lunch_minutes) === value ? `${colors.teal}20` : colors.input }]}><AppText variant="small">{value} min</AppText></Pressable>)}</View>
            </> : null}
          </View> : null}
          {scheduleError ? <AppText variant="small" color={colors.error}>{scheduleError}</AppText> : null}
          <ActionButton title="Salvar jornada" onPress={saveSchedule} loading={saving} />
          <ActionButton title="Cancelar" variant="outline" onPress={() => setScheduleModal(false)} />
        </SurfaceCard></KeyboardModalContent>
      </Modal>
    </ScreenShell>
  );
}

function formatLimit(minutes: number) { return `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}`; }
const weekdayLabels: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
function formatWorkDays(days: number[]) {
  const ordered = [...days].sort((a, b) => a - b);
  if (ordered.length >= 3 && ordered.every((day, index) => index === 0 || day === ordered[index - 1] + 1)) return `${weekdayLabels[ordered[0]]}–${weekdayLabels[ordered[ordered.length - 1]]}`;
  return ordered.map((day) => weekdayLabels[day]).join(', ');
}
function scheduleDescription(schedule: WorkSchedule) {
  const friday = schedule.day_overrides?.[5];
  const otherDays = schedule.work_days.filter((day) => day !== 5);
  const sections = otherDays.length ? [`${formatWorkDays(otherDays)} ${schedule.start_time}–${schedule.end_time}`] : [];
  if (schedule.work_days.includes(5)) sections.push(`Sex ${friday?.start_time ?? schedule.start_time}–${friday?.end_time ?? schedule.end_time}`);
  const fridayLunch = friday?.lunch_minutes ?? schedule.lunch_minutes;
  const lunch = friday && fridayLunch !== schedule.lunch_minutes ? `${schedule.lunch_minutes} min almoço nos outros dias · ${fridayLunch} min sexta` : `${schedule.lunch_minutes} min almoço`;
  return `${sections.join(' · ')} · ${lunch}`;
}
function scheduleDurationDescription(schedule: WorkSchedule) {
  const friday = schedule.day_overrides?.[5];
  if (!friday || !schedule.work_days.includes(5)) return `${formatLimit(getExpectedWorkMinutes(schedule))} líquidas`;
  const base = { ...schedule, day_overrides: undefined };
  const fridaySchedule = { ...schedule, ...friday, day_overrides: undefined };
  return `${formatLimit(getExpectedWorkMinutes(base))} nos demais dias · ${formatLimit(getExpectedWorkMinutes(fridaySchedule))} na sexta`;
}
function toggleWorkDay(schedule: WorkSchedule, day: number): WorkSchedule {
  const selected = schedule.work_days.includes(day);
  const work_days = selected ? schedule.work_days.filter((value) => value !== day) : [...schedule.work_days, day].sort((a, b) => a - b);
  const day_overrides = { ...schedule.day_overrides };
  if (selected) delete day_overrides[day as Workday];
  return { ...schedule, work_days, day_overrides: Object.keys(day_overrides).length ? day_overrides : undefined };
}
function toggleFridayOverride(schedule: WorkSchedule, enabled: boolean): WorkSchedule {
  if (!enabled) { const day_overrides = { ...schedule.day_overrides }; delete day_overrides[5]; return { ...schedule, day_overrides: Object.keys(day_overrides).length ? day_overrides : undefined }; }
  const end = schedule.end_time <= '17:00' ? schedule.end_time : '17:00';
  return { ...schedule, day_overrides: { ...schedule.day_overrides, 5: { start_time: schedule.start_time, end_time: end, lunch_minutes: schedule.lunch_minutes } } };
}
function updateFridayOverride(schedule: WorkSchedule, field: keyof WorkScheduleDayOverride, value: string | number): WorkSchedule {
  const current = schedule.day_overrides?.[5] ?? { start_time: schedule.start_time, end_time: '17:00', lunch_minutes: schedule.lunch_minutes };
  return { ...schedule, day_overrides: { ...schedule.day_overrides, 5: { ...current, [field]: value } } };
}
function PreferenceSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void | Promise<void> }) {
  const colors = useAppColors();
  return <View style={styles.switchRow}><AppText variant="small" style={{ flex: 1 }}>{label}</AppText><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.teal }} thumbColor={value ? colors.deepTeal : '#F2F5F3'} accessibilityRole="switch" accessibilityState={{ checked: value }} /></View>;
}

const styles = StyleSheet.create({
  page: { gap: 15, paddingTop: 18 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 66, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, borderWidth: 1, alignItems: 'center' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  editSchedule: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24B3A21A' },
  timeFields: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DFEAE6' },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 13 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
