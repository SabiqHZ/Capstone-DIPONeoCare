import { View, Text, StyleSheet } from "react-native";

import { Icon } from "../ui/Icon";
import { BabyActivity } from "../../types";

import { Colors } from "../../constants/colors";
import { Typography } from "../../constants/fonts";
import { Radii, Spacing } from "../../constants/ui";

interface Props {
  activity: BabyActivity | null;
  cameraOnline?: boolean | null;
  cameraPaired?: boolean;
}

const activityConfig = {
  sleeping: {
    label: "Tidur",
    color: Colors.success,
    bg: Colors.successLight,
    icon: "sleep",
    iconLib: "material" as const,
  },

  awake: {
    label: "Bangun",
    color: Colors.info,
    bg: Colors.infoLight,
    icon: "eye-outline",
    iconLib: "ionicons" as const,
  },

  crying: {
    label: "Menangis",
    color: Colors.critical,
    bg: Colors.criticalLight,
    icon: "emoticon-cry-outline",
    iconLib: "material" as const,
  },

  unknown: {
    label: "Tidak ada bayi yang terdeteksi",
    color: Colors.neutral,
    bg: Colors.neutralLight,
    icon: "help-circle-outline",
    iconLib: "ionicons" as const,
  },
};

export function ActivityCard({ activity, cameraOnline = true, cameraPaired = true }: Props) {
  const activityKey = activity ?? "unknown";
  const actCfg = activityConfig[activityKey];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: actCfg.bg,
        },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.left}>
          <Text style={styles.cardLabel}>Kondisi saat ini</Text>

          <View style={styles.activityRow}>
            <Icon
              name={actCfg.icon}
              library={actCfg.iconLib}
              size={28}
              color={actCfg.color}
            />

            <Text
              style={[
                styles.activityLabel,
                activityKey === "unknown" && styles.activityLabelUnavailable,
                {
                  color: actCfg.color,
                },
              ]}
            >
              {!cameraPaired
                ? "Kamera belum di pasang pada bayi ini"
                : activityKey === "unknown" && cameraOnline === false
                  ? "Kamera tidak aktif"
                : actCfg.label}
            </Text>
          </View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
  },

  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  left: {
    gap: 6,
    flex: 1,
  },

  cardLabel: {
    ...Typography.captionStrong,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  activityLabel: {
    ...Typography.h2,
    flexShrink: 1,
  },

  activityLabelUnavailable: {
    fontSize: 15,
    lineHeight: 21,
  },

});
