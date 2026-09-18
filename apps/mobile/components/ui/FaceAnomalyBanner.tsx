import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function FaceAnomalyBanner({ visible, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Icon name="eye-off-outline" library="ionicons" size={22} color="#fff" />
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>Wajah Bayi Tidak Terdeteksi</Text>
        <Text style={styles.sub}>
          Kemungkinan ada objek yang menutupi wajah bayi. Segera periksa!
        </Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
        <Icon name="close" library="ionicons" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#5B21B6',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBox: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: '#fff',
  },
  sub: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 16,
  },
  dismissBtn: { padding: 4 },
});