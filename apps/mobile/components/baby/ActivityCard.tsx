import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { BabyActivity, SoundClass } from '../../types';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  activity: BabyActivity;
  soundClass: SoundClass;
  soundConfidence: number;
  nightVision: boolean;
  faceAnomaly?: 'face_covered' | 'none';
}

const activityConfig = {
  sleeping: {
    label: 'Tidur',
    desc: 'Bayi sedang tidur dengan tenang',
    color: Colors.primary,
    bg: Colors.primaryLight,
    icon: 'sleep',
    iconLib: 'material' as const,
  },
  awake: {
    label: 'Bangun',
    desc: 'Bayi sedang terjaga',
    color: Colors.primary,
    bg: Colors.primaryLight,
    icon: 'eye-outline',
    iconLib: 'ionicons' as const,
  },
  crying: {
    label: 'Menangis',
    desc: 'Bayi terdeteksi menangis',
    color: Colors.danger,
    bg: Colors.dangerLight,
    icon: 'emoticon-cry-outline',
    iconLib: 'material' as const,
  },
};

const soundConfig = {
  crying: {
    label: 'Tangisan Terdeteksi',
    color: Colors.danger,
    bg: Colors.dangerLight,
  },
  not_crying: {
    label: 'Tidak Menangis',
    color: Colors.primary,
    bg: Colors.primaryLight,
  },
};

export function ActivityCard({
  activity,
  soundClass,
  soundConfidence,
  nightVision,
  faceAnomaly,
}: Props) {
  const actCfg = activityConfig[activity];
  const sndCfg = soundConfig[soundClass];

  return (
    <View style={[styles.card, { backgroundColor: actCfg.bg }]}>
      <View style={styles.top}>
        <View style={styles.left}>
          <Text style={styles.cardLabel}>Aktivitas Bayi</Text>
          <View style={styles.activityRow}>
            <Icon
              name={actCfg.icon}
              library={actCfg.iconLib}
              size={28}
              color={actCfg.color}
            />
            <Text style={[styles.activityLabel, { color: actCfg.color }]}>
              {actCfg.label}
            </Text>
          </View>
          <Text style={styles.activityDesc}>{actCfg.desc}</Text>
        </View>
        <View style={styles.right}>
          {nightVision ? (
            <View style={styles.nvBadge}>
              <Text style={styles.nvText}>Night Vision</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Status suara */}
      <View style={[styles.soundBadge, { backgroundColor: sndCfg.bg }]}>
        <Icon
          name={soundClass === 'crying' ? 'volume-high' : 'volume-mute'}
          library="ionicons"
          size={14}
          color={sndCfg.color}
        />
        <Text style={[styles.soundLabel, { color: sndCfg.color }]}>
          {sndCfg.label}
        </Text>
        {soundClass === 'crying' && soundConfidence > 0 ? (
          <Text style={[styles.soundConf, { color: sndCfg.color }]}>
            {Math.round(soundConfidence * 100)}%
          </Text>
        ) : null}
      </View>

      {/* Alert strip */}
      {faceAnomaly === 'face_covered' ? (
        <View style={styles.alertStrip}>
          <Icon
            name="alert-circle"
            library="ionicons"
            size={16}
            color={Colors.white}
          />
          <Text style={styles.alertText}>
            Perlu perhatian — wajah bayi tertutup
          </Text>
        </View>
      ) : null}

      {activity === 'crying' ? (
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
  card: { borderRadius: 16, padding: 20, gap: 12 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  left: { gap: 6, flex: 1 },
  right: { alignItems: 'flex-end', gap: 8 },
  cardLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityLabel: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 24,
  },
  activityDesc: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  nvBadge: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nvText: {
    fontFamily: Fonts.interMedium,
    fontSize: 10,
    color: '#a78bfa',
  },
  soundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  soundLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    flex: 1,
  },
  soundConf: {
    fontFamily: Fonts.interMedium,
    fontSize: 12,
  },
  alertStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    padding: 10,
  },
  alertText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.white,
    flex: 1,
  },
  faceAnomalyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    padding: 10,
  },
  faceAnomalyText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: '#fff',
    flex: 1,
  },
});
