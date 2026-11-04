import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COLORS = ['#F2C14E', '#EF7967', '#2F9E8F', '#75CDBA', '#FFE4A8', '#0E5B56'];
const pieces = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  color: COLORS[index % COLORS.length],
  dx: ((index * 47) % 230) - 115,
  dy: 135 + (index % 5) * 24,
  delay: (index % 9) * 32,
  rotation: ((index * 61) % 540) - 270,
  width: 6 + (index % 4) * 2,
  height: 7 + (index % 3) * 2,
}));

function ConfettiPiece({ piece }: { piece: (typeof pieces)[number] }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(piece.delay, withTiming(1, { duration: 1050 }));
  }, [piece.delay, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, piece.dx]) },
      { translateY: interpolate(progress.value, [0, 1], [-24, piece.dy]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, piece.rotation])}deg` },
    ],
  }));
  return <Animated.View style={[styles.piece, { backgroundColor: piece.color, width: piece.width, height: piece.height, marginLeft: -piece.width / 2 }, animatedStyle]} />;
}

export function ConfettiBurst({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <View pointerEvents="none" style={styles.layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{pieces.map((piece) => <ConfettiPiece key={piece.id} piece={piece} />)}</View>;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 20, overflow: 'hidden' },
  piece: { position: 'absolute', left: '50%', top: '34%', borderRadius: 2 },
});
