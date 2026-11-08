import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionButton, AppText, SurfaceCard, initials, useAppColors } from '@/components/ui';
import { syncPendingEntries } from '@/services/time-entry-service';
import { logout } from '@/services/auth-service';
import { useAppStore } from '@/store/app-store';
import { APP_ROUTES } from '@/utils/app-routes';

export function AccountMenuButton() {
  const colors = useAppColors();
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

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
        style={[styles.avatar, { backgroundColor: `${colors.teal}25` }]}
      >
        <AppText variant="subtitle" color={colors.deepTeal}>{initials(profile?.nome)}</AppText>
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
});
