import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { Icon } from "./Icon";
import { Typography } from "../../constants/fonts";
import { Colors } from "../../constants/colors";
import { Radii, Spacing } from "../../constants/ui";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function FaceAnomalyBanner({ visible, onDismiss }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Icon
          name="eye-off-outline"
          library="ionicons"
          size={22}
          color="#FFFFFF"
        />
      </View>

      <View style={styles.textBox}>
        <Text style={styles.title}>Area wajah perlu diperiksa</Text>

        <Text style={styles.sub}>
          Sistem mendeteksi ada objek di area wajah bayi. Periksa posisi bayi
          dan pastikan wajah tetap terlihat.
        </Text>
      </View>

      <TouchableOpacity
        onPress={onDismiss}
        style={styles.dismissBtn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Sembunyikan peringatan area wajah"
        accessibilityHint="Menutup pemberitahuan ini"
      >
        <Icon name="close" library="ionicons" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.warningDark,
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warningDark,
  },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  textBox: {
    flex: 1,
    gap: 3,
  },

  title: {
    ...Typography.h3,
    color: "#FFFFFF",
  },

  sub: {
    ...Typography.caption,
    lineHeight: 18,
    color: "rgba(255,255,255,0.86)",
  },

  dismissBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
