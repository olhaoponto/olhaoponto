import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { loadRanking, type RankingPeriod, type RankingRow } from '@/services/ranking-service';
import { useAppStore } from '@/store/app-store';

export function TeamRankingCard() {
  const colors = useAppColors(); const profile = useAppStore((s) => s.profile); const [period, setPeriod] = useState<RankingPeriod>('semana'); const [rows, setRows] = useState<RankingRow[]>([]); const [offline, setOffline] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void loadRanking(period).then((result) => { if (!active) return; setRows(result.rows); setOffline(result.offline); setError(result.error); }); return () => { active = false; }; }, [period, profile?.ranking_participa]);
  if (!profile) return null;
  return <SurfaceCard style={styles.card}>
    <View style={styles.header}><View style={[styles.icon, { backgroundColor: `${colors.coral}20` }]}><MaterialCommunityIcons name="trophy-outline" size={22} color={colors.coral} /></View><View style={{ flex: 1 }}><AppText variant="subtitle">Disputa da equipe</AppText><AppText variant="tiny" color={colors.muted}>Diversão entre colegas — não é avaliação de desempenho.</AppText></View></View>
    <View style={[styles.tabs, { borderColor: colors.border }]}>{(['semana', 'geral'] as RankingPeriod[]).map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={[styles.tab, { backgroundColor: period === item ? `${colors.teal}18` : 'transparent' }]}><AppText variant="small" color={period === item ? colors.deepTeal : colors.muted}>{item === 'semana' ? 'Semana' : 'Geral'}</AppText></Pressable>)}</View>
    {!profile.ranking_participa ? <View style={styles.empty}><AppText variant="small">Quer participar?</AppText><AppText variant="tiny" color={colors.muted}>Ative sua participação em Configurações. Os colegas verão apenas seu apelido e peças encaixadas.</AppText></View> : null}
    {offline ? <AppText variant="tiny" color={colors.muted}>Exibindo o último resultado salvo. Suas peças sincronizam quando houver internet.</AppText> : null}
    {error && !rows.length && profile.ranking_participa ? <AppText variant="small" color={colors.muted}>A disputa começa quando um colega entrar.</AppText> : null}
    {rows.map((row, index) => <View key={`${row.posicao}-${row.apelido}`} style={[styles.row, { borderColor: row.eh_voce ? colors.teal : colors.border, backgroundColor: row.eh_voce ? `${colors.teal}10` : colors.input }]} accessibilityLabel={`${row.posicao}º lugar, ${row.apelido}, ${row.pecas} peças`}><AppText variant="subtitle" color={index < 3 ? ['#E7B84B','#B8C2CC','#C98B5A'][index] : colors.muted} style={styles.position}>{row.posicao}º</AppText><MaterialCommunityIcons name="clock-outline" size={18} color={colors.teal} /><View style={{ flex: 1 }}><AppText variant="small" style={{ fontWeight: '700' }}>{row.apelido}{row.eh_voce ? ' · você' : ''}</AppText><AppText variant="tiny" color={colors.muted}>{row.pecas} peça(s) · {row.quebra_cabecas} quadro(s) concluído(s)</AppText></View></View>)}
  </SurfaceCard>;
}
const styles = StyleSheet.create({ card: { gap: 12 }, header: { flexDirection: 'row', gap: 10, alignItems: 'center' }, icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 }, row: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, padding: 10 }, position: { width: 34, textAlign: 'center' }, empty: { gap: 4, padding: 10, borderRadius: 12, backgroundColor: '#00000008' } });
