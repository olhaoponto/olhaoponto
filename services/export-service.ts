import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { Profile, TimeEntry } from '@/types/app';
import { calculateDailyTotals, calculatePeriodTotals, formatMinutesHHMM } from '@/utils/work-time';
import { getActiveWorkSchedule } from '@/utils/work-schedules';

const zone = 'America/Bahia';
const labels = { entrada: 'Entrada', saida_almoco: 'Saída almoço', volta_almoco: 'Volta almoço', saida: 'Saída' } as const;
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
const localTime = (stamp: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(new Date(stamp));
const weekday = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: zone, weekday: 'long' }).format(new Date(`${date}T12:00:00Z`));

function rowsForDay(entries: TimeEntry[], date: string) {
  const rows = entries.filter((entry) => entry.data === date);
  const find = (type: TimeEntry['tipo']) => rows.find((entry) => entry.tipo === type);
  return { rows, entrada: find('entrada'), saida_almoco: find('saida_almoco'), volta_almoco: find('volta_almoco'), saida: find('saida') };
}

export function buildCsv(profile: Profile, entries: TimeEntry[], month: string): string {
  const workSchedule = getActiveWorkSchedule(profile.preferencias_alerta, profile.almoco_minutos ?? 60);
  const totals = calculateDailyTotals(entries, new Date(), workSchedule);
  const totalByDay = new Map(totals.map((item) => [item.date, item]));
  const dates = [...new Set(entries.map((entry) => entry.data))].sort();
  const header = ['Data', 'Dia da semana', 'Entrada', 'Saída para almoço', 'Volta do almoço', 'Saída', 'Total trabalhado', 'Horas extras acima da jornada', 'Observações'];
  const csvRows = [header];
  for (const date of dates) {
    const values = rowsForDay(entries, date);
    const summary = totalByDay.get(date);
    const annotation = values.rows.some((entry) => entry.editado) ? 'Editado' : values.rows.some((entry) => entry.horario_informado_manual) ? 'Horário informado manualmente' : '';
    csvRows.push([date, weekday(date), values.entrada ? localTime(values.entrada.registrado_em) : '', values.saida_almoco ? localTime(values.saida_almoco.registrado_em) : '', values.volta_almoco ? localTime(values.volta_almoco.registrado_em) : '', values.saida ? localTime(values.saida.registrado_em) : '', summary?.workedHHMM ?? '00:00', summary?.overtimeHHMM ?? '00:00', annotation]);
  }
  const totalsPeriod = calculatePeriodTotals(entries, new Date(), workSchedule);
  csvRows.push(['', 'TOTAL DO MÊS', '', '', '', '', totalsPeriod.workedHHMM, totalsPeriod.overtimeHHMM, '']);
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return `\uFEFF${csvRows.map((row) => row.map((value) => quote(String(value))).join(';')).join('\r\n')}`;
}

export async function exportJson(profile: Profile, entries: TimeEntry[], month: string): Promise<string> {
  const workSchedule = getActiveWorkSchedule(profile.preferencias_alerta, profile.almoco_minutos ?? 60);
  const payload = { app: 'Olha o Ponto', exportado_em: new Date().toISOString(), periodo: month, perfil: { nome: profile.nome, email: profile.email }, batidas: entries, totais: calculatePeriodTotals(entries, new Date(), workSchedule) };
  const uri = `${FileSystem.cacheDirectory}olha-o-ponto-${month}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Exportar meus dados' });
  return uri;
}

export async function exportCsv(profile: Profile, entries: TimeEntry[], month: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}olha-o-ponto-${month}.csv`;
  await FileSystem.writeAsStringAsync(uri, buildCsv(profile, entries, month), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Compartilhar espelho de ponto' });
  return uri;
}

export async function exportPdf(profile: Profile, entries: TimeEntry[], monthLabel: string): Promise<string> {
  const workSchedule = getActiveWorkSchedule(profile.preferencias_alerta, profile.almoco_minutos ?? 60);
  const totals = calculatePeriodTotals(entries, new Date(), workSchedule);
  const dates = [...new Set(entries.map((entry) => entry.data))].sort();
  const bodyRows = dates.map((date) => {
    const values = rowsForDay(entries, date);
    const daily = totals.days.find((item) => item.date === date);
    const time = (entry?: TimeEntry) => entry ? localTime(entry.registrado_em) : '—';
    const edited = values.rows.some((entry) => entry.editado) ? 'Editado' : values.rows.some((entry) => entry.horario_informado_manual) ? 'Manual' : '';
    return `<tr><td>${escape(date)}</td><td>${escape(weekday(date))}</td><td>${time(values.entrada)}</td><td>${time(values.saida_almoco)}</td><td>${time(values.volta_almoco)}</td><td>${time(values.saida)}</td><td>${daily?.workedHHMM ?? '00:00'}</td><td>${daily?.overtimeHHMM ?? '00:00'}</td><td>${edited}</td></tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#173b39;padding:28px}h1{font-size:22px;color:#0b6a63;margin:0 0 6px}p{font-size:11px;color:#5d716d;margin:0 0 18px}.summary{display:flex;gap:20px;margin-bottom:20px}.metric{background:#eef7f4;border-radius:10px;padding:12px 15px;font-size:11px}.metric b{display:block;font-size:16px;margin-top:5px;color:#0b6a63}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#0b6a63;color:white;text-align:left;padding:8px 5px}td{border-bottom:1px solid #dce8e4;padding:7px 5px}.note{margin-top:18px;padding:10px;background:#fbf5df;border-radius:8px;color:#4c5e59;font-size:10px}
  </style></head><body><h1>Olha o Ponto — Espelho pessoal</h1><p>${escape(profile.nome)} · ${escape(monthLabel)} · Fuso horário America/Bahia</p><div class="summary"><div class="metric">Horas trabalhadas<b>${formatMinutesHHMM(totals.workedMinutes)}</b></div><div class="metric">Horas extras estimadas (acima da jornada do dia)<b>${formatMinutesHHMM(totals.overtimeMinutes)}</b></div></div><table><thead><tr><th>Data</th><th>Dia</th><th>Entrada</th><th>Almoço</th><th>Volta</th><th>Saída</th><th>Total</th><th>Extras</th><th>Obs.</th></tr></thead><tbody>${bodyRows || '<tr><td colspan="9">Sem batidas no período.</td></tr>'}</tbody></table><div class="note">Este relatório é um controle pessoal de acompanhamento. Não substitui o espelho oficial do empregador nem constitui orientação jurídica.</div></body></html>`;
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar espelho de ponto' });
  return uri;
}
