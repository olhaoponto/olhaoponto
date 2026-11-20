import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import { loadRanking, type RankingPeriod, type RankingResult, type RankingRow } from '@/services/ranking-service';
import { getPodiumColumns, getRankingRowsFourToTen, getUserOutsideTopTen } from '@/utils/ranking-podium';

function pointsLabel(points: number) { return `${points} pts`; }

function PodiumColumn({ row, colors }: { row: RankingRow; colors: ReturnType<typeof useAppColors> }) {
  const isFirst = row.posicao === 1;
  const medal = row.posicao === 1 ? '🥇' : row.posicao === 2 ? '🥈' : '🥉';
  const podiumColor = row.posicao === 1 ? '#D2A83E' : row.posicao === 2 ? colors.muted : '#B9784E';
  return <View style={[styles.podiumColumn, isFirst ? styles.firstColumn : styles.sideColumn]}>
    <AppText style={styles.medal}>{medal}</AppText>
    {row.eh_voce ? <UserAvatar size={30} /> : null}<AppText variant="small" color={row.eh_voce ? colors.deepTeal : colors.foreground} style={styles.podiumName} numberOfLines={1}>{row.nome}</AppText>
    <AppText variant="tiny" color={colors.muted}>{pointsLabel(row.pontos)}</AppText>
    <View style={[styles.podiumBlock, { backgroundColor: `${podiumColor}35`, borderColor: `${podiumColor}80`, height: isFirst ? 100 : row.posicao === 2 ? 72 : 56 }]}><AppText variant="subtitle" color={colors.deepTeal} style={styles.position}>{row.posicao}º</AppText></View>
  </View>;
}

function RankingLine({ row, colors }: { row: RankingRow; colors: ReturnType<typeof useAppColors> }) {
  return <View style={[styles.rankingLine, { borderBottomColor: colors.border, backgroundColor: row.eh_voce ? `${colors.teal}18` : 'transparent' }]}>
    <AppText variant="small" color={colors.muted} style={styles.positionLabel}>{row.posicao}º</AppText>
    {row.eh_voce ? <UserAvatar size={24} /> : null}<AppText variant="small" color={colors.foreground} style={styles.lineName} numberOfLines={1}>{row.nome}</AppText>
    {row.eh_voce ? <AppText variant="tiny" color={colors.deepTeal} style={styles.youLabel}>Você</AppText> : null}
    <AppText variant="small" color={colors.deepTeal} style={styles.points}>{pointsLabel(row.pontos)}</AppText>
  </View>;
}

export function RankingPodium() {
  const colors = useAppColors();
  const [period, setPeriod] = useState<RankingPeriod>('semana');
  const [result, setResult] = useState<RankingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadRanking(period).then((next) => { if (active) { setResult(next); setLoading(false); } });
    return () => { active = false; };
  }, [period]);

  const rows = result?.rows ?? [];
  const podium = getPodiumColumns(rows);
  const topRows = getRankingRowsFourToTen(rows);
  const outside = getUserOutsideTopTen(rows);

  return <SurfaceCard style={styles.card}>
    <View style={styles.heading}><View style={styles.headingIcon}><MaterialCommunityIcons name="trophy-outline" size={21} color={colors.coral} /></View><View style={styles.headingCopy}><AppText variant="subtitle">Ranking de pontos</AppText><AppText variant="tiny" color={colors.muted}>Quem está pontuando junto com você</AppText></View></View>
    <View style={[styles.tabs, { borderColor: colors.border }]}>
      {(['semana', 'geral'] as const).map((value) => <Pressable key={value} onPress={() => setPeriod(value)} accessibilityRole="tab" accessibilityState={{ selected: period === value }} style={[styles.tab, { backgroundColor: period === value ? `${colors.teal}20` : 'transparent' }]}><AppText variant="small" color={period === value ? colors.deepTeal : colors.muted}>{value === 'semana' ? 'Semana' : 'Geral'}</AppText></Pressable>)}
    </View>
    {loading ? <View style={styles.state}><AppText variant="small" color={colors.muted}>Carregando ranking…</AppText></View> : !rows.length ? <View style={styles.state}><AppText variant="small" color={colors.muted}>Seja o primeiro a pontuar hoje!</AppText>{result?.error ? <AppText variant="tiny" color={colors.muted}>{result.error}</AppText> : null}</View> : <>
      {result?.offline ? <AppText variant="tiny" color={colors.coral}>Sem conexão: mostrando o último ranking salvo.</AppText> : null}
      <View style={styles.podium}>{podium.map((row) => <PodiumColumn key={row.posicao} row={row} colors={colors} />)}</View>
      {topRows.length ? <View style={styles.list}>{topRows.map((row) => <RankingLine key={row.posicao} row={row} colors={colors} />)}</View> : null}
      {outside ? <View style={[styles.outside, { borderColor: `${colors.teal}55`, backgroundColor: `${colors.teal}12` }]}><AppText variant="small" color={colors.deepTeal}>Sua posição: Nº {outside.posicao} · {pointsLabel(outside.pontos)}</AppText></View> : null}
    </>}
    <AppText variant="tiny" color={colors.muted} style={styles.footer}>10 pts por batida · +20 no dia completo. Só horários reais contam.</AppText>
  </SurfaceCard>;
}

const styles = StyleSheet.create({
  card: { gap: 13 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EF79671F', alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, gap: 2 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 8 },
  state: { minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 5 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 7, minHeight: 170 },
  podiumColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, maxWidth: 112 },
  firstColumn: { minHeight: 170 },
  sideColumn: { minHeight: 140 },
  medal: { fontSize: 24, lineHeight: 30 },
  podiumName: { fontWeight: '700', maxWidth: 100 },
  podiumBlock: { width: '100%', borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, alignItems: 'center', justifyContent: 'center' },
  position: { fontWeight: '800' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE8E4' },
  rankingLine: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  positionLabel: { width: 25, textAlign: 'center' },
  lineName: { flex: 1 },
  youLabel: { fontWeight: '800' },
  points: { fontWeight: '700' },
  outside: { borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  footer: { textAlign: 'center', paddingTop: 2 },
});
