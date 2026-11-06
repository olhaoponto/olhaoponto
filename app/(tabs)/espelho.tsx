import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getDaysInMonth, subMonths, addMonths } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, AppText, PageHeading, ScreenShell, StatusPill, SurfaceCard, TextField, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { deleteTimeEntry, insertTimeEntry, loadEntriesByMonth, updateTimeEntry } from '@/services/time-entry-service';
import { exportCsv, exportPdf } from '@/services/export-service';
import { calculateDailyTotals, calculatePeriodTotals, formatMinutesHHMM, getNextPunch, validateEntries, validatePunch } from '@/utils/work-time';
import type { TimeEntry } from '@/types/app';

const ZONE = 'America/Bahia';
const TYPES: TimeEntry['tipo'][] = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
const LABELS: Record<TimeEntry['tipo'], string> = { entrada: 'Entrada', saida_almoco: 'Almoço', volta_almoco: 'Volta', saida: 'Saída' };
const monthLabel = (key: string) => formatInTimeZone(new Date(`${key}-15T12:00:00Z`), ZONE, 'MMMM yyyy');
const timeLabel = (value: string) => formatInTimeZone(new Date(value), ZONE, 'HH:mm');
const dayLabel = (key: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: ZONE, weekday: 'short' }).format(new Date(`${key}T12:00:00Z`));

export default function EspelhoScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.session);
  const sessionInitialized = useAppStore((state) => state.sessionInitialized);
  const entries = useAppStore((state) => state.entries);
  const setEntries = useAppStore((state) => state.setEntries);
  const [month, setMonth] = useState(() => formatInTimeZone(new Date(), ZONE, 'yyyy-MM'));
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

  const userId = session?.user.id;
  const authUnavailable = sessionInitialized && !userId;
  const reportLoading = !sessionInitialized || (!authUnavailable && loading);
  const visibleLoadError = authUnavailable ? 'Sua sessão não está ativa. Entre novamente para consultar o espelho.' : loadError;
  useEffect(() => {
    let alive = true;
    if (!sessionInitialized || !userId) return () => { alive = false; };
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setLoading(true); setLoadError(''); setSyncNotice('');
      try {
        const result = await loadEntriesByMonth(new Date(`${month}-15T12:00:00Z`));
        if (!alive) return;
        if (result.data) setEntries(result.data);
        if (result.error && result.data?.length) {
          setSyncNotice('Sem conexão com o Supabase. Exibindo os registros salvos neste aparelho; tente sincronizar novamente.');
          setLoadError('');
        } else if (result.error) {
          setLoadError(result.error.toLowerCase().includes('sessão') ? result.error : 'Não foi possível carregar este mês. Confira sua conexão e tente novamente.');
          setSyncNotice('');
        } else { setLoadError(''); setSyncNotice(''); }
      } catch {
        if (alive) { setLoadError('Não foi possível carregar este mês. Confira sua conexão e tente novamente.'); setSyncNotice(''); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [month, userId, sessionInitialized, retryCount, setEntries]);

  const monthEntries = useMemo(() => entries.filter((entry) => entry.data?.startsWith(month)), [entries, month]);
  const dailyTotals = useMemo(() => calculateDailyTotals(monthEntries), [monthEntries]);
  const totals = useMemo(() => calculatePeriodTotals(monthEntries), [monthEntries]);
  const totalByDay = new Map(dailyTotals.map((item) => [item.date, item]));
  const [yearString, monthNumber] = month.split('-');
  const year = Number(yearString);
  const countDays = getDaysInMonth(new Date(year, Number(monthNumber) - 1, 15));
  const dates = Array.from({ length: countDays }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
  const startEdit = (entry: TimeEntry) => { setSelected(entry); setEditTime(timeLabel(entry.registrado_em)); setReason(entry.justificativa || ''); setNotice(''); };
  const changeMonth = (amount: -1 | 1) => {
    const next = formatInTimeZone(amount < 0 ? subMonths(new Date(`${month}-15T12:00:00Z`), 1) : addMonths(new Date(`${month}-15T12:00:00Z`), 1), ZONE, 'yyyy-MM');
    const today = formatInTimeZone(new Date(), ZONE, 'yyyy-MM-dd');
    setRetroDate(today.startsWith(next) ? today : `${next}-01`);
    setLoading(true); setError(''); setLoadError(''); setSyncNotice(''); setMonth(next);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(editTime)) { setNotice('Informe o horário no formato HH:mm.'); return; }
    if (reason.trim().length < 3) { setNotice('Inclua uma justificativa curta para registrar a edição.'); return; }
    const timestamp = fromZonedTime(`${selected.data}T${editTime}:00`, profile?.fuso || ZONE).toISOString();
    const candidateRows = monthEntries.map((entry) => entry.id === selected.id ? { ...entry, registrado_em: timestamp, data: selected.data, horario_informado_manual: true, editado: true, justificativa: reason.trim() } : entry).filter((entry) => entry.data === selected.data);
    const validation = validateEntries(candidateRows, new Date(), profile?.limite_minutos ?? 600);
    if (!validation.valid) { setNotice(validation.message || 'A edição não é válida para a sequência do dia.'); return; }
    setSaving(true); setNotice('');
    const result = await updateTimeEntry(selected.id, { registrado_em: timestamp, horario_informado_manual: true, editado: true, justificativa: reason.trim() });
    setSaving(false);
    if (result.error || !result.data) { setNotice(result.error || 'Não foi possível salvar a edição.'); return; }
    setEntries(monthEntries.map((entry) => entry.id === selected.id ? result.data! : entry));
    setSelected(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const sameDay = monthEntries.filter((entry) => entry.data === deleteTarget.data).sort((a, b) => a.registrado_em.localeCompare(b.registrado_em));
    if (sameDay.at(-1)?.id !== deleteTarget.id) { setNotice('Para manter a ordem das batidas, exclua primeiro a última batida do dia.'); setDeleteTarget(null); return; }
    setSaving(true);
    const result = await deleteTimeEntry(deleteTarget.id);
    setSaving(false);
    if (result.error) { setNotice(result.error); setDeleteTarget(null); return; }
    setEntries(monthEntries.filter((entry) => entry.id !== deleteTarget.id));
    setDeleteTarget(null);
    setNotice('Batida removida.');
  };

  const saveRetroactive = async () => {
    if (!profile) return;
    setNotice('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(retroDate) || formatInTimeZone(new Date(`${retroDate}T12:00:00Z`), ZONE, 'yyyy-MM-dd') !== retroDate) { setNotice('Informe uma data válida no formato AAAA-MM-DD.'); return; }
    if (!retroDate.startsWith(month)) { setNotice('Escolha uma data dentro do mês selecionado.'); return; }
    const today = formatInTimeZone(new Date(), ZONE, 'yyyy-MM-dd');
    if (retroDate > today) { setNotice('Não é permitido registrar batidas em uma data futura.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(retroTime)) { setNotice('Informe o horário no formato HH:mm.'); return; }
    if (retroReason.trim().length < 3) { setNotice('Inclua uma justificativa curta para a batida esquecida.'); return; }
    const dayEntries = monthEntries.filter((entry) => entry.data === retroDate);
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
    setEntries([...monthEntries.filter((entry) => entry.id !== result.data!.id), result.data].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em)));
    setRetroTime(''); setRetroReason(''); setRetroOpen(false);
    setNotice((result.data as TimeEntry & { _pending?: boolean })._pending ? 'Batida esquecida guardada no aparelho e aguardando sincronização.' : 'Batida esquecida registrada com justificativa.');
  };

  const handleExport = async (kind: 'pdf' | 'csv') => {
    if (!profile) return;
    setExporting(kind); setError('');
    try {
      if (kind === 'pdf') await exportPdf(profile, monthEntries, monthLabel(month));
      else await exportCsv(profile, monthEntries, month);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o arquivo.'); }
    finally { setExporting(''); }
  };

  return (
    <ScreenShell contentStyle={styles.page}>
      <PageHeading eyebrow="Seu histórico pessoal" title="Espelho de ponto" subtitle="Horários que você registrou no app." right={<MaterialCommunityIcons name="calendar-month-outline" size={27} color={colors.deepTeal} />} />
      <SurfaceCard style={styles.monthCard}>
        <View style={styles.monthControls}>
          <Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow} accessibilityRole="button" accessibilityLabel="Mês anterior"><MaterialCommunityIcons name="chevron-left" size={24} color={colors.deepTeal} /></Pressable>
          <View style={{ alignItems: 'center', flex: 1, gap: 2 }}><AppText variant="subtitle" style={{ textTransform: 'capitalize' }}>{monthLabel(month)}</AppText><AppText variant="tiny" color={colors.muted}>{reportLoading ? 'Carregando registros…' : visibleLoadError ? 'Período indisponível' : `${monthEntries.length} batida(s) registradas`}</AppText></View>
          <Pressable onPress={() => changeMonth(1)} style={styles.monthArrow} accessibilityRole="button" accessibilityLabel="Próximo mês"><MaterialCommunityIcons name="chevron-right" size={24} color={colors.deepTeal} /></Pressable>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metric}><AppText variant="tiny" color={colors.muted}>Trabalhadas</AppText><AppText variant="subtitle">{reportLoading || visibleLoadError ? '—' : formatMinutesHHMM(totals.workedMinutes)}</AppText></View>
          <View style={styles.metric}><AppText variant="tiny" color={colors.muted}>Extras acima de 8h/dia</AppText><AppText variant="subtitle" color={colors.coral}>{reportLoading || visibleLoadError ? '—' : formatMinutesHHMM(totals.overtimeMinutes)}</AppText></View>
        </View>
      </SurfaceCard>

      <View style={styles.toolbar}>
        <View style={styles.toggleGroup}><Pressable onPress={() => setTab('table')} style={[styles.toggle, tab === 'table' && { backgroundColor: colors.deepTeal }]}><AppText variant="tiny" color={tab === 'table' ? '#FFFFFF' : colors.deepTeal}>Tabela</AppText></Pressable><Pressable onPress={() => setTab('grid')} style={[styles.toggle, tab === 'grid' && { backgroundColor: colors.deepTeal }]}><AppText variant="tiny" color={tab === 'grid' ? '#FFFFFF' : colors.deepTeal}>Compacto</AppText></Pressable></View>
        <View style={{ flexDirection: 'row', gap: 8 }}><ActionButton title={exporting === 'pdf' ? 'Gerando…' : 'PDF'} variant="outline" loading={exporting === 'pdf'} onPress={() => handleExport('pdf')} style={styles.smallButton} /><ActionButton title={exporting === 'csv' ? 'Gerando…' : 'CSV'} variant="outline" loading={exporting === 'csv'} onPress={() => handleExport('csv')} style={styles.smallButton} /></View>
      </View>
      <ActionButton title={retroOpen ? 'Fechar lançamento retroativo' : 'Adicionar batida esquecida'} variant="outline" onPress={() => { setRetroOpen((value) => !value); setNotice(''); }} />
      {retroOpen ? <SurfaceCard style={{ gap: 12 }}><AppText variant="subtitle">Registrar horário que ficou faltando</AppText><AppText variant="small" color={colors.muted}>Informe uma data deste mês e uma justificativa. O app sugere a próxima batida permitida e bloqueia horários fora de ordem, futuros ou acima do limite.</AppText><TextField label="Data (AAAA-MM-DD)" value={retroDate} onChangeText={setRetroDate} autoCapitalize="none" placeholder="2026-11-03" maxLength={10} /><TextField label="Horário (HH:mm)" value={retroTime} onChangeText={setRetroTime} keyboardType="numbers-and-punctuation" placeholder="Ex.: 08:00" maxLength={5} /><TextField label="Justificativa" value={retroReason} onChangeText={setRetroReason} multiline placeholder="Ex.: esquecimento ao registrar a entrada" style={{ minHeight: 72, textAlignVertical: 'top' }} /><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><MaterialCommunityIcons name="information-outline" size={18} color={colors.deepTeal} /><AppText variant="small" color={colors.deepTeal}>Próxima batida: {getNextPunch(monthEntries.filter((entry) => entry.data === retroDate)) ? LABELS[getNextPunch(monthEntries.filter((entry) => entry.data === retroDate))!] : 'dia completo'}</AppText></View><ActionButton title="Salvar batida esquecida" onPress={saveRetroactive} loading={saving} disabled={!retroTime || !retroReason.trim()} /></SurfaceCard> : null}
      {reportLoading ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}><ActivityIndicator color={colors.deepTeal} /><AppText variant="small" color={colors.muted}>Carregando batidas de {monthLabel(month)}…</AppText></View> : null}
      {syncNotice && !authUnavailable ? <AppText variant="small" color={colors.coral}>{syncNotice}</AppText> : null}
      {visibleLoadError ? <SurfaceCard tone="soft" style={{ gap: 10 }}><AppText variant="body" color={colors.error}>{visibleLoadError}</AppText>{!authUnavailable ? <ActionButton title="Tentar novamente" variant="outline" onPress={() => { setLoading(true); setLoadError(''); setRetryCount((value) => value + 1); }} /> : null}{visibleLoadError.toLowerCase().includes('sessão') ? <ActionButton title="Voltar ao login" onPress={() => router.replace('/login')} /> : null}</SurfaceCard> : null}
      {error ? <AppText variant="small" color={colors.error}>{error}</AppText> : null}
      {notice ? <AppText variant="small" color={colors.deepTeal}>{notice}</AppText> : null}
      {!reportLoading && !visibleLoadError ? <View style={{ gap: 10 }}>
        {dates.map((date) => {
          const rows = monthEntries.filter((entry) => entry.data === date);
          const daily = totalByDay.get(date);
          const standout = (daily?.workedMinutes ?? 0) >= 570;
          const find = (type: TimeEntry['tipo']) => rows.find((entry) => entry.tipo === type);
          return (
            <SurfaceCard key={date} style={[styles.dayCard, standout && { borderColor: colors.coral }]}>
              <View style={styles.dayHeading}>
                <View style={[styles.dayBadge, { backgroundColor: `${standout ? colors.coral : colors.teal}20` }]}><AppText variant="tiny" color={standout ? colors.error : colors.deepTeal}>{String(Number(date.slice(-2))).padStart(2, '0')}</AppText></View>
                <View style={{ flex: 1, gap: 2 }}><AppText variant="subtitle" style={{ textTransform: 'capitalize' }}>{dayLabel(date)}</AppText><AppText variant="tiny" color={colors.muted}>{rows.length ? rows.some((entry) => entry.editado) ? 'Contém batida editada' : rows.some((entry) => entry.horario_informado_manual) ? 'Contém horário manual' : 'Batidas registradas' : 'Sem registro'}</AppText></View>
                {daily ? <StatusPill tone={standout ? 'danger' : 'teal'}>{daily.workedHHMM} trabalhadas</StatusPill> : null}
              </View>
              {tab === 'table' ? <View style={styles.tableRow}>{TYPES.map((type) => {
                const entry = find(type);
                return <View key={type} style={styles.tableCell}><AppText variant="tiny" color={colors.muted}>{LABELS[type]}</AppText><AppText variant="small" style={{ fontWeight: '600' }}>{entry ? timeLabel(entry.registrado_em) : '—'}</AppText></View>;
              })}</View> : <View style={styles.compactList}>{TYPES.map((type) => { const entry = find(type); return <View key={type} style={styles.compactCell}><AppText variant="tiny" color={colors.muted}>{LABELS[type]}</AppText><AppText variant="small">{entry ? timeLabel(entry.registrado_em) : '—'}</AppText></View>; })}</View>}
              {rows.filter((entry) => entry.justificativa).map((entry) => <AppText key={`note-${entry.id}`} variant="tiny" color={colors.muted}>{LABELS[entry.tipo]} · {entry.justificativa}</AppText>)}
              <View style={styles.dayFooter}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{daily ? <AppText variant="tiny" color={colors.muted}>Extras: {daily.overtimeHHMM}</AppText> : <AppText variant="tiny" color={colors.muted}>—</AppText>}{rows.some((entry) => entry.horario_informado_manual) ? <StatusPill tone="yellow">MANUAL</StatusPill> : null}</View><View style={{ flexDirection: 'row', gap: 6 }}>{rows.map((entry) => <Pressable key={entry.id} onPress={() => startEdit(entry)} accessibilityRole="button" accessibilityLabel={`Editar ${LABELS[entry.tipo]} ${timeLabel(entry.registrado_em)}`} style={styles.iconButton}><MaterialCommunityIcons name="pencil-outline" size={16} color={colors.deepTeal} /></Pressable>)}</View></View>
            </SurfaceCard>
          );
        })}
      </View> : null}
      <SurfaceCard tone="soft"><AppText variant="small" color={colors.muted}>Este espelho é um controle pessoal e não substitui o documento oficial do empregador. Edições exigem justificativa; para preservar a sequência, exclua batidas da última para a primeira.</AppText></SurfaceCard>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}><SurfaceCard style={styles.modalCard}><View style={styles.modalHeading}><AppText variant="subtitle">Editar batida</AppText><Pressable onPress={() => setSelected(null)} accessibilityRole="button"><MaterialCommunityIcons name="close" size={23} color={colors.muted} /></Pressable></View><AppText variant="small" color={colors.muted}>{selected ? `${LABELS[selected.tipo]} · ${selected.data}` : ''}</AppText><TextField label="Novo horário (HH:mm)" value={editTime} onChangeText={setEditTime} keyboardType="numbers-and-punctuation" maxLength={5} /><TextField label="Justificativa" value={reason} onChangeText={setReason} multiline placeholder="Ex.: esquecimento ao registrar no app" style={{ minHeight: 78, textAlignVertical: 'top' }} />{notice ? <AppText variant="small" color={colors.error}>{notice}</AppText> : null}<ActionButton title="Salvar edição" onPress={saveEdit} loading={saving} /><ActionButton title="Excluir batida" variant="danger" onPress={() => { setDeleteTarget(selected); setSelected(null); }} /><ActionButton title="Cancelar" variant="outline" onPress={() => setSelected(null)} /></SurfaceCard></View>
      </Modal>
      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}><View style={styles.modalBackdrop}><SurfaceCard style={styles.modalCard}><AppText variant="title">Excluir esta batida?</AppText><AppText variant="body" color={colors.muted}>{deleteTarget ? `${LABELS[deleteTarget.tipo]} às ${timeLabel(deleteTarget.registrado_em)} em ${deleteTarget.data}.` : ''} Esta ação não pode ser desfeita.</AppText><ActionButton title="Excluir definitivamente" variant="danger" onPress={confirmDelete} loading={saving} /><ActionButton title="Manter batida" variant="outline" onPress={() => setDeleteTarget(null)} /></SurfaceCard></View></Modal>
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
