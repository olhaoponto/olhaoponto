import '@/global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Platform, Pressable, Text, View } from 'react-native';
import '@/lib/_core/nativewind-pressable';
import { ThemeProvider, useThemeContext } from '@/lib/theme-provider';
import { SafeAreaFrameContext, SafeAreaInsetsContext, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import type { EdgeInsets, Metrics, Rect } from 'react-native-safe-area-context';
import { trpc, createTRPCClient } from '@/lib/trpc';
import { initManusRuntime, subscribeSafeAreaInsets } from '@/lib/_core/manus-runtime';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/services/supabase';
import { useAppStore } from '@/store/app-store';
import { SchemeColors } from '@/constants/theme';
import GlobalAlertOverlay from '@/components/GlobalAlertOverlay';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = { anchor: '(tabs)' };

function SessionBridge() {
  useEffect(() => {
    let alive = true;
    let eventVersion = 0;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventVersion += 1;
      const state = useAppStore.getState();
      if (!session) {
        state.setProfile(null);
        state.setEntries([]);
        state.setOffline(false);
        void Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
      } else if (state.profile && state.profile.id !== session.user.id) {
        state.setProfile(null);
        state.setEntries([]);
        state.setOffline(false);
      }
      state.setSession(session);
    });
    const initialVersion = eventVersion;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      const state = useAppStore.getState();
      if (eventVersion === initialVersion) state.setSession(error ? null : data.session);
      else state.setSessionInitialized(true);
    }).catch(() => { if (alive) useAppStore.getState().setSessionInitialized(true); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  return null;
}

function AppStack() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const pendingNotification = useRef<{ type: 'work-alert' | 'lunch-return' | 'lunch-start'; level: string; userId?: string } | null>(null);
  const handledNotification = useRef('');
  const [notificationVersion, setNotificationVersion] = useState(0);
  const { colorScheme, setColorScheme } = useThemeContext();
  const preferredTheme = profile?.preferencias_alerta?.tema;
  useEffect(() => {
    if (preferredTheme === 'dark' || preferredTheme === 'light') setColorScheme(preferredTheme);
  }, [preferredTheme, setColorScheme]);
  useEffect(() => {
    const consume = (response: Notifications.NotificationResponse) => {
      const request = response.notification.request;
      const dedupeKey = `${request.identifier}:${response.actionIdentifier}`;
      if (handledNotification.current === dedupeKey) return;
      handledNotification.current = dedupeKey;
      const data = request.content.data as { type?: string; level?: string; user_id?: string };
      if (data.type !== 'work-alert' && data.type !== 'lunch-return' && data.type !== 'lunch-start') return;
      const currentUserId = useAppStore.getState().profile?.id;
      if (currentUserId && data.user_id && currentUserId !== data.user_id) return;
      pendingNotification.current = { type: data.type, level: data.level ?? '8h', userId: data.user_id };
      setNotificationVersion((version) => version + 1);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(consume);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) consume(response); }).catch(() => undefined);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const pending = pendingNotification.current;
    if (!pending || !profile?.id) return;
    pendingNotification.current = null;
    if (pending.userId && pending.userId !== profile.id) return;
    router.push({ pathname: '/alert', params: { level: pending.level, type: pending.type } });
  }, [notificationVersion, profile?.id, router]);
  return (
    <>
      <SessionBridge />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: SchemeColors[colorScheme].background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="auth/reset-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alert" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="about" />
      </Stack>
      <GlobalAlertOverlay />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => { initManusRuntime(); }, []);
  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => { setInsets(metrics.insets); setFrame(metrics.frame); }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }));
  const [trpcClient] = useState(() => createTRPCClient());
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return { ...metrics, insets: { ...metrics.insets, top: Math.max(metrics.insets.top, 16), bottom: Math.max(metrics.insets.bottom, 12) } };
  }, [initialInsets, initialFrame]);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}><AppStack /></QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );
  const providers = Platform.OS === 'web'
    ? <SafeAreaProvider initialMetrics={providerInitialMetrics}><SafeAreaFrameContext.Provider value={frame}><SafeAreaInsetsContext.Provider value={insets}>{content}</SafeAreaInsetsContext.Provider></SafeAreaFrameContext.Provider></SafeAreaProvider>
    : <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>;
  return <ThemeProvider>{providers}</ThemeProvider>;
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#F6FAF8' }} accessibilityRole="alert">
      <Text style={{ color: '#0B4F4B', fontSize: 24, fontWeight: '700' }}>Algo não saiu como esperado</Text>
      <Text style={{ color: '#526864', fontSize: 16, lineHeight: 23 }}>Seus dados sincronizados continuam protegidos. Tente abrir esta tela novamente; se o problema persistir, feche e reabra o aplicativo.</Text>
      <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="Tentar novamente" style={{ minHeight: 50, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#0B6A63' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}
