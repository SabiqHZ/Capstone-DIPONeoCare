import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "../../constants/colors";
import { Typography } from "../../constants/fonts";
import { ControlSize, Radii, Spacing } from "../../constants/ui";

interface AlertBannerProps {
  message: string;
  severity: "warning" | "critical";
  time: string;
  onDismiss: () => void;
}

export function AlertBanner({
  message,
  severity,
  time,
  onDismiss,
}: AlertBannerProps) {
  const isCritical = severity === "critical";
  const displayMessage = message.replace(/\bheartbeat\b/gi, "sinyal koneksi");

  return (
    <View
      style={[styles.banner, isCritical ? styles.critical : styles.warning]}
      accessibilityRole="alert"
    >
      <View
        style={[
          styles.iconBox,
          isCritical ? styles.criticalIcon : styles.warningIcon,
        ]}
      >
        <Text style={styles.iconText}>!</Text>
      </View>

      <View style={styles.textBox}>
        <View style={styles.topRow}>
          <Text
            style={[
              styles.severity,
              isCritical ? styles.criticalText : styles.warningText,
            ]}
          >
            {isCritical ? "PERLU SEGERA" : "PERHATIAN"}
          </Text>

          <Text style={styles.time}>{time}</Text>
        </View>

        <Text style={styles.message}>{displayMessage}</Text>

        <TouchableOpacity
          style={styles.ackButton}
          onPress={onDismiss}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Tandai peringatan sudah ditangani"
        >
          <Text
            style={[
              styles.ackButtonText,
              isCritical ? styles.criticalText : styles.warningText,
            ]}
          >
            Tandai sudah ditangani
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: Radii.card,
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  critical: {
    backgroundColor: Colors.criticalLight,
    borderLeftWidth: 4,
    borderLeftColor: Colors.critical,
  },

  warning: {
    backgroundColor: Colors.warningLight,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },

  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  criticalIcon: {
    backgroundColor: Colors.critical,
  },

  warningIcon: {
    backgroundColor: Colors.warning,
  },

  iconText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  textBox: {
    flex: 1,
    gap: Spacing.xs,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  severity: {
    ...Typography.captionStrong,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  criticalText: {
    color: Colors.criticalDark,
  },

  warningText: {
    color: Colors.warningDark,
  },

  time: {
    ...Typography.caption,
    fontSize: 12,
    color: "#6B7280",
  },

  message: {
    ...Typography.bodyStrong,
    lineHeight: 20,
    color: "#111827",
  },

  ackButton: {
    alignSelf: "flex-start",
    minHeight: ControlSize.minTouchTarget,
    justifyContent: "center",
    paddingVertical: Spacing.xs,
  },

  ackButtonText: {
    ...Typography.captionStrong,
  },
});
