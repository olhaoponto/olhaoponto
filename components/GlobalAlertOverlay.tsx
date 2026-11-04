import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { fromZonedTime } from 'date-fns-tz';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/app-store';
import { calculateWorkedSeconds, formatMinutesHHMM, getBahiaDate, getNextPunch, projectEndTime, safeClockOutTimestamp, validatePunch } from '@/utils/work-time';
import { getCurrentAlert } from '@/utils/alerts';
import { chooseCharge, ChargeIllustration, type AlertLevel, type Charge } from '@/components/charges';
import { insertTimeEntry } from '@/services/time-entry-service';
import { scheduleDayNotifications } from '@/services/notification-service';
import { ActionButton, AppText, TextField, useAppColors } from '@/components/ui';

const zone = 'America/Bahia';
function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
function formatClockTime(value: string | Date, timeZone = zone) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function alertLevel(minutes: number, limit: number): AlertLevel {
  if (minutes >= limit) return '10h';
  if (minutes >= 590) return '9h50';
  if (minutes >= 585) return '9h45';
  if (minutes >= 570) return '9h30';
  if (minutes >= 540) return '9h';
  return '8h';
}
function displayKey(minutes: number, limit: number): string {
  if (minutes >= limit) return `limit-${limit}`;
  if (minutes >= 590) return `urgent-${minutes}`;
  if (minutes >= 585) return `urgent-${Math.floor(minutes / 5) * 5}`;
  if (minutes >= 570) return 'modal-570';
  return '';
}

export default function GlobalAlertOverlay() {
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const entries = useAppStore((state) => state.entries);
  const [now, setNow] = useState(() => new Date());
  const [visible, setVisible] = useState(false);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingTime, setPendingTime] = useState('');
  const [confirmCappedExit, setConfirmCappedExit] = useState(false);
  const pulse = useSharedValue(0);
  const lastKey = useRef('');
  const previousCharge = useRef<string | undefined>(undefined);
  const today = getBahiaDate(now);
  const todayEntries = useMemo(() => entries.filter((entry) => entry.data === today), [entries, today]);
  const completed = todayEntries.some((entry) => entry.tipo === 'saida');
  const limit = profile?.limite_minutos ?? 600;
  const lunchMinutes = profile?.almoco_minutos ?? 60;
  const workedSeconds = calculateWorkedSeconds(todayEntries, now);
  const workedMinutes = Math.floor(workedSeconds / 60);
  const activeAlert = getCurrentAlert(workedMinutes, limit);
  const key = session?.user.id && !completed ? `${session.user.id}:${displayKey(workedMinutes, limit)}` : '';
  const level = alertLevel(workedMinutes, limit);
  const remainingSeconds = Math.max(0, limit * 60 - workedSeconds);
  const critical = workedMinutes >= 590 || Boolean(activeAlert?.level === 'blocking');
  const urgent = workedMinutes >= 585;
  const pulseStyle = useAnimatedStyle(() => ({ opacity: urgent ? 0.04 + pulse.value * 0.18 : 0.08, transform: [{ scale: urgent ? 0.94 + pulse.value * 0.18 : 1 }] }));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const listener = AppState.addEventListener('change', () => setNow(new Date()));
    return () => { clearInterval(timer); listener.remove(); };
  }, []);

  useEffect(() => {
    if (!session || !profile) return;
    void scheduleDayNotifications(todayEntries, {
      userId: session.user.id,
      limitMinutes: limit,
      lunchMinutes,
      enabled: profile.preferencias_alerta?.enabled !== false,
      soundEnabled: profile.preferencias_alerta?.som !== false,
      vibrationEnabled: profile.preferencias_alerta?.vibracao !== false,
      now: new Date(),
    }).catch(() => undefined);
  }, [session, profile, limit, lunchMinutes, profile?.preferencias_alerta?.enabled, profile?.preferencias_alerta?.som, profile?.preferencias_alerta?.vibracao, todayEntries]);

  useEffect(() => {
    if (!key || !session || !profile) return;
    if (lastKey.current === key) return;
    lastKey.current = key;
    const selected = chooseCharge(level, previousCharge.current);
    previousCharge.current = selected.id;
    setCharge(selected);
    setMessage('');
    setVisible(true);
    if (profile.preferencias_alerta?.vibracao !== false) {
      const feedback = level === '9h'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : level === '9h30' || level === '9h45'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : level === '9h50' || level === '10h'
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            : Promise.resolve();
      void feedback.catch(() => undefined);
    }
  }, [key, level, session, profile]);

  useEffect(() => {
    const shouldKeepAwake = Boolean(!completed && session && profile && (workedMinutes >= 590 || activeAlert?.level === 'blocking'));
    if (Platform.OS !== 'web') {
      if (shouldKeepAwake) void activateKeepAwakeAsync('olhaponto-critical-alert').catch(() => undefined);
      else void deactivateKeepAwake('olhaponto-critical-alert').catch(() => undefined);
      if (shouldKeepAwake && profile?.preferencias_alerta?.vibracao !== false) Vibration.vibrate([0, 650, 350, 650], true);
      else Vibration.cancel();
    }
    return () => {
      if (Platform.OS !== 'web') {
        void deactivateKeepAwake('olhaponto-critical-alert').catch(() => undefined);
        Vibration.cancel();
      }
    };
  }, [session, profile, workedMinutes, activeAlert?.level, completed]);

  useEffect(() => {
    if (urgent) pulse.value = withRepeat(withTiming(1, { duration: 760 }), -1, true);
    else { cancelAnimation(pulse); pulse.value = 0; }
    return () => cancelAnimation(pulse);
  }, [urgent, pulse]);

  const close = () => { if (activeAlert?.level !== 'blocking') setVisible(false); };
  const recordExit = async () => {
    const next = getNextPunch(todayEntries);
    if (next !== 'saida') {
      setMessage('Há uma batida anterior pendente. Registre a próxima etapa na tela Hoje para concluir a sequência de saída.');
      return;
    }
    const requestedAt = new Date();
    const safeExit = safeClockOutTimestamp(todayEntries, requestedAt, limit, lunchMinutes);
    if (!safeExit.timestamp) { setMessage('Não foi possível calcular o último horário permitido para a saída.'); return; }
    if (safeExit.capped && !confirmCappedExit) {
      const allowedAt = safeExit.latestAllowedTimestamp || safeExit.timestamp;
      setConfirmCappedExit(true);
      setMessage(`O limite de ${formatMinutesHHMM(limit)} foi atingido às ${formatClockTime(allowedAt, profile?.fuso || zone)}. Como o toque chegou às ${formatClockTime(requestedAt, profile?.fuso || zone)}, confirme para registrar a saída no horário-limite, sem gravar jornada acima do teto.`);
      return;
    }
    const timestamp = safeExit.timestamp;
    const candidate = { tipo: 'saida' as const, registrado_em: timestamp, data: today };
    const validation = validatePunch(todayEntries, candidate, requestedAt, limit);
    if (!validation.valid) { setMessage(validation.message || 'Não foi possível registrar a saída.'); return; }
    setSaving(true); setMessage('');
    const justification = safeExit.capped
      ? `Saída registrada no horário-limite ${formatClockTime(timestamp, profile?.fuso || zone)} após confirmação às ${formatClockTime(requestedAt, profile?.fuso || zone)}, para não ultrapassar ${formatMinutesHHMM(limit)} de jornada.`
      : undefined;
    const result = await insertTimeEntry({ tipo: 'saida', registrado_em: timestamp, horario_informado_manual: false, ...(justification ? { justificativa: justification } : {}) });
    setSaving(false);
    if (result.error || !result.data) { setMessage(result.error || 'Não foi possível registrar a saída.'); return; }
    useAppStore.getState().upsertEntry(result.data);
    setConfirmCappedExit(false);
    if ((result.data as typeof result.data & { _pending?: boolean })._pending) setMessage('Saída salva neste aparelho e aguardando sincronização.');
    else setVisible(false);
  };

  const recordPendingPunch = async () => {
    if (!profile) return;
    const next = getNextPunch(todayEntries);
    if (!next || next === 'saida') { setMessage('A próxima batida é a saída; use o botão Registrar saída agora.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(pendingTime)) { setMessage('Informe o horário da batida esquecida no formato HH:mm.'); return; }
    const timestamp = fromZonedTime(`${today}T${pendingTime}:00`, profile.fuso || zone).toISOString();
    const candidate = { tipo: next, registrado_em: timestamp, data: today, horario_informado_manual: true };
    const validation = validatePunch(todayEntries, candidate, new Date(), limit);
    if (!validation.valid) { setMessage(validation.message || 'Esta batida não pode ser registrada.'); return; }
    setSaving(true); setMessage('');
    const result = await insertTimeEntry({ tipo: next, registrado_em: timestamp, horario_informado_manual: true, justificativa: 'Correção necessária para completar a sequência ao atingir o limite.' });
    setSaving(false);
    if (result.error || !result.data) { setMessage(result.error || 'Não foi possível registrar a batida pendente.'); return; }
    useAppStore.getState().upsertEntry(result.data);
    setPendingTime('');
    setMessage((result.data as typeof result.data & { _pending?: boolean })._pending ? 'Batida anterior guardada neste aparelho. Continue pela próxima etapa.' : 'Batida anterior registrada. Continue pela próxima etapa.');
  };

  if (!session || !profile || !charge || !activeAlert || completed || workedMinutes < Math.min(570, limit)) return null;
  const title = activeAlert.level === 'blocking'
    ? 'LIMITE ATINGIDO! Pare de trabalhar e bata o ponto de saída AGORA!'
    : workedMinutes >= 590
      ? 'Alerta máximo: encerre sua jornada agora.'
      : workedMinutes >= 585
        ? 'Faltam poucos minutos. Hora de fechar tudo.'
        : 'Jornada avançada. Vamos planejar a saída?';
  const detail = activeAlert.level === 'blocking'
    ? `${formatMinutesHHMM(workedMinutes)} trabalhadas. O limite configurado é ${formatMinutesHHMM(limit)}.`
    : `Você já trabalhou ${formatMinutesHHMM(workedMinutes)}. Faltam ${formatClock(remainingSeconds)} para o limite.`;
  const projected = projectEndTime(todayEntries, limit, lunchMinutes);
  const safeExit = safeClockOutTimestamp(todayEntries, now, limit, lunchMinutes);
  const exitButtonTitle = confirmCappedExit && safeExit.latestAllowedTimestamp
    ? `Registrar saída às ${formatClockTime(safeExit.latestAllowedTimestamp, profile.fuso || zone)}`
    : 'Registrar saída agora';
  const canDismiss = activeAlert.level !== 'blocking';

  return (
    <Modal visible={visible} animationType={critical ? 'fade' : 'slide'} transparent={false} statusBarTranslucent onRequestClose={close}>
      <View style={[styles.overlay, { backgroundColor: activeAlert.level === 'blocking' ? '#A62C31' : critical ? '#D9544F' : colors.deepTeal }]}>
        <Animated.View style={[styles.glow, pulseStyle, { backgroundColor: critical ? '#FFFFFF' : '#FFD477' }]} />
        <View style={styles.topRow}>
          <AppText variant="tiny" color="#FFFFFF" style={styles.overline}>{activeAlert.level === 'blocking' ? 'ALERTA CRÍTICO' : 'LEMBRETE DE JORNADA'}</AppText>
          {canDismiss ? <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Fechar alerta"><AppText variant="subtitle" color="#FFFFFF">×</AppText></Pressable> : null}
        </View>
        <AppText variant="title" color="#FFFFFF" style={styles.title}>{title}</AppText>
        <View style={styles.chargeWrap}><ChargeIllustration chargeId={charge.id} size={230} /></View>
        <AppText variant="subtitle" color="#FFFFFF" style={styles.caption}>{charge.caption}</AppText>
        <AppText variant="body" color="#FFFFFF" style={styles.detail}>{detail}</AppText>
        {projected ? <AppText variant="small" color="#F8F5E9" style={styles.projected}>Horário-limite projetado: {new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(new Date(projected))}</AppText> : null}
        {message ? <AppText variant="small" color="#FFFFFF" style={styles.message}>{message}</AppText> : null}
        <View style={styles.actions}>
          {activeAlert.level === 'blocking'
            ? getNextPunch(todayEntries) === 'saida'
              ? <ActionButton title={exitButtonTitle} onPress={recordExit} loading={saving} style={{ backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }} />
              : <><AppText variant="small" color="#FFFFFF" style={{ textAlign: 'center' }}>Se ficou faltando uma batida anterior, complete-a na ordem para liberar a saída.</AppText><TextField label="Horário da próxima batida pendente (HH:mm)" value={pendingTime} onChangeText={setPendingTime} keyboardType="numbers-and-punctuation" maxLength={5} /><ActionButton title={`Registrar ${getNextPunch(todayEntries) ? getNextPunch(todayEntries)!.replace('_', ' ') : 'batida'} pendente`} onPress={recordPendingPunch} loading={saving} disabled={!pendingTime} style={{ backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }} /></>
            : <ActionButton title="Entendido, já vou!" onPress={close} style={{ backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }} />}
          {!canDismiss ? <AppText variant="tiny" color="#FFFFFF" style={{ textAlign: 'center' }}>Este alerta permanece aberto até registrar a saída.</AppText> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, paddingTop: 58, paddingBottom: 32, paddingHorizontal: 26, alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
  glow: { position: 'absolute', top: -120, right: -80, width: 340, height: 340, borderRadius: 180, backgroundColor: '#FFFFFF' },
  topRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overline: { letterSpacing: 1.5, fontWeight: '700' },
  title: { textAlign: 'center', maxWidth: 480 },
  chargeWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 210 },
  caption: { textAlign: 'center', maxWidth: 420 },
  detail: { textAlign: 'center', maxWidth: 430 },
  projected: { textAlign: 'center' },
  message: { textAlign: 'center', backgroundColor: '#00000022', padding: 12, borderRadius: 14 },
  actions: { width: '100%', maxWidth: 440, gap: 12 },
});
