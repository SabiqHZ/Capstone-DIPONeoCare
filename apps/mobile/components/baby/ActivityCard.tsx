import { View, Text, StyleSheet } from "react-native";

import { Icon } from "../ui/Icon";
import { BabyActivity, FaceAnomaly, SoundClass } from "../../types";

import { Colors } from "../../constants/colors";
import { Typography } from "../../constants/fonts";
import { Radii, Spacing } from "../../constants/ui";

interface Props {
  activity: BabyActivity | null;
  soundClass: SoundClass | null;
  soundConfidence: number | null;
  faceAnomaly?: FaceAnomaly | null;
}

const activityConfig = {
  sleeping: {
    label: "Tidur",
    desc: "Bayi sedang tidur dengan tenang",
    color: Colors.success,
    bg: Colors.successLight,
    icon: "sleep",
    iconLib: "material" as const,
  },

  awake: {
    label: "Bangun",
    desc: "Bayi sedang terjaga",
    color: Colors.info,
    bg: Colors.infoLight,
    icon: "eye-outline",
    iconLib: "ionicons" as const,
  },

  crying: {
    label: "Menangis",
    desc: "Bayi terdeteksi menangis",
    color: Colors.critical,
    bg: Colors.criticalLight,
    icon: "emoticon-cry-outline",
    iconLib: "material" as const,
  },

  unknown: {
    label: "Data belum tersedia",
    desc: "Belum ada pembaruan kondisi bayi",
    color: Colors.neutral,
    bg: Colors.neutralLight,
    icon: "help-circle-outline",
    iconLib: "ionicons" as const,
  },
};

const soundConfig = {
  crying: {
    label: "Tangisan terdeteksi",
    color: Colors.critical,
    bg: Colors.criticalLight,
  },

  not_crying: {
    label: "Tidak menangis",
    color: Colors.success,
    bg: Colors.successLight,
  },

  unknown: {
    label: "Data suara belum tersedia",
    color: Colors.neutral,
    bg: Colors.neutralLight,
  },
};

export function ActivityCard({
  activity,
  soundClass,
  soundConfidence,
  faceAnomaly,
}: Props) {
  const activityKey = activity ?? "unknown";
  const soundKey = soundClass ?? "unknown";

  const actCfg = activityConfig[activityKey];
  const sndCfg = soundConfig[soundKey];

  const hasFaceAnomaly = Boolean(faceAnomaly) && faceAnomaly !== "none";

  const hasCrying = activity === "crying" || soundClass === "crying";

  const formattedConfidence =
    typeof soundConfidence === "number" &&
    Number.isFinite(soundConfidence) &&
    soundConfidence > 0
      ? Math.round(soundConfidence * 100)
      : null;

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
                {
                  color: actCfg.color,
                },
              ]}
            >
              {actCfg.label}
            </Text>
          </View>

          <Text style={styles.activityDesc}>{actCfg.desc}</Text>
        </View>
      </View>

      {/* Status suara */}

      <View
        style={[
          styles.soundBadge,
          {
            backgroundColor: sndCfg.bg,
          },
        ]}
      >
        <Icon
          name={
            soundClass === "crying"
              ? "volume-high"
              : soundClass === "not_crying"
                ? "volume-mute"
                : "help-circle-outline"
          }
          library="ionicons"
          size={15}
          color={sndCfg.color}
        />

        <Text
          style={[
            styles.soundLabel,
            {
              color: sndCfg.color,
            },
          ]}
        >
          {sndCfg.label}
        </Text>

        {formattedConfidence !== null ? (
          <Text
            style={[
              styles.soundConf,
              {
                color: sndCfg.color,
              },
            ]}
          >
            Tingkat keyakinan {formattedConfidence}%
          </Text>
        ) : null}
      </View>

      {/* Face anomaly */}

      {hasFaceAnomaly ? (
        <View style={styles.warningStrip}>
          <Icon
            name="alert-circle"
            library="ionicons"
            size={16}
            color={Colors.white}
          />

          <Text style={styles.warningText}>
            Perlu perhatian — ada objek di area bayi
          </Text>
        </View>
      ) : null}

      {/* Crying */}

      {hasCrying ? (
        <View style={styles.alertStrip}>
          <Icon
            name="alert-circle"
            library="ionicons"
            size={16}
            color={Colors.white}
          />

          <Text style={styles.alertText}>
            Perlu perhatian — bayi sedang menangis
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    gap: Spacing.md,
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
    ...Typography.h1,
  },

  activityDesc: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  soundBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  soundLabel: {
    ...Typography.bodyStrong,
    flex: 1,
  },

  soundConf: {
    ...Typography.captionStrong,
  },

  alertStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.critical,
    borderRadius: 8,
    padding: 10,
  },

  alertText: {
    ...Typography.bodyStrong,
    color: Colors.white,
    flex: 1,
  },

  warningStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warningDark,
    borderRadius: 8,
    padding: 10,
  },

  warningText: {
    ...Typography.bodyStrong,
    color: Colors.white,
    flex: 1,
  },
});
