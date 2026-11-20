import { getDaysInMonth } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useAppColors } from '@/components/ui';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dotColors = ['#F5B700', '#F28C28', '#2E9E5B', '#1E6FD9'];

const dateFromDay = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;
const monthParts = (month: string) => month.split('-').map(Number);

export function MirrorCalendar({ month, countByDate, statusDates, selectedDate, todayDate, onSelect }: {
  month: string;
  countByDate: Map<string, number>;
  statusDates: Set<string>;
  selectedDate: string | null;
  todayDate: string;
  onSelect: (date: string) => void;
}) {
  const colors = useAppColors();
  const [year, monthNumber] = monthParts(month);
  const totalDays = getDaysInMonth(new Date(year, monthNumber - 1, 15));
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1, 12)).getUTCDay();
  const cells = Array.from({ length: firstWeekday + totalDays }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);

  return (
    <View style={styles.container} accessibilityLabel={`Calendário de ${MONTHS[monthNumber - 1]} de ${year}`}>
      <View style={styles.weekHeader}>
        {WEEKDAYS.map((weekday, index) => <View key={`${weekday}-${index}`} style={styles.headerCell}><AppText variant="tiny" color={colors.muted} style={styles.weekday}>{weekday}</AppText></View>)}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.cell}><View style={styles.cellInner} /></View>;
          const date = dateFromDay(month, day);
          const count = countByDate.get(date) ?? 0;
          const hasStatus = statusDates.has(date);
          const selected = selectedDate === date;
          const today = todayDate === date;
          const dotColor = count > 0 ? dotColors[Math.min(count, 4) - 1] : hasStatus ? '#8A9895' : undefined;
          return (
            <Pressable
              key={date}
              onPress={() => onSelect(date)}
              accessibilityRole="button"
              accessibilityLabel={`${day} de ${MONTHS[monthNumber - 1]}, ${count} ${count === 1 ? 'batida' : 'batidas'}${hasStatus && count === 0 ? ', folga, atestado ou falta' : ''}`}
              style={styles.cell}
            >
              <View style={[styles.cellInner, styles.dayCell, selected && { backgroundColor: colors.deepTeal }, today && styles.today]}>
                <AppText variant="small" color={selected ? '#FFFFFF' : colors.foreground} style={styles.dayNumber}>{day}</AppText>
                {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <AppText variant="tiny" color={colors.muted}><AppText variant="tiny" color={dotColors[0]}>●</AppText> amarelo – uma batida</AppText>
        <AppText variant="tiny" color={colors.muted}><AppText variant="tiny" color={dotColors[1]}>●</AppText> laranja – duas</AppText>
        <AppText variant="tiny" color={colors.muted}><AppText variant="tiny" color={dotColors[2]}>●</AppText> verde – três</AppText>
        <AppText variant="tiny" color={colors.muted}><AppText variant="tiny" color={dotColors[3]}>●</AppText> azul – quatro (dia completo)</AppText>
        <AppText variant="tiny" color={colors.muted}><AppText variant="tiny" color="#8A9895">●</AppText> cinza – folga/atestado/falta</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  weekHeader: { flexDirection: 'row' },
  headerCell: { width: '14.2857%', padding: 2, alignItems: 'center' },
  weekday: { width: '100%', textAlign: 'center', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, padding: 2 },
  cellInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderRadius: 13, position: 'relative' },
  today: { borderWidth: 2, borderColor: '#0B6A63' },
  dayNumber: { lineHeight: 20 },
  dot: { position: 'absolute', bottom: 5, width: 6, height: 6, borderRadius: 3 },
  legend: { gap: 3, paddingTop: 3 },
});
