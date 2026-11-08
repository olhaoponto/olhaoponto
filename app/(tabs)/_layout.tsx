import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useColors } from '@/hooks/use-colors';

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'web' ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 59 + bottomPadding;
  const icon = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name']) => function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <MaterialCommunityIcons name={name} size={focused ? 24 : 22} color={color as string} />;
  };

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarButton: HapticTab,
      tabBarActiveTintColor: colors.tint,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { paddingTop: 7, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.7, elevation: 8 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: icon('clock-time-four-outline') }} />
      <Tabs.Screen name="espelho" options={{ title: 'Espelho', tabBarIcon: icon('calendar-month-outline') }} />
      <Tabs.Screen name="resumo" options={{ title: 'Resumo', tabBarIcon: icon('chart-box-outline') }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: icon('calendar-clock-outline') }} />
      <Tabs.Screen name="perfil" options={{ href: null }} />
    </Tabs>
  );
}
