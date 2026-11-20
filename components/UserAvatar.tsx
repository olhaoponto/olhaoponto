import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppText, initials, useAppColors } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { getAvatar } from '@/utils/avatar-catalog';
import { getSelectedAvatarId } from '@/services/avatar-service';

export function UserAvatar({ size = 42 }: { size?: number }) {
  const colors = useAppColors();
  const profile = useAppStore((state) => state.profile);
  const journeyVersion = useAppStore((state) => state.journeyVersion);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getSelectedAvatarId().then((id) => { if (active) setAvatarId(id); });
    return () => { active = false; };
  }, [profile?.id, journeyVersion]);
  const avatar = avatarId ? getAvatar(avatarId) : undefined;
  return <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: `${colors.teal}25`, borderColor: `${colors.teal}70` }]}>
    {avatar ? <Image source={avatar.source} resizeMode="cover" style={{ width: size, height: size, borderRadius: size * 0.34 }} /> : <AppText variant="subtitle" color={colors.deepTeal}>{initials(profile?.nome).slice(0, 1)}</AppText>}
  </View>;
}

const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' } });
