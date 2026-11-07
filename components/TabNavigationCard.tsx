import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, useAppColors } from '@/components/ui';
import { APP_TAB_ROUTES, type AppTabKey } from '@/utils/app-routes';

const items: { key: AppTabKey; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'index', label: 'HOJE', icon: 'clock-time-four-outline' },
  { key: 'espelho', label: 'ESPELHO', icon: 'calendar-month-outline' },
  { key: 'resumo', label: 'RESUMO', icon: 'chart-box-outline' },
  { key: 'perfil', label: 'PERFIL', icon: 'account-circle-outline' },
];

export function TabNavigationCard({ active = 'index' }: { active?: AppTabKey }) {
  const colors = useAppColors();
  const router = useRouter();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="tablist">
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => router.replace(APP_TAB_ROUTES[item.key])}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            style={[styles.item, selected && { backgroundColor: `${colors.teal}18` }]}
          >
            <MaterialCommunityIcons name={item.icon} size={19} color={selected ? colors.deepTeal : colors.muted} />
            <AppText variant="tiny" color={selected ? colors.deepTeal : colors.muted} style={styles.label}>{item.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 66, borderWidth: 1, borderRadius: 19, padding: 5, flexDirection: 'row', alignItems: 'stretch', gap: 4 },
  item: { flex: 1, minWidth: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2, paddingVertical: 5 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
});
