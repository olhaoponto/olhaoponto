import { useCallback, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, ClockMascot, SurfaceCard, StatusPill, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import type { BroadcastMessage, LunchColleague, LunchInviteStatus, LunchInviteSummary } from '@/types/app';
import { acknowledgeBroadcast, loadActiveColleagues, loadHomeCommunications, replyToLunchInvite, sendLunchInvite } from '@/services/communications-service';

const zoneDefault = 'America/Bahia';
function clock(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function HomeCommunications({ lunchMinutes, lunchStarted, ended }: {
  lunchMinutes: number;
  lunchStarted: boolean;
  ended: boolean;
}) {
  const colors = useAppColors();
  const session = useAppStore((state) => state.session);
  const profile = useAppStore((state) => state.profile);
  const userId = session?.user.id;
  const focused = useRef(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [invites, setInvites] = useState<LunchInviteSummary[]>([]);
  const [inviteModal, setInviteModal] = useState(false);
  const [colleagues, setColleagues] = useState<LunchColleague[]>([]);
  const [loadingColleagues, setLoadingColleagues] = useState(false);
  const [savingInvite, setSavingInvite] = useState(false);
  const [respondingId, setRespondingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!userId) { setBroadcasts([]); setInvites([]); return; }
    const result = await loadHomeCommunications(userId);
    if (!focused.current || !result.data) return;
    setBroadcasts(result.data.broadcasts);
    setInvites(result.data.invites);
  }, [userId]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30_000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { focused.current = false; clearInterval(timer); listener.remove(); };
  }, [refresh]));

  const dismissBroadcast = async (message: BroadcastMessage) => {
    if (!userId) return;
    const result = await acknowledgeBroadcast(message.id, userId);
    if (result.error) { setError(result.error); return; }
    setBroadcasts((current) => current.filter((item) => item.id !== message.id));
    setError('');
  };

  const openInvitePicker = async () => {
    setInviteModal(true); setError(''); setNotice(''); setLoadingColleagues(true);
    const result = await loadActiveColleagues();
    setLoadingColleagues(false);
    if (result.data) setColleagues(result.data);
    else { setColleagues([]); setError(result.error || 'Não foi possível carregar colegas com acesso ativo.'); }
  };

  const inviteColleague = async (colleague: LunchColleague) => {
    if (!profile || !userId) return;
    setSavingInvite(true); setError(''); setNotice('');
    const lunchAt = new Date();
    const returnAt = new Date(lunchAt.getTime() + lunchMinutes * 60_000);
    const message = `Olá, ${colleague.nome}! O mascote do Olha o Ponto está me chamando para almoçar com você. Você consegue? Saída proposta às ${clock(lunchAt, profile.fuso || zoneDefault)} e retorno previsto às ${clock(returnAt, profile.fuso || zoneDefault)}.`;
    const result = await sendLunchInvite({ recipient_id: colleague.id, lunch_at: lunchAt.toISOString(), return_at: returnAt.toISOString(), message });
    setSavingInvite(false);
    if (result.error) { setError(result.error); return; }
    setNotice(`Convite enviado para ${colleague.nome}.`);
    setInviteModal(false);
    await refresh();
  };

  const reply = async (invite: LunchInviteSummary, status: Exclude<LunchInviteStatus, 'pending'>) => {
    const messages: Record<Exclude<LunchInviteStatus, 'pending'>, string> = {
      accepted: 'Posso sim! Vamos almoçar juntos.',
      unavailable: 'Hoje não vou conseguir almoçar junto.',
      meeting: 'Tenho uma reunião nesse horário, então não vou conseguir.',
    };
    setRespondingId(invite.id); setError('');
    const result = await replyToLunchInvite(invite.id, status, messages[status]);
    setRespondingId('');
    if (result.error) { setError(result.error); return; }
    setNotice('Resposta enviada ao colega.');
    await refresh();
  };

  const currentUserId = userId;
  const incoming = invites.filter((invite) => invite.recipient_id === currentUserId && invite.status === 'pending').slice(0, 3);
  const recentOutgoing = invites.filter((invite) => invite.sender_id === currentUserId).slice(0, 3);
  const timeZone = profile?.fuso || zoneDefault;

  return (
    <>
      {notice ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{notice}</AppText> : null}
      {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
      {broadcasts.map((item) => <SurfaceCard key={item.id} style={styles.messageCard}>
        <View style={styles.mascot}><ClockMascot size={58} /></View>
        <View style={{ flex: 1, gap: 7 }}>
          <StatusPill tone={item.message_type === 'maintenance' ? 'yellow' : 'teal'}>{item.message_type === 'maintenance' ? 'MANUTENÇÃO' : item.message_type === 'update' ? 'ATUALIZAÇÃO' : 'AVISO DO ADMINISTRADOR'}</StatusPill>
          <AppText variant="subtitle">{item.title}</AppText>
          <AppText variant="small" color={colors.muted}>{item.message}</AppText>
          <ActionButton title="Entendi" variant="outline" onPress={() => void dismissBroadcast(item)} icon={<MaterialCommunityIcons name="check" size={18} color={colors.deepTeal} />} />
        </View>
      </SurfaceCard>)}

      {incoming.map((invite) => <SurfaceCard key={invite.id} style={styles.messageCard}>
        <View style={styles.mascot}><ClockMascot size={58} /></View>
        <View style={{ flex: 1, gap: 8 }}>
          <StatusPill tone="yellow">CONVITE PARA ALMOÇAR</StatusPill>
          <AppText variant="subtitle">{invite.sender_name} chamou você!</AppText>
          <AppText variant="small" color={colors.muted}>{invite.message}</AppText>
          <AppText variant="tiny" color={colors.muted}>Retorno proposto às {clock(invite.return_at, timeZone)}.</AppText>
          <ActionButton title="Posso sim, vamos almoçar" variant="secondary" onPress={() => void reply(invite, 'accepted')} loading={respondingId === invite.id} />
          <ActionButton title="Não vou conseguir" variant="outline" onPress={() => void reply(invite, 'unavailable')} loading={respondingId === invite.id} />
          <ActionButton title="Tenho uma reunião" variant="outline" onPress={() => void reply(invite, 'meeting')} loading={respondingId === invite.id} />
        </View>
      </SurfaceCard>)}

      {recentOutgoing.map((invite) => <SurfaceCard key={`out-${invite.id}`} style={styles.messageCard}>
        <View style={styles.mascot}><ClockMascot size={48} /></View>
        <View style={{ flex: 1, gap: 5 }}>
          <AppText variant="subtitle">Convite para {invite.recipient_name}</AppText>
          <AppText variant="small" color={colors.muted}>{invite.status === 'pending' ? 'Aguardando resposta do colega.' : invite.response_message || (invite.status === 'accepted' ? 'O colega aceitou o convite.' : invite.status === 'meeting' ? 'O colega tem uma reunião nesse horário.' : 'O colega não poderá ir.')}</AppText>
          <AppText variant="tiny" color={colors.muted}>Retorno proposto às {clock(invite.return_at, timeZone)}.</AppText>
        </View>
      </SurfaceCard>)}

      <SurfaceCard style={styles.inviteCard}>
        <View style={styles.inviteIntro}><ClockMascot size={56} /><View style={{ flex: 1, gap: 4 }}><AppText variant="subtitle">Convide um colega para almoçar</AppText><AppText variant="small" color={colors.muted}>O convite fica dentro do aplicativo; a pessoa responde por aqui.</AppText></View></View>
        <ActionButton title="Escolher colega" variant="secondary" onPress={() => void openInvitePicker()} disabled={!userId || lunchStarted || ended} icon={<MaterialCommunityIcons name="account-multiple-plus-outline" size={19} color={colors.deepTeal} />} />
        {lunchStarted || ended ? <AppText variant="tiny" color={colors.muted}>Os convites de almoço ficam disponíveis antes de iniciar a pausa.</AppText> : null}
      </SurfaceCard>

      <Modal visible={inviteModal} transparent animationType="fade" onRequestClose={() => setInviteModal(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInviteModal(false)} accessibilityRole="button" accessibilityLabel="Fechar lista de colegas" />
          <SurfaceCard style={styles.modalCard}>
            <View style={styles.modalHeading}><View style={{ flex: 1, gap: 4 }}><AppText variant="subtitle">Com quem você quer almoçar?</AppText><AppText variant="small" color={colors.muted}>Somente colegas com acesso ativo são listados.</AppText></View><Pressable onPress={() => setInviteModal(false)} accessibilityRole="button" accessibilityLabel="Fechar"><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable></View>
            {loadingColleagues ? <AppText variant="small" color={colors.muted}>Carregando colegas...</AppText> : colleagues.length ? colleagues.map((colleague) => <Pressable key={colleague.id} onPress={() => void inviteColleague(colleague)} disabled={savingInvite} accessibilityRole="button" style={[styles.colleagueRow, { borderColor: colors.border }]}><MaterialCommunityIcons name="account-circle-outline" size={24} color={colors.deepTeal} /><AppText variant="body" style={{ flex: 1 }}>{colleague.nome}</AppText><MaterialCommunityIcons name="send-outline" size={19} color={colors.deepTeal} /></Pressable>) : <AppText variant="small" color={colors.muted}>Nenhum colega ativo para convidar.</AppText>}
            {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
            <ActionButton title="Cancelar" variant="outline" onPress={() => setInviteModal(false)} disabled={savingInvite} />
          </SurfaceCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  messageCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  mascot: { paddingTop: 4 },
  inviteCard: { gap: 12 },
  inviteIntro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backdrop: { flex: 1, backgroundColor: '#081A1880', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 12, maxHeight: '85%' },
  modalHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  colleagueRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
});
