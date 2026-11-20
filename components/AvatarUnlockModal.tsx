import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { getProgress, getUnseenUnlockedAvatars, markAvatarsSeen, setSelectedAvatar } from '@/services/avatar-service';
import type { Avatar } from '@/utils/avatar-catalog';

const rarityLabel = { comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário' } as const;
const rarityColor = { comum: '#9CA3AF', raro: '#3B82F6', epico: '#8B5CF6', lendario: '#D4A72C' } as const;

export function AvatarUnlockModal() {
  const colors = useAppColors();
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const journeyVersion = useAppStore((state) => state.journeyVersion);
  const [queue, setQueue] = useState<Avatar[]>([]);
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(0.86)).current;
  useEffect(() => {
    if (!profile?.id || journeyVersion === 0) return;
    let active = true;
    void getProgress().then((progress) => getUnseenUnlockedAvatars(progress)).then((avatars) => {
      if (active && avatars.length) { setQueue(avatars); setVisible(true); }
    });
    return () => { active = false; };
  }, [profile?.id, journeyVersion]);
  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.86);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 150 }).start();
  }, [scale, visible]);
  const bulk = queue.length > 3;
  const current = bulk ? [...queue].sort((a, b) => ({ comum: 0, raro: 1, epico: 2, lendario: 3 }[b.raridade] - ({ comum: 0, raro: 1, epico: 2, lendario: 3 }[a.raridade])))[0] : queue[0];
  const close = async (ids: string[]) => {
    await markAvatarsSeen(ids);
    setQueue((items) => bulk ? [] : items.slice(1));
    setVisible(!bulk && queue.length > 1);
  };
  const useNow = async () => {
    if (!current) return;
    await setSelectedAvatar(current.id);
    useAppStore.getState().bumpJourney();
    await close(bulk ? queue.map((item) => item.id) : [current.id]);
  };
  const seeCollection = async () => {
    await close(queue.map((item) => item.id));
    router.push('/avatares');
  };
  if (!current) return null;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void close(bulk ? queue.map((item) => item.id) : [current.id])}>
    <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => void close(bulk ? queue.map((item) => item.id) : [current.id])} accessibilityRole="button" accessibilityLabel="Fechar desbloqueio de avatar" /><Animated.View style={{ transform: [{ scale }] }}><SurfaceCard style={styles.card}>
      <MaterialCommunityIcons name="party-popper" size={28} color={colors.coral} />
      <AppText variant="subtitle" style={{ textAlign: 'center' }}>{bulk ? `Você desbloqueou ${queue.length} avatares!` : 'Parabéns! Você desbloqueou um avatar'}</AppText>
      <Image source={current.source} style={styles.image} />
      <AppText variant="title" style={{ textAlign: 'center' }}>{current.nome}</AppText>
      <AppText variant="small" color={rarityColor[current.raridade]} style={styles.rarity}>{rarityLabel[current.raridade]}</AppText>
      {bulk ? <ActionButton title="Ver coleção" onPress={() => void seeCollection()} /> : <ActionButton title="Usar agora" onPress={() => void useNow()} />}
      {!bulk ? <ActionButton title="Depois" variant="outline" onPress={() => void close([current.id])} /> : null}
    </SurfaceCard></Animated.View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: '#081A1880' },
  card: { width: '100%', maxWidth: 390, alignSelf: 'center', alignItems: 'center', gap: 9 },
  image: { width: 190, height: 190, borderRadius: 48 },
  rarity: { fontWeight: '700' },
});
