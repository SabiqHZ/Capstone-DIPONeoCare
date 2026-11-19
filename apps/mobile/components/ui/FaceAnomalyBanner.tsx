import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { Icon } from "./Icon";
import { Typography } from "../../constants/fonts";
import { Colors } from "../../constants/colors";
import { Radii, Spacing } from "../../constants/ui";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onContactCaregiver?: () => void;
  anomalyType?: string | null;
}

export function FaceAnomalyBanner({ visible, onDismiss, onContactCaregiver, anomalyType }: Props) {
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
        <Text style={styles.title}>Wajah bayi tertutupi!</Text>

        <Text style={styles.sub}>
          {anomalyType
            ? `Singkirkan ${anomalyType} dari area wajah bayi.`
            : "Singkirkan benda dari area wajah bayi."}
        </Text>
        {onContactCaregiver ? (
          <TouchableOpacity
            style={styles.contactButton}
            onPress={onContactCaregiver}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Hubungi pengasuh melalui WhatsApp"
            accessibilityHint="Membuka WhatsApp dengan pesan bahwa wajah bayi tertutupi"
          >
            <Icon name="logo-whatsapp" library="ionicons" size={17} color={Colors.criticalDark} />
            <Text style={styles.contactButtonText}>Hubungi Pengasuh</Text>
          </TouchableOpacity>
        ) : null}
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
    backgroundColor: Colors.critical,
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    borderLeftWidth: 4,
    borderLeftColor: Colors.criticalDark,
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

  contactButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
    marginTop: 5,
    borderRadius: 9,
    backgroundColor: Colors.white,
  },
  contactButtonText: {
    ...Typography.captionStrong,
    color: Colors.criticalDark,
  },

  dismissBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
