import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText, ScreenShell, SurfaceCard, useAppColors } from "@/components/ui";
import { useAppStore } from "@/store/app-store";
import { getLunchGameState } from "@/utils/lunch-game";

export default function LunchGamesHub() {
  const router = useRouter();
  const colors = useAppColors();
  const entries = useAppStore((state) => state.entries);
  const userId = useAppStore((state) => state.session?.user.id ?? null);
  const lunchState = useMemo(() => getLunchGameState(entries), [entries]);

  if (!userId || lunchState.status === "locked") {
    return <ScreenShell contentStyle={styles.centerPage}><SurfaceCard style={styles.lockCard}><AppText style={styles.heroEmoji}>🍱</AppText><AppText variant="title" style={styles.centerText}>Jogos do almoço</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Disponível depois de bater a saída do almoço.</AppText><Pressable onPress={() => router.replace("/(tabs)")} style={[styles.primaryButton, { backgroundColor: colors.deepTeal }]}><AppText variant="small" color="#FFFFFF" style={styles.buttonText}>Voltar para Hoje</AppText></Pressable></SurfaceCard></ScreenShell>;
  }

  if (lunchState.status === "closed") {
    return <ScreenShell contentStyle={styles.centerPage}><SurfaceCard style={styles.lockCard}><AppText style={styles.heroEmoji}>🌿</AppText><AppText variant="title" style={styles.centerText}>Intervalo encerrado</AppText><AppText variant="body" color={colors.muted} style={styles.centerText}>Intervalo encerrado. Bom retorno!</AppText><Pressable onPress={() => router.replace("/(tabs)")} style={[styles.primaryButton, { backgroundColor: colors.deepTeal }]}><AppText variant="small" color="#FFFFFF" style={styles.buttonText}>Voltar para Hoje</AppText></Pressable></SurfaceCard></ScreenShell>;
  }

  return <ScreenShell contentStyle={styles.page}>
    <View style={styles.heading}><Pressable onPress={() => router.replace("/(tabs)")} accessibilityRole="button" accessibilityLabel="Voltar para Hoje" style={styles.back}><MaterialCommunityIcons name="arrow-left" size={20} color={colors.deepTeal} /></Pressable><View style={{ flex: 1 }}><AppText variant="tiny" color={colors.deepTeal} style={styles.eyebrow}>INTERVALO SOLO</AppText><AppText variant="title">Jogos do almoço</AppText><AppText variant="small" color={colors.muted}>Escolha uma pausa rápida para jogar.</AppText></View></View>
    <View style={styles.cards}>
      <Pressable onPress={() => router.push("/mahjong-almoco")} accessibilityRole="button" accessibilityLabel="Abrir Mahjong do almoço"><SurfaceCard style={[styles.gameCard, { borderColor: `${colors.coral}70` }]}><View style={[styles.iconBubble, { backgroundColor: `${colors.coral}20` }]}><MaterialCommunityIcons name="view-grid-plus-outline" size={36} color={colors.coral} /></View><View style={styles.cardCopy}><AppText variant="title">Mahjong</AppText><AppText variant="body" color={colors.muted}>Combine pares em fases crescentes, com tabuleiro resolvível e bônus.</AppText><AppText variant="small" color={colors.deepTeal} style={styles.cardAction}>Jogar Mahjong  ›</AppText></View></SurfaceCard></Pressable>
      <Pressable onPress={() => router.push("/domino-almoco")} accessibilityRole="button" accessibilityLabel="Abrir Dominó do almoço"><SurfaceCard style={[styles.gameCard, { borderColor: `${colors.deepTeal}70` }]}><View style={[styles.iconBubble, { backgroundColor: `${colors.teal}20` }]}><MaterialCommunityIcons name="domino-mask" size={36} color={colors.deepTeal} /></View><View style={styles.cardCopy}><AppText variant="title">Dominó</AppText><AppText variant="body" color={colors.muted}>Você contra o computador. Jogue nas pontas e feche a partida até 6 pontos.</AppText><AppText variant="small" color={colors.deepTeal} style={styles.cardAction}>Jogar Dominó  ›</AppText></View></SurfaceCard></Pressable>
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  page: { gap: 22 },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#24B3A210" },
  eyebrow: { letterSpacing: 1.5, fontWeight: "800" },
  cards: { gap: 16 },
  gameCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20, minHeight: 164, borderWidth: 2 },
  iconBubble: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardCopy: { flex: 1, gap: 7 },
  cardAction: { fontWeight: "800", marginTop: 3 },
  centerPage: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "#E4F5F2" },
  lockCard: { alignItems: "center", gap: 13, padding: 24 },
  heroEmoji: { fontSize: 52, lineHeight: 62 },
  centerText: { textAlign: "center" },
  primaryButton: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4 },
  buttonText: { fontWeight: "700" },
});
