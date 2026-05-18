import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface AlertBannerProps {
  message: string;
  severity: 'warning' | 'critical';
  time: string;
  onDismiss: () => void;
}

export function AlertBanner({ message, severity, time, onDismiss }: AlertBannerProps) {
  const isCritical = severity === 'critical';
  return (
    <View style={[styles.banner, isCritical ? styles.critical : styles.warning]}>
      <Text style={styles.emoji}>{isCritical ? '🚨' : '⚠️'}</Text>
      <View style={styles.textBox}>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  critical: {
    backgroundColor: '#FCEBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#E24B4A',
  },
  warning: {
    backgroundColor: '#FAEEDA',
    borderLeftWidth: 4,
    borderLeftColor: '#EF9F27',
  },
  emoji: { fontSize: 20 },
  textBox: { flex: 1, gap: 2 },
  message: { fontSize: 13, fontWeight: '600', color: '#111827' },
  time: { fontSize: 11, color: '#6B7280' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});