import { StyleSheet, View } from 'react-native';

export function ClockProgressBar({ progress, color, height = 12 }: { progress: number; color: string; height?: number }) {
  const value = Math.min(1, Math.max(0, progress));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: `${color}30` }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 1, now: value }}
    >
      <View style={[styles.fill, { width: `${value * 100}%`, minHeight: height, height, borderRadius: height / 2, backgroundColor: color }]}>
        <View style={styles.clockDot} accessibilityLabel="Progresso do contador">
          <View style={styles.clockHandShort} />
          <View style={styles.clockHandLong} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'visible' },
  fill: { minWidth: 14, alignItems: 'flex-end', justifyContent: 'center' },
  clockDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0B4F5C', alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  clockHandShort: { position: 'absolute', width: 2, height: 7, backgroundColor: '#0B4F5C', top: 6, borderRadius: 2 },
  clockHandLong: { position: 'absolute', width: 2, height: 8, backgroundColor: '#0B4F5C', transform: [{ rotate: '125deg' }], top: 8, left: 12, borderRadius: 2 },
});
