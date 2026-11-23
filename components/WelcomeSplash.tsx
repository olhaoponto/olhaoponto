import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppText, ScreenShell } from "@/components/ui";
import {
  getDailyWelcome,
  getWelcomeMessageStorageKey,
  type WelcomeScene,
} from "@/utils/welcome-message";
import { useAppStore } from "@/store/app-store";
import { calculateWelcomeFrame } from "@/utils/welcome-frame";

const DURATION_MS = 11500;
const WELCOME_ASSET_WIDTH = 1080;
const WELCOME_ASSET_HEIGHT = 2340;
const webSceneImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center center",
} as any;
const sceneImages: Record<WelcomeScene, number> = {
  "bem-estar": require("../assets/boasvindas/bem-estar.webp"),
  motivacao: require("../assets/boasvindas/motivacao.webp"),
  organizacao: require("../assets/boasvindas/organizacao.webp"),
  gratidao: require("../assets/boasvindas/gratidao.webp"),
  humor: require("../assets/boasvindas/humor.webp"),
  ponto: require("../assets/boasvindas/ponto.webp"),
  natal: require("../assets/boasvindas/natal.webp"),
  anonovo: require("../assets/boasvindas/anonovo.webp"),
  carnaval: require("../assets/boasvindas/carnaval.webp"),
  junina: require("../assets/boasvindas/junina.webp"),
};

export function WelcomeSplash({ onContinue }: { onContinue: () => void }) {
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const sessionUserId = useAppStore((state) => state.session?.user.id ?? null);
  const profile = useAppStore((state) => state.profile);
  const userId =
    profile?.ativo === true && profile.id === sessionUserId
      ? sessionUserId
      : null;
  const openedAt = useMemo(() => new Date(), []);
  const [welcome, setWelcome] = useState(() => getDailyWelcome(openedAt));
  const [progress] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  const completed = useRef(false);
  const webFrame =
    Platform.OS === "web"
      ? calculateWelcomeFrame(
          viewportWidth,
          viewportHeight,
          WELCOME_ASSET_WIDTH,
          WELCOME_ASSET_HEIGHT,
        )
      : null;
  const webScale = webFrame?.scale ?? 1;
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    let active = true;
    const loadWelcome = async () => {
      let previousMessage: string | null = null;
      const storageKey = userId ? getWelcomeMessageStorageKey(userId) : null;
      if (storageKey) {
        try {
          previousMessage = await AsyncStorage.getItem(storageKey);
        } catch {
          previousMessage = null;
        }
      }
      if (!active) return;
      const nextWelcome = getDailyWelcome(openedAt, { previousMessage });
      setWelcome(nextWelcome);
      if (storageKey) {
        try {
          await AsyncStorage.setItem(storageKey, nextWelcome.message);
        } catch {
          /* opening remains usable */
        }
      }
    };
    void loadWelcome();
    return () => {
      active = false;
    };
  }, [openedAt, userId]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      return undefined;
    }
    fade.setValue(0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fade, reduceMotion]);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) finish();
    });
    return () => animation.stop();
  }, [finish, progress]);

  return (
    <ScreenShell
      scroll={false}
      edges={["top", "bottom", "left", "right"]}
      contentStyle={[styles.page, { backgroundColor: "#E4F5F2" }]}
    >
      <View style={Platform.OS === "web" ? styles.webViewport : undefined}>
        <Animated.View
          style={[
            styles.animatedContent,
            webFrame
              ? { width: webFrame.width, height: webFrame.height }
              : undefined,
            { opacity: fade },
          ]}
        >
          <ImageBackground
            source={sceneImages[welcome.scene]}
            resizeMode="cover"
            imageStyle={[
              styles.sceneImage,
              Platform.OS === "web" ? webSceneImageStyle : undefined,
            ]}
            style={[
              styles.background,
              Platform.OS === "web" ? styles.backgroundWeb : undefined,
            ]}
          >
            <View
              style={[
                styles.content,
                webFrame
                  ? {
                      paddingHorizontal: 26 * webScale,
                      paddingTop: 28 * webScale,
                      paddingBottom: 20 * webScale,
                    }
                  : undefined,
              ]}
            >
              <View style={styles.copy}>
                <View
                  style={[
                    styles.accentBar,
                    webFrame
                      ? {
                          width: 44 * webScale,
                          height: 5 * webScale,
                          marginBottom: 12 * webScale,
                        }
                      : undefined,
                    { backgroundColor: welcome.accent },
                  ]}
                />
                <AppText
                  variant="tiny"
                  color={welcome.accent}
                  style={[
                    styles.seasonLabel,
                    webFrame
                      ? {
                          marginBottom: 12 * webScale,
                          fontSize: 11 * webScale,
                          lineHeight: 15 * webScale,
                        }
                      : undefined,
                  ]}
                >
                  {welcome.seasonLabel}
                </AppText>
                <AppText
                  color={welcome.accent}
                  style={[
                    styles.quote,
                    webFrame
                      ? {
                          fontSize: 64 * webScale,
                          lineHeight: 50 * webScale,
                          height: 50 * webScale,
                        }
                      : undefined,
                  ]}
                  accessibilityLabel="Aspas da mensagem"
                >
                  “
                </AppText>
                <AppText
                  color="#0B4F5C"
                  style={[
                    styles.message,
                    webFrame
                      ? { fontSize: 28 * webScale, lineHeight: 35 * webScale }
                      : undefined,
                  ]}
                  adjustsFontSizeToFit
                  numberOfLines={6}
                >
                  {welcome.message}
                </AppText>
                <AppText
                  color={welcome.accent}
                  style={[
                    styles.author,
                    webFrame
                      ? {
                          fontSize: 15 * webScale,
                          lineHeight: 22 * webScale,
                          marginTop: 14 * webScale,
                        }
                      : undefined,
                  ]}
                >
                  {welcome.author}
                </AppText>
              </View>
              <View
                style={[
                  styles.footer,
                  webFrame ? { gap: 10 * webScale } : undefined,
                ]}
              >
                <View
                  style={styles.progressTrack}
                  accessibilityLabel="Abertura do aplicativo"
                  accessibilityRole="progressbar"
                >
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: welcome.accent,
                        width: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  >
                    <View
                      style={styles.clockDot}
                      accessibilityLabel="Progresso da abertura"
                    >
                      <View style={styles.clockHandShort} />
                      <View style={styles.clockHandLong} />
                    </View>
                  </Animated.View>
                </View>
                <AppText
                  color="#0B4F5C"
                  style={[
                    styles.brand,
                    webFrame
                      ? { fontSize: 12 * webScale, lineHeight: 16 * webScale }
                      : undefined,
                  ]}
                >
                  OLHA O PONTO
                </AppText>
                <Pressable
                  onPress={finish}
                  accessibilityRole="button"
                  accessibilityLabel="Entrar em Hoje agora"
                  style={[
                    styles.continueButton,
                    webFrame
                      ? {
                          borderRadius: 14 * webScale,
                          paddingHorizontal: 16 * webScale,
                          paddingVertical: 8 * webScale,
                        }
                      : undefined,
                    { borderColor: welcome.accent },
                  ]}
                >
                  <AppText
                    variant="small"
                    color="#0B4F5C"
                    style={[
                      styles.continueText,
                      webFrame
                        ? { fontSize: 13 * webScale, lineHeight: 18 * webScale }
                        : undefined,
                    ]}
                  >
                    Entrar em Hoje agora
                  </AppText>
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        </Animated.View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0, paddingVertical: 0 },
  animatedContent: { flex: 1 },
  webViewport: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  background: { flex: 1, width: "100%", minHeight: "100%" },
  backgroundWeb: { height: "100%", width: "100%" },
  sceneImage: { bottom: 0 },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 20,
  },
  copy: { maxWidth: 520, paddingTop: 4 },
  accentBar: { width: 44, height: 5, borderRadius: 3, marginBottom: 12 },
  seasonLabel: { letterSpacing: 2, fontWeight: "800", marginBottom: 12 },
  quote: {
    fontSize: 64,
    lineHeight: 50,
    fontWeight: "700",
    opacity: 0.35,
    height: 50,
  },
  message: { fontSize: 28, lineHeight: 35, fontWeight: "700", maxWidth: 500 },
  author: {
    alignSelf: "flex-end",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginTop: 14,
  },
  footer: { gap: 10, width: "100%" },
  progressTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: "#0B4F5C1F",
    overflow: "visible",
  },
  progressFill: {
    height: 12,
    borderRadius: 8,
    minWidth: 14,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  clockDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#0B4F5C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  clockHandShort: {
    position: "absolute",
    width: 2,
    height: 7,
    backgroundColor: "#0B4F5C",
    top: 6,
    borderRadius: 2,
  },
  clockHandLong: {
    position: "absolute",
    width: 2,
    height: 8,
    backgroundColor: "#0B4F5C",
    transform: [{ rotate: "125deg" }],
    top: 8,
    left: 12,
    borderRadius: 2,
  },
  brand: {
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  continueButton: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF66",
  },
  continueText: { fontWeight: "700" },
});
