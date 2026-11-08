import { useEffect, useState } from 'react';
import { Keyboard, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { ActionButton, AppText, KeyboardModalContent, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { loadAgendaMeetings, saveAgendaMeetings } from '@/services/agenda-service';
import { prepareLocalNotifications, scheduleMeetingNotifications } from '@/services/notification-service';
import { useAppStore } from '@/store/app-store';
import type { AgendaMeeting } from '@/types/app';
import { formatAgendaDateInput, formatAgendaDateTime, formatAgendaTimeInput, parseAgendaDateTime, parseAgendaReminderMinutes } from '@/utils/agenda';

function nextHour(): Date {
  const value = new Date();
  value.setMinutes(value.getMinutes() + 60, 0, 0);
  return value;
}

export default function AgendaScreen() {
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const profileId = profile?.id;
  const soundEnabled = profile?.preferencias_alerta?.som !== false;
  const vibrationEnabled = profile?.preferencias_alerta?.vibracao !== false;
  const [meetings, setMeetings] = useState<AgendaMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState<boolean | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgendaMeeting | null>(null);
  const [editing, setEditing] = useState<AgendaMeeting | null>(null);
  const [title, setTitle] = useState('');
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [reminderText, setReminderText] = useState('5');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const initial = setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;
    if (!userId) {
      const deferred = setTimeout(() => {
        if (!active) return;
        setMeetings([]);
        setLoading(false);
        setError('Entre na sua conta para abrir a Agenda.');
      }, 0);
      return () => { active = false; clearTimeout(deferred); };
    }
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        return Promise.all([loadAgendaMeetings(userId), Notifications.getPermissionsAsync()] as const);
      })
      .then(async (result) => {
        if (!active || !result) return;
        const [items, permission] = result;
        if (!active) return;
        setMeetings(items);
        setNotificationsGranted(permission.status === 'granted');
        if (profileId === userId) {
          await scheduleMeetingNotifications(items, {
            userId,
            soundEnabled,
            vibrationEnabled,
          }).catch(() => undefined);
        }
      })
      .catch(() => { if (active) setError('Não foi possível carregar a Agenda neste aparelho.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.user.id, profileId, soundEnabled, vibrationEnabled]);

  const resetForm = () => {
    const initial = nextHour();
    setEditing(null);
    setTitle('');
    setDateText(formatAgendaDateInput(initial));
    setTimeText(formatAgendaTimeInput(initial));
    setReminderText('5');
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setNotice('');
    setFormVisible(true);
  };

  const openEdit = (meeting: AgendaMeeting) => {
    const startsAt = new Date(meeting.starts_at);
    setEditing(meeting);
    setTitle(meeting.title);
    setDateText(formatAgendaDateInput(startsAt));
    setTimeText(formatAgendaTimeInput(startsAt));
    setReminderText(String(meeting.reminder_minutes));
    setError('');
    setNotice('');
    setFormVisible(true);
  };

  const persistAndSchedule = async (next: AgendaMeeting[]) => {
    const userId = session?.user.id;
    if (!userId) throw new Error('Sua sessão não está ativa. Entre novamente para alterar a Agenda.');
    await saveAgendaMeetings(userId, next);
    setMeetings(next);
    let permissionGranted = false;
    try {
      permissionGranted = (await prepareLocalNotifications()).granted;
    } catch {
      permissionGranted = false;
    }
    setNotificationsGranted(permissionGranted);
    try {
      const result = await scheduleMeetingNotifications(next, {
        userId,
        soundEnabled,
        vibrationEnabled,
      });
      setNotificationsGranted(result.permissionGranted);
      return result;
    } catch {
      return { permissionGranted: false, scheduledCount: 0 };
    }
  };

  const saveMeeting = async () => {
    const cleanTitle = title.trim();
    const startsAt = parseAgendaDateTime(dateText, timeText);
    const reminderMinutes = parseAgendaReminderMinutes(reminderText);
    if (!cleanTitle) { setError('Informe o título da reunião.'); return; }
    if (!startsAt) { setError('Informe uma data válida no formato DD/MM/AAAA e uma hora no formato HH:mm.'); return; }
    if (startsAt.getTime() <= Date.now()) { setError('A data e a hora da reunião precisam estar no futuro.'); return; }
    if (reminderMinutes === null) { setError('O aviso deve ser um número inteiro entre 1 e 1440 minutos.'); return; }
    if (!session?.user.id) { setError('Entre na sua conta para salvar a reunião.'); return; }

    Keyboard.dismiss();
    setSaving(true);
    setError('');
    try {
      const meeting: AgendaMeeting = {
        id: editing?.id ?? `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: cleanTitle,
        starts_at: startsAt.toISOString(),
        reminder_minutes: reminderMinutes,
      };
      const next = [...meetings.filter((item) => item.id !== meeting.id), meeting].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const result = await persistAndSchedule(next);
      setFormVisible(false);
      setNotice(result.permissionGranted
        ? 'Reunião salva e lembrete programado neste aparelho.'
        : 'Reunião salva. Ative as notificações do aplicativo para receber o lembrete.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a reunião.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMeeting = async () => {
    if (!deleteTarget || !session?.user.id) return;
    setSaving(true);
    setError('');
    try {
      const next = meetings.filter((item) => item.id !== deleteTarget.id);
      const result = await persistAndSchedule(next);
      setDeleteTarget(null);
      setNotice(result.permissionGranted ? 'Reunião removida e lembrete cancelado.' : 'Reunião removida.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover a reunião.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell contentStyle={styles.page}>
      <TabNavigationCard active={null} />
      <PageHeading eyebrow="Organize seu dia" title="Agenda" subtitle="Reuniões com lembretes no seu aparelho." right={<AccountMenuButton />} />

      <SurfaceCard style={styles.introCard}>
        <View style={styles.introIcon}><MaterialCommunityIcons name="calendar-clock-outline" size={25} color={colors.deepTeal} /></View>
        <AppText variant="subtitle">Seus compromissos, no seu ritmo</AppText>
        <AppText variant="small" color={colors.muted}>Cadastre uma reunião e escolha quantos minutos antes quer ser avisado. O lembrete pode chegar mesmo com o aplicativo fechado, desde que as notificações estejam permitidas no aparelho.</AppText>
        <AppText variant="tiny" color={colors.muted}>Privacidade: a Agenda fica somente neste aparelho, não sincroniza com outros dispositivos e é apagada ao sair da conta.</AppText>
        {notificationsGranted === false && Platform.OS !== 'web' ? <Pressable onPress={() => { void Linking.openSettings().catch(() => undefined); }} accessibilityRole="button"><AppText variant="small" color={colors.deepTeal}>Abrir configurações de notificações</AppText></Pressable> : null}
      </SurfaceCard>

      {notice ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{notice}</AppText> : null}
      {error && !formVisible && !deleteTarget ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
      <ActionButton title="Adicionar reunião" onPress={openCreate} icon={<MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />} />

      {loading ? <SurfaceCard><AppText variant="body" color={colors.muted}>Carregando sua Agenda...</AppText></SurfaceCard> : meetings.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={38} color={colors.teal} />
          <AppText variant="subtitle">Sua agenda está livre</AppText>
          <AppText variant="small" color={colors.muted}>Adicione sua próxima reunião para receber um lembrete na hora certa.</AppText>
        </SurfaceCard>
      ) : meetings.map((meeting) => {
        const past = currentTime !== null && new Date(meeting.starts_at).getTime() <= currentTime;
        return (
          <SurfaceCard key={meeting.id} style={styles.meetingCard}>
            <View style={styles.meetingTop}>
              <View style={{ flex: 1, gap: 5 }}>
                <AppText variant="subtitle">{meeting.title}</AppText>
                <AppText variant="small" color={colors.muted}>{formatAgendaDateTime(meeting.starts_at)}</AppText>
                <AppText variant="tiny" color={colors.deepTeal}>{past ? 'Reunião encerrada' : `Aviso ${meeting.reminder_minutes} min antes`}</AppText>
              </View>
              {past ? <StatusPill tone="neutral">PASSOU</StatusPill> : <StatusPill tone="teal">AGENDADA</StatusPill>}
            </View>
            <View style={styles.meetingActions}>
              <Pressable onPress={() => openEdit(meeting)} accessibilityRole="button" accessibilityLabel={`Editar ${meeting.title}`} style={[styles.iconButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="pencil-outline" size={19} color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>Editar</AppText></Pressable>
              <Pressable onPress={() => { setDeleteTarget(meeting); setError(''); }} accessibilityRole="button" accessibilityLabel={`Excluir ${meeting.title}`} style={[styles.iconButton, { borderColor: `${colors.error}55` }]}><MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.error} /><AppText variant="small" color={colors.error}>Excluir</AppText></Pressable>
            </View>
          </SurfaceCard>
        );
      })}

      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={() => setFormVisible(false)}>
        <KeyboardModalContent>
          <SurfaceCard style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <AppText variant="subtitle">{editing ? 'Editar reunião' : 'Nova reunião'}</AppText>
              <Pressable onPress={() => setFormVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar formulário"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable>
            </View>
            <TextField label="Título" value={title} onChangeText={setTitle} placeholder="Ex.: Reunião de equipe" maxLength={80} autoCapitalize="sentences" />
            <TextField label="Data (DD/MM/AAAA)" value={dateText} onChangeText={setDateText} placeholder="07/11/2026" keyboardType="numbers-and-punctuation" maxLength={10} />
            <TextField label="Horário (HH:mm)" value={timeText} onChangeText={setTimeText} placeholder="14:30" keyboardType="numbers-and-punctuation" maxLength={5} />
            <TextField label="Avisar quantos minutos antes?" value={reminderText} onChangeText={setReminderText} placeholder="5" keyboardType="number-pad" maxLength={4} />
            <AppText variant="tiny" color={colors.muted}>Use um número inteiro de 1 a 1440 minutos. Exemplo: 5 minutos antes.</AppText>
            {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
            <ActionButton title={editing ? 'Salvar alterações' : 'Salvar reunião'} onPress={saveMeeting} loading={saving} />
            <ActionButton title="Cancelar" variant="outline" onPress={() => setFormVisible(false)} disabled={saving} />
          </SurfaceCard>
        </KeyboardModalContent>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <KeyboardModalContent>
          <SurfaceCard style={styles.modalCard}>
            <AppText variant="subtitle">Excluir reunião?</AppText>
            <AppText variant="small" color={colors.muted}>{deleteTarget?.title} será removida e o lembrete local cancelado.</AppText>
            {error && deleteTarget ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
            <ActionButton title="Excluir reunião" variant="danger" onPress={deleteMeeting} loading={saving} />
            <ActionButton title="Manter reunião" variant="outline" onPress={() => setDeleteTarget(null)} disabled={saving} />
          </SurfaceCard>
        </KeyboardModalContent>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, paddingTop: 18 },
  introCard: { gap: 9 },
  introIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24B3A218' },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 26 },
  meetingCard: { gap: 14 },
  meetingTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  meetingActions: { flexDirection: 'row', gap: 10 },
  iconButton: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 13 },
  modalCard: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 12 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
