import { View, Text, StyleSheet } from 'react-native';

export function StatusBadge({ online }: { online: boolean }) {
  return (
    <View style={[styles.badge, online ? styles.online : styles.offline]}>
      <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
      <Text style={[styles.text, online ? styles.textOnline : styles.textOffline]}>
        {online ? 'Online' : 'Offline'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  online: { backgroundColor: '#E1F5EE' },
  offline: { backgroundColor: '#F3F4F6' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOnline: { backgroundColor: '#1D9E75' },
  dotOffline: { backgroundColor: '#9CA3AF' },
  text: { fontSize: 12, fontWeight: '600' },
  textOnline: { color: '#085041' },
  textOffline: { color: '#6B7280' },
});