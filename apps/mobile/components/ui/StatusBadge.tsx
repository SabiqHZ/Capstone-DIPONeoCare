import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/fonts';
import { Radii, Spacing } from '../../constants/ui';

export function StatusBadge({ online }: { online: boolean }) {
  return (
    <View style={[styles.badge, online ? styles.online : styles.offline]}>
      <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
      <Text style={[styles.text, online ? styles.textOnline : styles.textOffline]}>
        {online ? 'Aktif' : 'Tidak aktif'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
  },
  online: { backgroundColor: Colors.successLight },
  offline: { backgroundColor: Colors.offlineLight },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOnline: { backgroundColor: Colors.success },
  dotOffline: { backgroundColor: Colors.offline },
  text: Typography.captionStrong,
  textOnline: { color: Colors.successDark },
  textOffline: { color: Colors.offlineDark },
});
