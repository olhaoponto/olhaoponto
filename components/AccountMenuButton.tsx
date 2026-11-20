import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, useAppColors } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import { syncPendingEntries } from '@/services/time-entry-service';
import { logout } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';
import { APP_ROUTES } from '@/utils/app-routes';
import { AVATARS, isUnlocked, type Avatar, type AvatarProgress } from '@/utils/avatar-catalog';
import { getProgress, getSelectedAvatarId, setSelectedAvatar } from '@/services/avatar-service';

const rarityColor = { comum: '#9CA3AF', raro: '#3B82F6', epico: '#8B5CF6', lendario: '#D4A72C' } as const;
function missingText(avatar: Avatar, progress: AvatarProgress) {
  if (avatar.unlock.tipo === 'pecas') return `Faltam ${Math.max(0, avatar.unlock.valor - progress.pecas)} peças`;
  if (avatar.unlock.tipo === 'puzzles') return `Complete ${avatar.unlock.valor} quebra-cabeça${avatar.unlock.valor === 1 ? '' : 's'}`;
  return `Complete ${avatar.unlock.valor} ciclo${avatar.unlock.valor === 1 ? '' : 's'} do Sete Passos`;
}

export function AccountMenuButton() {
  const colors = useAppColors();
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const journeyVersion = useAppStore((state) => state.journeyVersion);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [progress, setProgress] = useState<AvatarProgress>({ pecas: 0, ciclos: 0, puzzles: 0 });
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState('');

  useEffect(() => {
    if (!visible || !profile?.id) return;
    let active = true;
    void Promise.all([getProgress(), getSelectedAvatarId()]).then(([nextProgress, nextSelected]) => {
      if (active) { setProgress(nextProgress); setSelectedAvatarId(nextSelected); setAvatarMessage(''); }
    });
    return () => { active = false; };
  }, [profile?.id, journeyVersion, visible]);

  const close = () => { setVisible(false); setError(''); };
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError('');
    try {
      const synced = await syncPendingEntries();
      if (!synced.data || synced.data.failed > 0) {
        setError(synced.error || 'Há batidas aguardando sincronização. Conecte-se à internet e tente novamente antes de sair.');
        return;
      }
      await logout();
      setVisible(false);
      router.replace('/login');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível sair agora. Tente novamente.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => { setError(''); setVisible(true); }}
        accessibilityRole="button"
        accessibilityLabel="Abrir menu Perfil, Configurações e Sair do Sistema"
        style={styles.avatar}
      >
        <UserAvatar size={48} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Fechar menu da conta" />
          <SurfaceCard style={styles.card}>
            <View style={styles.heading}>
              <View style={{ flex: 1, gap: 3 }}>
                <AppText variant="subtitle">Sua conta</AppText>
                <AppText variant="small" color={colors.muted}>{profile?.email || 'Conta Olha o Ponto'}</AppText>
              </View>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Fechar menu">
                <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.avatarPicker}>
              <UserAvatar size={64} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ alignSelf: 'stretch', width: '100%', maxWidth: '100%', flexGrow: 0 }} contentContainerStyle={styles.avatarStrip}>
                {AVATARS.map((avatar) => {
                  const unlocked = isUnlocked(avatar, progress);
                  const chosen = selectedAvatarId === avatar.id;
                  return <Pressable key={avatar.id} onPress={async () => { if (!unlocked) { setAvatarMessage(missingText(avatar, progress)); return; } await setSelectedAvatar(avatar.id); setSelectedAvatarId(avatar.id); setAvatarMessage('Avatar atualizado.'); useAppStore.getState().bumpJourney(); }} accessibilityRole="button" accessibilityLabel={unlocked ? `Escolher ${avatar.nome}` : `${avatar.nome}, bloqueado`} style={[styles.avatarChoice, { borderColor: rarityColor[avatar.raridade] }]}>
                    <View style={styles.avatarImageWrap}><Image source={avatar.source} blurRadius={unlocked ? 0 : 10} style={styles.avatarImage} />{!unlocked ? <View style={styles.avatarLock}><MaterialCommunityIcons name="lock-outline" size={15} color="#FFFFFF" /></View> : null}{chosen ? <View style={styles.avatarCheck}><MaterialCommunityIcons name="check" size={12} color="#FFFFFF" /></View> : null}</View>
                  </Pressable>;
                })}
              </ScrollView>
            </View>
            {avatarMessage ? <AppText variant="tiny" color={colors.deepTeal}>{avatarMessage}</AppText> : null}
            <ActionButton title="Ver coleção completa" variant="outline" onPress={() => { close(); router.push('/avatares'); }} icon={<MaterialCommunityIcons name="image-multiple-outline" size={18} color={colors.deepTeal} />} />
            {error ? <AppText variant="small" color={colors.error} accessibilityRole="alert">{error}</AppText> : null}
            <ActionButton title="Perfil" variant="outline" onPress={() => { close(); router.replace(APP_ROUTES.perfil); }} icon={<MaterialCommunityIcons name="account-outline" size={19} color={colors.deepTeal} />} />
            <ActionButton title="Configurações" variant="outline" onPress={() => { close(); router.replace(APP_ROUTES.configuracoes); }} icon={<MaterialCommunityIcons name="cog-outline" size={19} color={colors.deepTeal} />} />
            <ActionButton title="Sair do Sistema" variant="outline" onPress={handleSignOut} loading={signingOut} icon={<MaterialCommunityIcons name="logout" size={19} color={colors.deepTeal} />} />
          </SurfaceCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#1024218A' },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  avatarPicker: { alignItems: 'center', alignSelf: 'stretch', minWidth: 0, gap: 9 },
  avatarStrip: { alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingVertical: 3 },
  avatarChoice: { width: 58, height: 58, borderWidth: 2, borderRadius: 17, padding: 2 },
  avatarImageWrap: { width: '100%', height: '100%', borderRadius: 13, overflow: 'hidden', position: 'relative' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLock: { ...StyleSheet.absoluteFill, backgroundColor: '#102421B8', alignItems: 'center', justifyContent: 'center' },
  avatarCheck: { position: 'absolute', right: 2, top: 2, width: 17, height: 17, borderRadius: 9, backgroundColor: '#0B6A63', alignItems: 'center', justifyContent: 'center' },
});
