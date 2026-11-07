import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useThemeContext } from '@/lib/theme-provider';
import { SchemeColors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G, Path } from 'react-native-svg';

export const extraColors = {
  teal: '#24B3A2',
  deepTeal: '#0B6A63',
  yellow: '#F2C648',
  coral: '#EF7967',
  cream: '#FAF8EF',
  ink: '#173B39',
};

export function useAppColors() {
  const { colorScheme } = useThemeContext();
  const scheme = SchemeColors[colorScheme];
  return {
    ...scheme,
    teal: extraColors.teal,
    deepTeal: colorScheme === 'dark' ? '#45C4B1' : extraColors.deepTeal,
    yellow: colorScheme === 'dark' ? '#F4C44D' : extraColors.yellow,
    coral: colorScheme === 'dark' ? '#FF7B70' : extraColors.coral,
    cream: colorScheme === 'dark' ? '#172927' : extraColors.cream,
    input: colorScheme === 'dark' ? '#203835' : '#F7FAF8',
    card: scheme.surface,
  };
}

export function AppText({
  children,
  variant = 'body',
  color,
  style,
  ...props
}: React.ComponentProps<typeof Text> & {
  variant?: 'hero' | 'title' | 'subtitle' | 'body' | 'small' | 'tiny';
  color?: string;
}) {
  const colors = useAppColors();
  const sizes = { hero: 42, title: 28, subtitle: 18, body: 15, small: 13, tiny: 11 };
  const weights: Record<typeof variant, TextStyle['fontWeight']> = {
    hero: '700', title: '700', subtitle: '600', body: '400', small: '500', tiny: '500',
  };
  return (
    <Text
      {...props}
      style={[
        { color: color ?? colors.foreground, fontSize: sizes[variant], fontWeight: weights[variant], fontFamily: variant === 'hero' || variant === 'title' ? 'Inter_700Bold' : variant === 'subtitle' ? 'Inter_600SemiBold' : variant === 'small' || variant === 'tiny' ? 'Inter_500Medium' : 'Inter_400Regular', lineHeight: sizes[variant] * 1.35 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function ScreenShell({
  children,
  scroll = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useAppColors();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={[styles.pageContent, contentStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.pageContent, { flex: 1 }, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export function KeyboardModalContent({ children, contentStyle }: { children: React.ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[{ flexGrow: 1, justifyContent: 'center', padding: 18, backgroundColor: '#081A1880' }, contentStyle]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function SurfaceCard({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'soft' | 'outlined';
}) {
  const colors = useAppColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tone === 'soft' ? colors.input : colors.card, borderColor: colors.border },
        tone === 'outlined' && { backgroundColor: 'transparent', borderWidth: 1, elevation: 0, shadowOpacity: 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const colors = useAppColors();
  const backgrounds = {
    primary: colors.deepTeal,
    secondary: colors.input,
    outline: 'transparent',
    danger: colors.error,
    ghost: 'transparent',
  };
  const foreground = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.deepTeal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={disabled || loading}
      onPress={async () => {
        if (disabled || loading) return;
        if (typeof Haptics !== 'undefined') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        await onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: backgrounds[variant], borderColor: variant === 'outline' ? colors.border : backgrounds[variant], opacity: disabled ? 0.48 : pressed ? 0.84 : 1 },
        variant === 'outline' && { borderWidth: 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : <>{icon}<AppText variant="body" color={foreground} style={{ fontWeight: '700' }}>{title}</AppText></>}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  style,
  rightAccessory,
  ...props
}: TextInputProps & { label?: string; error?: string; rightAccessory?: React.ReactNode }) {
  const colors = useAppColors();
  return (
    <View style={{ gap: 7 }}>
      {label ? <AppText variant="small" style={{ fontWeight: '600' }}>{label}</AppText> : null}
      <View>
        <TextInput
          {...props}
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            { color: colors.foreground, borderColor: error ? colors.error : colors.border, backgroundColor: colors.input },
            rightAccessory ? { paddingRight: 54 } : null,
            style,
          ]}
        />
        {rightAccessory ? <View style={styles.inputAccessory}>{rightAccessory}</View> : null}
      </View>
      {error ? <AppText variant="tiny" color={colors.error}>{error}</AppText> : null}
    </View>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const colors = useAppColors();
  return (
    <View style={styles.headingRow}>
      <View style={{ flex: 1, gap: 5 }}>
        {eyebrow ? <AppText variant="tiny" color={colors.deepTeal} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>{eyebrow}</AppText> : null}
        <AppText variant="title">{title}</AppText>
        {subtitle ? <AppText variant="small" color={colors.muted}>{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

export function BackNavigationButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useAppColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.backButton}>
      <MaterialCommunityIcons name="arrow-left" size={19} color={colors.deepTeal} />
      <AppText variant="small" color={colors.deepTeal} style={{ fontWeight: '700' }}>{label}</AppText>
    </Pressable>
  );
}

export function StatusPill({
  children,
  tone = 'teal',
}: {
  children: React.ReactNode;
  tone?: 'teal' | 'yellow' | 'coral' | 'neutral' | 'danger';
}) {
  const colors = useAppColors();
  const stylesByTone = {
    teal: { bg: `${colors.teal}20`, fg: colors.deepTeal },
    yellow: { bg: `${colors.yellow}30`, fg: colors.foreground },
    coral: { bg: `${colors.coral}24`, fg: colors.error },
    neutral: { bg: colors.input, fg: colors.muted },
    danger: { bg: `${colors.error}20`, fg: colors.error },
  };
  const selected = stylesByTone[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: selected.bg, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}>
      <AppText variant="tiny" color={selected.fg} style={{ fontWeight: '700' }}>{children}</AppText>
    </View>
  );
}

export function ClockMascot({ size = 64, worried = false }: { size?: number; worried?: boolean }) {
  const colors = useAppColors();
  const ink = colors.foreground;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={worried ? 'Mascote relógio preocupado' : 'Mascote relógio'}>
      <Circle cx="50" cy="50" r="38" fill={colors.cream} stroke={colors.deepTeal} strokeWidth="8" />
      <Path d="M50 20v7M50 73v7M20 50h7M73 50h7" stroke={colors.teal} strokeWidth="4" strokeLinecap="round" />
      <Path d="M50 32v19l13 8" fill="none" stroke={colors.teal} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <G fill={ink}><Circle cx="40" cy="57" r="2.6" /><Circle cx="60" cy="57" r="2.6" /></G>
      <Path d={worried ? 'M43 68q7-7 14 0' : 'M42 66q8 8 16 0'} fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M44 8h12" stroke={colors.yellow} strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

export function Divider() {
  const colors = useAppColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, width: '100%' }} />;
}

export function initials(name?: string | null) {
  return (name || 'OP').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

const styles = StyleSheet.create({
  pageContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: { borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#DFEAE6', shadowColor: '#183B36', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2, gap: 14 },
  button: { minHeight: 54, borderRadius: 17, paddingHorizontal: 20, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 3 },
  inputAccessory: { position: 'absolute', right: 8, top: 0, bottom: 0, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 11, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#24B3A210' },
});
