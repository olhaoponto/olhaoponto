import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, BackNavigationButton, PageHeading, ScreenShell, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { addBalanceAdjustment, loadBalanceAdjustments } from '@/services/bank-hours-service';
import { loadAllEntries } from '@/services/time-entry-service';
import { calculateBankBalance } from '@/utils/bank-hours';
import { formatMinutesHHMM } from '@/utils/work-time';
import type { BalanceAdjustment } from '@/types/app';

type Direction = 'credito' | 'debito';
function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 15_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), timeoutMs); });
  return Promise.race([promise, deadline]).finally(() => { if (timeout) clearTimeout(timeout); });
}
const labelDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Bahia' }).format(date) : 'Data indisponível';
};
const signedTime = (minutes: number) => `${minutes > 0 ? '+' : minutes < 0 ? '−' : ''}${formatMinutesHHMM(Math.abs(minutes))}`;

export default function BankHoursScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const session = useAppStore((state) => state.session);
  const sessionInitialized = useAppStore((state) => state.sessionInitialized);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof loadAllEntries>>['data']>(null);
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [complete, setComplete] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>('credito');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [reason, setReason] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); setComplete(false); setError('Sua sessão não está ativa. Entre novamente para consultar o banco de horas.'); return; }
    const requestId = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const [entriesResult, adjustmentResult] = await withTimeout(
        Promise.all([loadAllEntries(), loadBalanceAdjustments()]),
        'A consulta demorou mais que o esperado. Confira a conexão e tente novamente.',
      );
      if (requestId !== requestVersion.current) return;
      if (!entriesResult.data || !adjustmentResult.data) {
        setError(adjustmentResult.error || entriesResult.error || 'Não foi possível consultar o histórico completo do banco de horas.');
        setComplete(false);
        if (adjustmentResult.data) setAdjustments(adjustmentResult.data);
        return;
      }
      setEntries(entriesResult.data);
      setAdjustments(adjustmentResult.data);
      setComplete(!entriesResult.error && !adjustmentResult.error);
      if (entriesResult.error || adjustmentResult.error) {
        setError('Sem conexão para confirmar todo o histórico. O saldo completo só é exibido após sincronizar os dados.');
      }
    } catch (cause) {
      if (requestId !== requestVersion.current) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o banco de horas.');
      setComplete(false);
    } finally {
      if (requestId === requestVersion.current) setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    if (!sessionInitialized) return () => { active = false; requestVersion.current += 1; };
    if (!session?.user.id) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setLoading(false);
        setComplete(false);
        setError('Sua sessão não está ativa. Entre novamente para consultar o banco de horas.');
      });
      return () => { active = false; requestVersion.current += 1; };
    }
    void Promise.resolve().then(refresh);
    return () => { active = false; requestVersion.current += 1; };
  }, [session?.user.id, sessionInitialized, refresh, retryCount]);

  const balance = useMemo(() => entries ? calculateBankBalance(entries, adjustments) : null, [entries, adjustments]);

  const saveAdjustment = async () => {
    const hourValue = hours.trim() ? Number(hours) : 0;
    const minuteValue = minutes.trim() ? Number(minutes) : 0;
    if (!Number.isInteger(hourValue) || hourValue < 0 || hourValue > 1000 || !Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 59 || hourValue * 60 + minuteValue === 0) {
      setError('Informe horas e minutos válidos; o total não pode ser zero.');
      return;
    }
    if (reason.trim().length < 3) { setError('Explique a origem deste ajuste em pelo menos 3 caracteres.'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    const absoluteMinutes = hourValue * 60 + minuteValue;
    const signedMinutes = direction === 'credito' ? absoluteMinutes : -absoluteMinutes;
    let result: Awaited<ReturnType<typeof addBalanceAdjustment>>;
    try { result = await addBalanceAdjustment(signedMinutes, reason); }
    catch (cause) { setSaving(false); setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o ajuste. Tente novamente.'); return; }
    setSaving(false);
    if (result.error || !result.data) { setError(result.error || 'Não foi possível registrar o ajuste.'); return; }
    setAdjustments((current) => [result.data!, ...current]);
    setHours(''); setMinutes(''); setReason(''); setFormOpen(false); setComplete(true);
    setNotice('Ajuste registrado. O saldo externo foi somado ao saldo calculado pelo aplicativo.');
  };

  const totalColor = balance && balance.totalMinutes < 0 ? colors.error : colors.deepTeal;

  return (
    <ScreenShell contentStyle={styles.page}>
      <BackNavigationButton label="Voltar ao resumo" onPress={() => router.replace('/(tabs)/resumo')} />
      <PageHeading eyebrow="Saldo pessoal" title="Banco de horas" subtitle="Saldo estimado pelo app somado aos ajustes informados por você." right={<MaterialCommunityIcons name="wallet-plus-outline" size={27} color={colors.deepTeal} />} />
      <ActionButton title={formOpen ? 'Fechar lançamento' : 'Adicionar saldo existente'} onPress={() => { setFormOpen((open) => !open); setError(''); }} icon={<MaterialCommunityIcons name={formOpen ? 'close' : 'plus'} size={21} color="#FFFFFF" />} />
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.deepTeal} /><AppText variant="small" color={colors.muted}>Conferindo seu histórico…</AppText></View> : null}
      {!loading && complete && balance ? <>
        <SurfaceCard style={[styles.totalCard, { borderColor: `${colors.teal}70` }]}>
          <AppText variant="small" color={colors.muted}>Saldo total acumulado</AppText>
          <AppText variant="hero" color={totalColor}>{signedTime(balance.totalMinutes)}</AppText>
          <View style={styles.breakdown}>
            <View style={styles.breakdownCell}><AppText variant="tiny" color={colors.muted}>Estimado no aplicativo</AppText><AppText variant="subtitle">{signedTime(balance.appMinutes)}</AppText><AppText variant="tiny" color={colors.muted}>extras acima de 8h/dia</AppText></View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownCell}><AppText variant="tiny" color={colors.muted}>Ajustes externos</AppText><AppText variant="subtitle">{signedTime(balance.externalMinutes)}</AppText><AppText variant="tiny" color={colors.muted}>lançamentos registrados</AppText></View>
          </View>
        </SurfaceCard>
        <AppText variant="tiny" color={colors.muted}>O valor estimado usa todos os dias carregados e soma apenas horas acima de 8h por dia. Confira o saldo oficial com sua empresa.</AppText>
      </> : null}
      {error ? <SurfaceCard tone="soft" style={{ gap: 10 }}><AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText><AppText variant="tiny" color={colors.muted}>O saldo completo só aparece quando o histórico do aplicativo e os ajustes externos são consultados com sucesso.</AppText>{sessionInitialized && !session ? <ActionButton title="Voltar ao login" onPress={() => router.replace('/login')} /> : !loading ? <ActionButton title="Tentar novamente" variant="outline" onPress={() => { setLoading(true); setRetryCount((count) => count + 1); }} /> : null}</SurfaceCard> : null}
      {notice ? <AppText variant="small" color={colors.deepTeal} accessibilityRole="alert">{notice}</AppText> : null}
      {formOpen ? <SurfaceCard style={{ gap: 13 }}>
        <AppText variant="subtitle">Registrar ajuste do banco</AppText>
        <AppText variant="small" color={colors.muted}>Informe o saldo que veio da empresa. Ele será acrescentado (crédito) ou descontado (débito) do total do app; os lançamentos ficam no histórico.</AppText>
        <View style={styles.directions}>
          {(['credito', 'debito'] as const).map((value) => <Pressable key={value} onPress={() => setDirection(value)} accessibilityRole="button" accessibilityState={{ selected: direction === value }} style={[styles.direction, { backgroundColor: direction === value ? `${colors.teal}22` : colors.input, borderColor: direction === value ? colors.deepTeal : colors.border }]}><AppText variant="small" color={direction === value ? colors.deepTeal : colors.foreground}>{value === 'credito' ? 'Adicionar' : 'Descontar'}</AppText></Pressable>)}
        </View>
        <View style={styles.timeFields}><TextField label="Horas" value={hours} onChangeText={setHours} keyboardType="number-pad" maxLength={4} placeholder="Ex.: 5" /><TextField label="Minutos" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" maxLength={2} placeholder="0–59" /></View>
        <TextField label="Motivo / origem" value={reason} onChangeText={setReason} multiline maxLength={240} placeholder="Ex.: saldo anterior informado pela empresa" style={{ minHeight: 72, textAlignVertical: 'top' }} />
        <ActionButton title="Salvar ajuste" onPress={saveAdjustment} loading={saving} disabled={saving} />
      </SurfaceCard> : null}
      <SurfaceCard style={{ gap: 11 }}>
        <AppText variant="subtitle">Histórico de ajustes externos</AppText>
        {!adjustments.length ? <AppText variant="small" color={colors.muted}>Ainda não há ajustes externos registrados.</AppText> : adjustments.map((adjustment) => <View key={adjustment.id} style={[styles.adjustmentRow, { borderBottomColor: colors.border }]}><View style={{ flex: 1, gap: 3 }}><AppText variant="small" style={{ fontWeight: '600' }}>{adjustment.motivo}</AppText><AppText variant="tiny" color={colors.muted}>{labelDate(adjustment.criado_em)}</AppText></View><AppText variant="subtitle" color={adjustment.saldo_minutos >= 0 ? colors.deepTeal : colors.error}>{signedTime(adjustment.saldo_minutos)}</AppText></View>)}
      </SurfaceCard>
      <ActionButton title="Voltar ao resumo" variant="outline" onPress={() => router.replace('/(tabs)/resumo')} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, paddingTop: 18 },
  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 12 },
  totalCard: { gap: 7 },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 8 },
  breakdownCell: { flex: 1, gap: 4 },
  divider: { width: 1, alignSelf: 'stretch' },
  directions: { flexDirection: 'row', gap: 9 },
  direction: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 14, borderWidth: 1 },
  timeFields: { flexDirection: 'row', gap: 12 },
  adjustmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11 },
});
