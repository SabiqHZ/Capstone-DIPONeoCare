import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Icon } from './Icon';
import { useAuthStore } from '../../stores/auth.store';
import { Colors } from '../../constants/colors';

export function MuteToggle() {
  const isMuted = useAuthStore((s) => s.isMuted);
  const setMuted = useAuthStore((s) => s.setMuted);

  const handleToggle = () => {
    if (!isMuted) {
      Alert.alert(
        'Bisukan Notifikasi',
        'Notifikasi peringatan akan dibisukan. Anda tetap bisa melihat alert di dashboard.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Bisukan',
            style: 'destructive',
            onPress: () => setMuted(true),
          },
        ]
      );
    } else {
      setMuted(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={handleToggle}
      activeOpacity={0.6}
    >
      <Icon
        name={isMuted ? 'notifications-off-outline' : 'notifications-outline'}
        library="ionicons"
        size={26}
        color={isMuted ? Colors.danger : Colors.secondaryDark}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});