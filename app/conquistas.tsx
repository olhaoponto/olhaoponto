import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, PageHeading, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { ACHIEVEMENTS, evaluateAchievements, type Achievement, type UnlockedAchievement } from '@/services/achievements-service';
import { useAppStore } from '@/store/app-store';

export default function AchievementsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [selected, setSelected] = useState<Achievement | null>(null);

  useEffect(() => {
    let active = true;
    void evaluateAchievements(profile?.id).then((result) => { if (active) setUnlocked(result.unlocked); });
    return () => { active = false; };
  }, [profile?.id]);

  const unlockedById = new Map(unlocked.map((item) => [item.id, item]));
  return (
    <ScreenShell contentStyle={styles.page}>
      <ActionButton title="Voltar" variant="ghost" onPress={() => router.back()} icon={<MaterialCommunityIcons name="arrow-left" size={18} color={colors.deepTeal} />} style={styles.back} />
      <PageHeading eyebrow="Suas conquistas" title="Medalhas" subtitle={`${unlocked.length} de ${ACHIEVEMENTS.length} desbloqueadas`} right={<AccountMenuButton />} />
      <View style={styles.grid}>
        {ACHIEVEMENTS.map((achievement) => {
          const earned = unlockedById.get(achievement.id);
          return (
            <Pressable key={achievement.id} onPress={() => setSelected(achievement)} accessibilityRole="button" accessibilityLabel={`${achievement.titulo}, ${earned ? 'conquistada' : 'bloqueada'}`} style={[styles.tile, { backgroundColor: colors.card, borderColor: earned ? colors.yellow : colors.border, opacity: earned ? 1 : 0.68 }]}>
              <View style={[styles.medal, { backgroundColor: earned ? `${colors.yellow}28` : colors.input }]}>
                <AppText style={{ fontSize: 32, lineHeight: 42, opacity: earned ? 1 : 0.45 }}>{earned ? achievement.icone : '🔒'}</AppText>
              </View>
              <AppText variant="small" style={styles.title} numberOfLines={2}>{achievement.titulo}</AppText>
              <AppText variant="tiny" color={earned ? colors.deepTeal : colors.muted}>{earned ? 'Desbloqueada' : 'Bloqueada'}</AppText>
            </Pressable>
          );
        })}
      </View>
      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel="Fechar detalhes da conquista" /><SurfaceCard style={styles.modalCard}>
          {selected ? <>
            <AppText style={{ fontSize: 52, lineHeight: 64, textAlign: 'center' }}>{unlockedById.has(selected.id) ? selected.icone : '🔒'}</AppText>
            <AppText variant="title" style={{ textAlign: 'center' }}>{selected.titulo}</AppText>
            <AppText variant="body" color={colors.muted} style={{ textAlign: 'center' }}>{selected.descricao}</AppText>
            <AppText variant="tiny" color={colors.deepTeal} style={{ textAlign: 'center' }}>{unlockedById.has(selected.id) ? `Desbloqueada em ${new Intl.DateTimeFormat('pt-BR').format(new Date(unlockedById.get(selected.id)!.desbloqueadaEm))}` : `Como desbloquear: ${selected.regra}.`}</AppText>
            <ActionButton title="Fechar" variant="outline" onPress={() => setSelected(null)} />
          </> : null}
        </SurfaceCard></View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14, paddingTop: 18 },
  back: { alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31.5%', minHeight: 145, borderWidth: 1, borderRadius: 18, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  medal: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', minHeight: 36 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#081A1880' },
  modalCard: { width: '100%', maxWidth: 380, alignSelf: 'center', alignItems: 'center', gap: 12 },
});
