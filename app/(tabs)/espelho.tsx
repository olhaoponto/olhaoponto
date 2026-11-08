import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getDaysInMonth, subMonths, addMonths } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { ActionButton, AppText, KeyboardModalContent, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { TabNavigationCard } from '@/components/TabNavigationCard';
import { useAppStore } from '@/store/app-store';
import { deleteTimeEntry, insertTimeEntry, loadEntriesByDateRange, loadEntriesByMonth, updateTimeEntry } from '@/services/time-entry-service';
import { loadDayStatuses } from '@/services/day-status-service';
import { exportCsv, exportPdf } from '@/services/export-service';
import { calculateDailyTotals, calculatePeriodTotals, formatMinutesHHMM, getBahiaDate, getNextPunch, validateEntries, validatePunch } from '@/utils/work-time';
import { addCivilDays, getWeekDateRange } from '@/utils/day-status';
import type { DayStatus, DayStatusRecord, TimeEntry } from '@/types/app';

const ZONE = 'America/Bahia';
const TYPES: TimeEntry['tipo'][] = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
const LABELS: Record<TimeEntry['tipo'], string> = { entrada: 'Entrada', saida_almoco: 'Almoço', volta_almoco: 'Volta', saida: 'Saída' };
const STATUS_LABELS: Record<Exclude<DayStatus, 'working'>, string> = { rest: 'Folga', absence: 'Falta / ausência', medical_leave: 'Atestado' };
const monthLabel = (key: string) => formatInTimeZone(new Date(`${key}-15T12:00:00Z`), ZONE, 'MMMM yyyy');
const timeLabel = (value: string) => formatInTimeZone(new Date(value), ZONE, 'HH:mm');
const dayLabel = (key: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, weekday: 'short' }).format(new Date(`${key}T12:00:00Z`));
const fullDateLabel = (key: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${key}T12:00:00Z`));
const weekLabel = (startDate: string, endDate: string) => `${formatInTimeZone(new Date(`${startDate}T12:00:00Z`), ZONE, 'dd/MM')} – ${formatInTimeZone(new Date(`${endDate}T12:00:00Z`), ZONE, 'dd/MM/yyyy')}`;

type MirrorMode = 'month' | 'week';

export default function EspelhoScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const sessionInitialized = useAppStore((state) => state.sessionInitialized);
  const entries = useAppStore((state) => state.entries);
  const setEntries = useAppStore((state) => state.setEntries);
  const upsertEntry = useAppStore((state) => state.upsertEntry);
  const [month, setMonth] = useState(() => formatInTimeZone(new Date(), ZONE, 'yyyy-MM'));
  const [weekAnchor, setWeekAnchor] = useState(() => getBahiaDate(new Date()));
  const [mode, setMode] = useState<MirrorMode>('month');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [syncNotice, setSyncNotice] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [selected, setSelected] = useState<TimeEntry | null>(null);
  const [editTime, setEditTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'grid' | 'table'>('table');
  const [retroOpen, setRetroOpen] = useState(false);
  const [retroDate, setRetroDate] = useState(() => formatInTimeZone(new Date(), ZONE, 'yyyy-MM-dd'));
  const [retroTime, setRetroTime] = useState('');
  const [retroReason, setRetroReason] = useState('');
  const [dayStatuses, setDayStatuses] = useState<DayStatusRecord[]>([]);

  const userId = session?.user.id;
  const authUnavailable = sessionInitialized && !userId;
  const reportLoading = !sessionInitialized || (!authUnavailable && loading);
  const visibleLoadError = authUnavailable ? 'Sua sessão não está ativa. Entre novamente para consultar o espelho.' : loadError;
  const periodRange = useMemo(() => mode === 'month'
    ? (() => {
      const [yearString, monthString] = month.split('-');
      const year = Number(yearString);
      const monthNumber = Number(monthString);
      const lastDay = getDaysInMonth(new Date(year, monthNumber - 1, 15));
      return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, '0')}` };
    })()
    : getWeekDateRange(weekAnchor), [mode, month, weekAnchor]);

  useEffect(() => {
    let alive = true;
    if (!sessionInitialized || !userId) return () => { alive = false; };
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setLoading(true); setLoadError(''); setSyncNotice('');
      try {
        const [result, statusResult] = await Promise.all([
          mode === 'month'
            ? loadEntriesByMonth(new Date(`${month}-15T12:00:00Z`))
            : loadEntriesByDateRange(periodRange.startDate, periodRange.endDate),
          loadDayStatuses(periodRange.startDate, periodRange.endDate),
        ]);
        if (!alive) return;
        if (result.data) setEntries(result.data);
        if (statusResult.data) setDayStatuses(statusResult.data);
        if (result.error && result.data?.length) {
          setSyncNotice('Sem conexão com o Supabase. Exibindo os registros salvos neste aparelho; tente sincronizar novamente.');
          setLoadError('');
        } else if (result.error) {
          setLoadError(result.error.toLowerCase().includes('sessão') ? result.error : `Não foi possível carregar ${mode === 'month' ? 'este mês' : 'esta semana'}. Confira sua conexão e tente novamente.`);
          setSyncNotice('');
        } else if (statusResult.error && statusResult.data?.length) {
          setSyncNotice('Batidas sincronizadas; não foi possível atualizar as situações pessoais deste período.');
          setLoadError('');
        } else { setLoadError(''); setSyncNotice(''); }
      } catch {
        if (alive) { setLoadError(`Não foi possível carregar ${mode === 'month' ? 'este mês' : 'esta semana'}. Confira sua conexão e tente novamente.`); setSyncNotice(''); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [mode, month, periodRange.endDate, periodRange.startDate, retryCount, sessionInitialized, setEntries, userId]);

  const periodEntries = useMemo(() => entries.filter((entry) => entry.data >= periodRange.startDate && entry.data <= periodRange.endDate), [entries, periodRange.endDate, periodRange.startDate]);
  const dailyTotals = useMemo(() => calculateDailyTotals(periodEntries), [periodEntries]);
  const totals = useMemo(() => calculatePeriodTotals(periodEntries), [periodEntries]);
  const totalByDay = new Map(dailyTotals.map((item) => [item.date, item]));
  const dates = useMemo(() => {
    if (mode === 'week') return Array.from({ length: 7 }, (_, index) => addCivilDays(periodRange.startDate, index));
    const countDays = Number(periodRange.endDate.slice(-2));
    return Array.from({ length: countDays }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
  }, [mode, month, periodRange.endDate, periodRange.startDate]);
  const statusByDate = useMemo(() => new Map(dayStatuses.map((item) => [item.data, item])), [dayStatuses]);
  const periodTitle = mode === 'month' ? monthLabel(month) : weekLabel(periodRange.startDate, periodRange.endDate);

  const startEdit = (entry: TimeEntry) => { setSelected(entry); setEditTime(timeLabel(entry.registrado_em)); setReason(entry.justificativa || ''); setNotice(''); };
  const clearPeriodMessages = () => { setLoading(true); setError(''); setLoadError(''); setSyncNotice(''); setNotice(''); };
  const changePeriod = (amount: -1 | 1) => {
    clearPeriodMessages();
    if (mode === 'month') {
      const next = formatInTimeZone(amount < 0 ? subMonths(new Date(`${month}-15T12:00:00Z`), 1) : addMonths(new Date(`${month}-15T12:00:00Z`), 1), ZONE, 'yyyy-MM');
      const today = formatInTimeZone(new Date(), ZONE, 'yyyy-MM-dd');
      setRetroDate(today.startsWith(next) ? today : `${next}-01`);
      setMonth(next);
    } else setWeekAnchor(addCivilDays(weekAnchor, amount * 7));
  };
  const changeMode = (next: MirrorMode) => {
    if (next === mode) return;
    clearPeriodMessages();
    setSelected(null); setDeleteTarget(null); setRetroOpen(false);
    if (next === 'month' && !retroDate.startsWith(month)) setRetroDate(`${month}-01`);
    setMode(next);
  };

  const saveEdit = async () => {
    if (!selected || mode !== 'month') return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(editTime)) { setNotice('Informe o horário no formato HH:mm.'); return; }
    if (reason.trim().length < 3) { setNotice('Inclua uma justificativa curta para registrar a edição.'); return; }
    const timestamp = fromZonedTime(`${selected.data}T${editTime}:00`, profile?.fuso || ZONE).toISOString();
    const candidateRows = periodEntries.map((entry) => entry.id === selected.id ? { ...entry, registrado_em: timestamp, data: selected.data, horario_informado_manual: true, editado: true, justificativa: reason.trim() } : entry).filter((entry) => entry.data === selected.data);
    const validation = validateEntries(candidateRows, new Date(), profile?.limite_minutos ?? 600);
    if (!validation.valid) { setNotice(validation.message || 'A edição não é válida para a sequência do dia.'); return; }
    setSaving(true); setNotice(''); setError('');
    const result = await updateTimeEntry(selected.id, { registrado_em: timestamp, horario_informado_manual: true, editado: true, justificativa: reason.trim() });
    setSaving(false);
    if (result.error || !result.data) { setNotice(result.error || 'Não foi possível salvar a edição.'); return; }
    upsertEntry(result.data);
    setSelected(null);
    setNotice('Batida atualizada com sucesso.');
  };

  const confirmDelete = async () => {
    if (!deleteTarget || mode !== 'month') return;
    const sameDay = periodEntries.filter((entry) => entry.data === deleteTarget.data).sort((a, b) => a.registrado_em.localeCompare(b.registrado_em));
    if (sameDay.at(-1)?.id !== deleteTarget.id) { setNotice('Para manter a ordem das batidas, exclua primeiro a última batida do dia.'); setDeleteTarget(null); return; }
    setSaving(true);
    const result = await deleteTimeEntry(deleteTarget.id);
    setSaving(false);
    if (result.error) { setNotice(result.error); setDeleteTarget(null); return; }
    setEntries(periodEntries.filter((entry) => entry.id !== deleteTarget.id));
    setDeleteTarget(null);
    setNotice('Batida removida.');
  };

  const saveRetroactive = async () => {
    if (!profile || mode !== 'month') return;
    setNotice('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(retroDate) || formatInTimeZone(new Date(`${retroDate}T12:00:00Z`), ZONE, 'yyyy-MM-dd') !== retroDate) { setNotice('Informe uma data válida no formato AAAA-MM-DD.'); return; }
    if (!retroDate.startsWith(month)) { setNotice('Escolha uma data dentro do mês selecionado.'); return; }
    const today = formatInTimeZone(new Date(), ZONE, 'yyyy-MM-dd');
    if (retroDate > today) { setNotice('Não é permitido registrar batidas em uma data futura.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(retroTime)) { setNotice('Informe o horário no formato HH:mm.'); return; }
    if (retroReason.trim().length < 3) { setNotice('Inclua uma justificativa curta para a batida esquecida.'); return; }
    const dayEntries = periodEntries.filter((entry) => entry.data === retroDate);
    const next = getNextPunch(dayEntries);
    if (!next) { setNotice('Este dia já tem as quatro batidas. Edite uma existente se precisar corrigir.'); return; }
    const stamp = fromZonedTime(`${retroDate}T${retroTime}:00`, profile.fuso || ZONE).toISOString();
    const candidate = { tipo: next, registrado_em: stamp, data: retroDate, horario_informado_manual: true };
    const validation = validatePunch(dayEntries, candidate, new Date(), profile.limite_minutos);
    if (!validation.valid) { setNotice(validation.message || 'Esta batida não pode ser registrada.'); return; }
    setSaving(true);
    const result = await insertTimeEntry({ tipo: next, registrado_em: stamp, horario_informado_manual: true, justificativa: retroReason.trim() });
    setSaving(false);
    if (result.error || !result.data) { setNotice(result.error || 'Não foi possível salvar a batida.'); return; }
    setEntries([...periodEntries.filter((entry) => entry.id !== result.data!.id), result.data].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)));
    setRetroTime(''); setRetroReason(''); setRetroOpen(false);
    setNotice((result.data as TimeEntry & { _pending?: boolean })._pending ? 'Batida esquecida guardada no aparelho e aguardando sincronização.' : 'Batida esquecida registrada com justificativa.');
  };

  const handleExport = async (kind: 'pdf' | 'csv') => {
    if (!profile || mode !== 'month') return;
    setExporting(kind); setError('');
    try {
      if (kind === 'pdf') await exportPdf(profile, periodEntries, monthLabel(month));
      else await exportCsv(profile, periodEntries, month);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o arquivo.'); }
    finally { setExporting(''); }
  };

  return (
    <ScreenShell contentStyle={styles.page}>
      <PageHeading eyebrow="Seu histórico pessoal" title="Espelho de ponto" subtitle="Horários que você registrou no app." right={<AccountMenuButton />} />
      <TabNavigationCard active="espelho" />
      <SurfaceCard style={styles.monthCard}>
        <View style={styles.monthControls}>
          <Pressable onPress={() => changePeriod(-1)} style={styles.monthArrow} accessibilityRole="button" accessibilityLabel={`${mode === 'month' ? 'Mês' : 'Semana'} anterior`}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.deepTeal} /></Pressable>
          <View style={{ alignItems: 'center', flex: 1, gap: 2 }}><AppText variant="subtitle" style={{ textTransform: 'capitalize' }}>{periodTitle}</AppText><AppText variant="tiny" color={colors.muted}>{reportLoading ? 'Carregando registros…' : visibleLoadError ? 'Período indisponível' : `${periodEntries.length} batida(s) registradas`}</AppText></View>
          <Pressable onPress={() => changePeriod(1)} style={styles.monthArrow} accessibilityRole="button" accessibilityLabel={`${mode === 'month' ? 'Próximo mês' : 'Próxima semana'}`}><MaterialCommunityIcons name="chevron-right" size={24} color={colors.deepTeal} /></Pressable>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metric}><AppText variant="tiny" color={colors.muted}>Trabalhadas</AppText><AppText variant="subtitle">{reportLoading || visibleLoadError ? '—' : formatMinutesHHMM(totals.workedMinutes)}</AppText></View>
          <View style={styles.metric}><AppText variant="tiny" color={colors.muted}>Extras acima de 8h/dia</AppText><AppText variant="subtitle" color={colors.coral}>{reportLoading || visibleLoadError ? '—' : formatMinutesHHMM(totals.overtimeMinutes)}</AppText></View>
        </View>
      </SurfaceCard>

      <View style={styles.toolbar}>
        <View style={styles.toggleGroup} accessibilityRole="tablist">
          <Pressable onPress={() => changeMode('month')} accessibilityRole="tab" accessibilityState={{ selected: mode === 'month' }} style={[styles.toggle, mode === 'month' && { backgroundColor: colors.deepTeal }]}><AppText variant="tiny" color={mode === 'month' ? '#FFFFFF' : colors.deepTeal}>Mês</AppText></Pressable>
          <Pressable onPress={() => changeMode('week')} accessibilityRole="tab" accessibilityState={{ selected: mode === 'week' }} style={[styles.toggle, mode === 'week' && { backgroundColor: colors.deepTeal }]}><AppText variant="tiny" color={mode === 'week' ? '#FFFFFF' : colors.deepTeal}>Semana</AppText></Pressable>
        </View>
        {mode === 'month' ? <View style={{ flexDirection: 'row', gap: 8 }}><ActionButton title={exporting === 'pdf' ? 'Gerando…' : 'PDF'} variant="outline" loading={exporting === 'pdf'} onPress={() => handleExport('pdf')} style={styles.smallButton} /><ActionButton title={exporting === 'csv' ? 'Gerando…' : 'CSV'} variant="outline" loading={exporting === 'csv'} onPress={() => handleExport('csv')} style={styles.smallButton} /></View> : null}
      </View>
      <View style={styles.detailToggle}><Pressable onPress={() => setTab('table')} accessibilityRole="button" accessibilityState={{ selected: tab === 'table' }} style={[styles.toggle, tab === 'table' && { backgroundColor: colors.input }]}><AppText variant="tiny" color={colors.deepTeal}>Detalhada</AppText></Pressable><Pressable onPress={() => setTab('grid')} accessibilityRole="button" accessibilityState={{ selected: tab === 'grid' }} style={[styles.toggle, tab === 'grid' && { backgroundColor: colors.input }]}><AppText variant="tiny" color={colors.deepTeal}>Compacta</AppText></Pressable></View>

      {mode === 'month' ? <ActionButton title={retroOpen ? 'Fechar lançamento retroativo' : 'Adicionar batida esquecida'} variant="outline" onPress={() => { setRetroOpen((value) => !value); setNotice(''); }} /> : null}
      {retroOpen && mode === 'month' ? <SurfaceCard style={{ gap: 12 }}><AppText variant="subtitle">Registrar horário que ficou faltando</AppText><AppText variant="small" color={colors.muted}>Informe uma data deste mês e uma justificativa. O app sugere a próxima batida permitida e bloqueia horários fora de ordem, futuros ou acima do limite.</AppText><TextField label="Data (AAAA-MM-DD)" value={retroDate} onChangeText={setRetroDate} autoCapitalize="none" placeholder="2026-11-03" maxLength={10} /><TextField label="Horário (HH:mm)" value={retroTime} onChangeText={setRetroTime} keyboardType="numbers-and-punctuation" placeholder="Ex.: 08:00" maxLength={5} /><TextField label="Justificativa" value={retroReason} onChangeText={setRetroReason} multiline placeholder="Ex.: esquecimento ao registrar a entrada" style={{ minHeight: 72, textAlignVertical: 'top' }} /><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><MaterialCommunityIcons name="information-outline" size={18} color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>Próxima batida: {getNextPunch(periodEntries.filter((entry) => entry.data === retroDate)) ? LABELS[getNextPunch(periodEntries.filter((entry) => entry.data === retroDate))!] : 'dia completo'}</AppText></View><ActionButton title="Salvar batida esquecida" onPress={saveRetroactive} loading={saving} disabled={!retroTime || !retroReason.trim()} /></SurfaceCard> : null}
      {reportLoading ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}><ActivityIndicator color={colors.deepTeal} /><AppText variant="small" color={colors.muted}>Carregando batidas de {periodTitle}…</AppText></View> : null}
      {syncNotice && !authUnavailable ? <AppText variant="small" color={colors.coral}>{syncNotice}</AppText> : null}
      {visibleLoadError ? <SurfaceCard tone="soft" style={{ gap: 10 }}><AppText variant="body" color={colors.error}>{visibleLoadError}</AppText>{!authUnavailable ? <ActionButton title="Tentar novamente" variant="outline" onPress={() => { setLoading(true); setLoadError(''); setRetryCount((value) => value + 1); }} /> : null}{visibleLoadError.toLowerCase().includes('sessão') ? <ActionButton title="Voltar ao login" onPress={() => router.replace('/login')} /> : null}</SurfaceCard> : null}
      {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
      {notice ? <AppText variant="small" color={colors.deepTeal}>{notice}</AppText> : null}
      {!reportLoading && !visibleLoadError ? <View style={{ gap: 10 }}>
        {dates.map((date) => {
          const rows = periodEntries.filter((entry) => entry.data === date);
          const daily = totalByDay.get(date);
          const status = statusByDate.get(date);
          const personalStatus = status?.status && status.status !== 'working' ? status.status : null;
          const standout = (daily?.workedMinutes ?? 0) >= 570;
          const find = (type: TimeEntry['tipo']) => rows.find((entry) => entry.tipo === type);
          return (
            <SurfaceCard key={date} style={[styles.dayCard, standout && { borderColor: colors.coral }]}>
              <View style={styles.dayHeading}>
                <View style={[styles.dayBadge, { backgroundColor: `${standout ? colors.coral : colors.teal}20` }]}><AppText variant="tiny" color={standout ? colors.error : colors.deepTeal}>{String(Number(date.slice(-2))).padStart(2, '0')}</AppText></View>
                <View style={{ flex: 1, gap: 2 }}><AppText variant="subtitle" style={{ textTransform: 'capitalize' }}>{dayLabel(date)}</AppText><AppText variant="tiny" color={colors.muted}>{fullDateLabel(date)} · {rows.length ? rows.some((entry) => entry.editado) ? 'Contém batida editada' : rows.some((entry) => entry.horario_informado_manual) ? 'Contém horário manual' : 'Batidas registradas' : personalStatus ? STATUS_LABELS[personalStatus] : 'Sem registro'}</AppText></View>
                {personalStatus ? <StatusPill tone={personalStatus === 'absence' ? 'yellow' : personalStatus === 'medical_leave' ? 'coral' : 'teal'}>{STATUS_LABELS[personalStatus]}</StatusPill> : daily ? <StatusPill tone={standout ? 'danger' : 'teal'}>{daily.workedHHMM} trabalhadas</StatusPill> : null}
              </View>
              {tab === 'table' ? <View style={styles.tableRow}>{TYPES.map((type) => {
                const entry = find(type);
                return <View key={type} style={styles.tableCell}><AppText variant="tiny" color={colors.muted}>{LABELS[type]}</AppText><AppText variant="small" style={{ fontWeight: '600' }}>{entry ? timeLabel(entry.registrado_em) : '—'}</AppText></View>;
              })}</View> : <View style={styles.compactList}>{TYPES.map((type) => { const entry = find(type); return <View key={type} style={styles.compactCell}><AppText variant="tiny" color={colors.muted}>{LABELS[type]}</AppText><AppText variant="small">{entry ? timeLabel(entry.registrado_em) : '—'}</AppText></View>; })}</View>}
              {rows.filter((entry) => entry.justificativa).map((entry) => <AppText key={`note-${entry.id}`} variant="tiny" color={colors.muted}>{LABELS[entry.tipo]} · {entry.justificativa}</AppText>)}
              <View style={styles.dayFooter}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{daily ? <AppText variant="tiny" color={colors.muted}>Extras: {daily.overtimeHHMM}</AppText> : personalStatus ? <AppText variant="tiny" color={colors.muted}>{STATUS_LABELS[personalStatus]}</AppText> : <AppText variant="tiny" color={colors.muted}>—</AppText>}{rows.some((entry) => entry.horario_informado_manual) ? <StatusPill tone="yellow">MANUAL</StatusPill> : null}</View>{mode === 'month' ? <View style={{ flexDirection: 'row', gap: 6 }}>{rows.map((entry) => <Pressable key={entry.id} onPress={() => startEdit(entry)} accessibilityRole="button" accessibilityLabel={`Editar ${LABELS[entry.tipo]} ${timeLabel(entry.registrado_em)}`} style={styles.iconButton}><MaterialCommunityIcons name="pencil-outline" size={16} color={colors.deepTeal} /></Pressable>)}</View> : null}</View>
            </SurfaceCard>
          );
        })}
      </View> : null}
      <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>Este espelho é um controle pessoal e não substitui o documento oficial do empregador. Edições exigem justificativa; para preservar a sequência, exclua batidas da última para a primeira.</AppText></SurfaceCard>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <KeyboardModalContent><SurfaceCard style={styles.modalCard}><View style={styles.modalHeading}><AppText variant="subtitle">Editar batida</AppText><Pressable onPress={() => setSelected(null)} accessibilityRole="button"><MaterialCommunityIcons name="close" size={23} color={colors.muted} /></Pressable></View><AppText variant="small" color={colors.muted}>{selected ? `${LABELS[selected.tipo]} · ${selected.data}` : ''}</AppText><TextField label="Novo horário (HH:mm)" value={editTime} onChangeText={setEditTime} keyboardType="numbers-and-punctuation" maxLength={5} /><TextField label="Justificativa" value={reason} onChangeText={setReason} multiline placeholder="Ex.: esquecimento ao registrar no app" style={{ minHeight: 78, textAlignVertical: 'top' }} />{notice ? <AppText variant="small" color={colors.error}>{notice}</AppText> : null}<ActionButton title="Salvar edição" onPress={saveEdit} loading={saving} /><ActionButton title="Excluir batida" variant="danger" onPress={() => { setDeleteTarget(selected); setSelected(null); }} /><ActionButton title="Cancelar" variant="outline" onPress={() => setSelected(null)} /></SurfaceCard></KeyboardModalContent>
      </Modal>
      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}><KeyboardModalContent><SurfaceCard style={styles.modalCard}><AppText variant="title">Excluir esta batida?</AppText><AppText variant="body" color={colors.muted}>{deleteTarget ? `${LABELS[deleteTarget.tipo]} às ${timeLabel(deleteTarget.registrado_em)} em ${deleteTarget.data}.` : ''} Esta ação não pode ser desfeita.</AppText><ActionButton title="Excluir definitivamente" variant="danger" onPress={confirmDelete} loading={saving} /><ActionButton title="Manter batida" variant="outline" onPress={() => setDeleteTarget(null)} /></SurfaceCard></KeyboardModalContent></Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 15, paddingTop: 18 },
  monthCard: { padding: 16, gap: 12 },
  monthControls: { flexDirection: 'row', alignItems: 'center' },
  monthArrow: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B6A6310' },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, backgroundColor: '#24B3A20D', borderRadius: 16, padding: 12, gap: 3 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  toggleGroup: { flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: '#0B6A630D' },
  detailToggle: { alignSelf: 'flex-start', flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: '#0B6A6308' },
  toggle: { borderRadius: 11, paddingVertical: 8, paddingHorizontal: 12 },
  smallButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 7 },
  dayCard: { padding: 14, gap: 10 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayBadge: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tableRow: { flexDirection: 'row', gap: 4 },
  tableCell: { flex: 1, minWidth: 0, gap: 3 },
  compactList: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  compactCell: { width: '46%', borderRadius: 12, backgroundColor: '#24B3A208', padding: 9, gap: 2 },
  dayFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DFEAE6', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#24B3A21A' },
  modalBackdrop: { flex: 1, backgroundColor: '#081A1880', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 13 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
