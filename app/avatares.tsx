import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, PageHeading, ScreenShell, SurfaceCard, useAppColors } from '@/components/ui';
import { AccountMenuButton } from '@/components/AccountMenuButton';
import { useAppStore } from '@/store/app-store';
import { AVATARS, getAvatar, isUnlocked, type Avatar, type AvatarRarity } from '@/utils/avatar-catalog';
import { getProgress, getSelectedAvatarId, setSelectedAvatar } from '@/services/avatar-service';
import type { AvatarProgress } from '@/utils/avatar-catalog';

const filters: Array<{ label: string; value: AvatarRarity | 'todos' }> = [
  { label: 'Todos', value: 'todos' }, { label: 'Comum', value: 'comum' }, { label: 'Raro', value: 'raro' }, { label: 'Épico', value: 'epico' }, { label: 'Lendário', value: 'lendario' },
];
const rarityColor: Record<AvatarRarity, string> = { comum: '#9CA3AF', raro: '#3B82F6', epico: '#8B5CF6', lendario: '#D4A72C' };
const rarityLabel: Record<AvatarRarity, string> = { comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário' };
function missingText(avatar: Avatar, progress: AvatarProgress) {
  if (avatar.unlock.tipo === 'pecas') return `Faltam ${Math.max(0, avatar.unlock.valor - progress.pecas)} peças`;
  if (avatar.unlock.tipo === 'puzzles') return `Complete ${avatar.unlock.valor} quebra-cabeça${avatar.unlock.valor === 1 ? '' : 's'}`;
  return `Complete ${avatar.unlock.valor} ciclo${avatar.unlock.valor === 1 ? '' : 's'} do Sete Passos`;
}

export default function AvataresScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const journeyVersion = useAppStore((state) => state.journeyVersion);
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('todos');
  const [progress, setProgress] = useState<AvatarProgress>({ pecas: 0, ciclos: 0, puzzles: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Avatar | null>(null);
  useEffect(() => { let active = true; void Promise.all([getProgress(), getSelectedAvatarId()]).then(([nextProgress, nextSelected]) => { if (active) { setProgress(nextProgress); setSelectedId(nextSelected); } }); return () => { active = false; }; }, [profile?.id, journeyVersion]);
  const visible = useMemo(() => AVATARS.filter((avatar) => filter === 'todos' || avatar.raridade === filter), [filter]);
  const unlockedCount = AVATARS.filter((avatar) => isUnlocked(avatar, progress)).length;
  const useAvatar = async () => { if (!preview) return; await setSelectedAvatar(preview.id); setSelectedId(preview.id); setPreview(null); };
  return <ScreenShell contentStyle={styles.page}>
    <PageHeading eyebrow="Sua coleção" title="Meus avatares" subtitle={`${unlockedCount}/69 desbloqueados`} right={<AccountMenuButton />} />
    <View style={[styles.tabs, { borderColor: colors.border }]}>{filters.map((item) => <Pressable key={item.value} onPress={() => setFilter(item.value)} accessibilityRole="tab" accessibilityState={{ selected: filter === item.value }} style={[styles.tab, { backgroundColor: filter === item.value ? `${colors.teal}20` : 'transparent' }]}><AppText variant="tiny" color={filter === item.value ? colors.deepTeal : colors.muted}>{item.label}</AppText></Pressable>)}</View>
    <View style={styles.grid}>{visible.map((avatar) => { const unlocked = isUnlocked(avatar, progress); const chosen = selectedId === avatar.id; return <Pressable key={avatar.id} disabled={!unlocked} onPress={() => setPreview(avatar)} accessibilityRole="button" accessibilityLabel={unlocked ? `Usar ${avatar.nome}` : `${avatar.nome}, bloqueado`} style={[styles.tile, { borderColor: rarityColor[avatar.raridade], backgroundColor: colors.card }]}>
      <View style={[styles.imageWrap, { borderColor: rarityColor[avatar.raridade] }]}><Image source={avatar.source} resizeMode="cover" blurRadius={unlocked ? 0 : 14} style={styles.image} />{!unlocked ? <View style={styles.locked}><MaterialCommunityIcons name="lock-outline" size={21} color="#FFFFFF" /><AppText variant="tiny" color="#FFFFFF" style={styles.lockText}>{missingText(avatar, progress)}</AppText></View> : null}{chosen ? <View style={styles.check}><MaterialCommunityIcons name="check" size={15} color="#FFFFFF" /></View> : null}</View>
      <AppText variant="small" style={styles.name} numberOfLines={2}>{avatar.nome}</AppText><AppText variant="tiny" color={rarityColor[avatar.raridade]}>{rarityLabel[avatar.raridade]}</AppText>
    </Pressable>; })}</View>
    <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)}><View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel="Fechar prévia do avatar" /><SurfaceCard style={styles.modalCard}>{preview ? <><Image source={preview.source} style={styles.previewImage} /><AppText variant="title" style={{ textAlign: 'center' }}>{preview.nome}</AppText><AppText variant="small" color={rarityColor[preview.raridade]} style={{ textAlign: 'center' }}>{rarityLabel[preview.raridade]}</AppText><ActionButton title="Usar como foto" onPress={() => void useAvatar()} /><ActionButton title="Cancelar" variant="outline" onPress={() => setPreview(null)} /></> : null}</SurfaceCard></View></Modal>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  page: { gap: 14, paddingTop: 18 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 13, padding: 3 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '30.5%', borderWidth: 2, borderRadius: 15, padding: 6, alignItems: 'center', gap: 5 },
  imageWrap: { width: '100%', aspectRatio: 1, borderWidth: 2, borderRadius: 11, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  locked: { ...StyleSheet.absoluteFill, backgroundColor: '#102421B8', alignItems: 'center', justifyContent: 'center', padding: 4, gap: 3 },
  lockText: { textAlign: 'center', fontSize: 9, lineHeight: 12 },
  check: { position: 'absolute', right: 4, top: 4, width: 23, height: 23, borderRadius: 12, backgroundColor: '#0B6A63', alignItems: 'center', justifyContent: 'center' },
  name: { textAlign: 'center', minHeight: 34 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#081A1880' },
  modalCard: { width: '100%', maxWidth: 360, alignSelf: 'center', alignItems: 'center', gap: 9 },
  previewImage: { width: 190, height: 190, borderRadius: 48 },
});
