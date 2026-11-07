import { Tabs, useSegments } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useColors } from '@/hooks/use-colors';

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const { width, height } = useWindowDimensions();
  const currentSegment = segments.at(-1);
  const landscapeCounter = width > height && (currentSegment === 'index' || (segments.length === 1 && segments[0] === '(tabs)'));
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
      tabBarStyle: { paddingTop: 7, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.7, elevation: 8, display: landscapeCounter ? 'none' : 'flex' },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: icon('clock-time-four-outline') }} />
      <Tabs.Screen name="espelho" options={{ title: 'Espelho', tabBarIcon: icon('calendar-month-outline') }} />
      <Tabs.Screen name="resumo" options={{ title: 'Resumo', tabBarIcon: icon('chart-box-outline') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('account-circle-outline') }} />
    </Tabs>
  );
}
