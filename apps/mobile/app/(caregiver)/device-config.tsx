import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../components/ui/Icon';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { DeviceConfig } from '../../types';
import api from '../../services/api';

const DEFAULT_CONFIG: DeviceConfig = {
  deviceId: 'SV-DEMO01',
  cryingMinDurationSec: 10,
  notificationCooldownSec: 120,
};

interface SliderRowProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  unit,
  onDecrease,
  onIncrease,
}: SliderRowProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View style={sliderStyles.row}>
      <View style={sliderStyles.labelBox}>
        <Text style={sliderStyles.label}>{label}</Text>
        <Text style={sliderStyles.desc}>{description}</Text>
      </View>
      <View style={sliderStyles.control}>
        <TouchableOpacity
          style={[sliderStyles.btn, !canDecrease && sliderStyles.btnDisabled]}
          onPress={onDecrease}
          disabled={!canDecrease}
        >
          <Icon
            name="remove"
            library="ionicons"
            size={18}
            color={canDecrease ? Colors.secondaryDark : Colors.textDisabled}
          />
        </TouchableOpacity>
        <View style={sliderStyles.valueBox}>
          <Text style={sliderStyles.value}>{value}</Text>
          <Text style={sliderStyles.unit}>{unit}</Text>
        </View>
        <TouchableOpacity
          style={[sliderStyles.btn, !canIncrease && sliderStyles.btnDisabled]}
          onPress={onIncrease}
          disabled={!canIncrease}
        >
          <Icon
            name="add"
            library="ionicons"
            size={18}
            color={canIncrease ? Colors.secondaryDark : Colors.textDisabled}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DeviceConfigScreen() {
  const { deviceId, babyName } = useLocalSearchParams<{
    deviceId?: string;
    babyName?: string;
  }>();
  const router = useRouter();
  const [config, setConfig] = useState<DeviceConfig>({
    ...DEFAULT_CONFIG,
    deviceId: deviceId ?? DEFAULT_CONFIG.deviceId,
  });
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: keyof DeviceConfig, delta: number, step: number) => {
    setConfig((c) => ({
      ...c,
      [key]: Math.round((Number(c[key]) + delta * step) * 100) / 100,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch(`/devices/${config.deviceId}/config`, {
        cryingMinDurationSec: config.cryingMinDurationSec,
        notificationCooldownSec: config.notificationCooldownSec,
      });
      Alert.alert('Berhasil', 'Konfigurasi perangkat berhasil disimpan.');
    } catch (error: any) {
      Alert.alert('Gagal', error.response?.data?.error || 'Konfigurasi perangkat tidak dapat disimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Konfigurasi',
      'Kembalikan semua pengaturan ke nilai default?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => setConfig(DEFAULT_CONFIG),
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBack}
        >
          <Icon
            name="arrow-back"
            library="ionicons"
            size={22}
            color={Colors.secondaryDark}
          />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Konfigurasi Perangkat</Text>
          <Text style={styles.headerSub}>{babyName ?? config.deviceId}</Text>
        </View>
        <TouchableOpacity onPress={handleReset}>
          <Icon
            name="refresh-outline"
            library="ionicons"
            size={22}
            color={Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Deteksi Tangisan */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon
              name="mic-outline"
              library="ionicons"
              size={18}
              color={Colors.secondary}
            />
            <Text style={styles.sectionTitle}>Deteksi Tangisan</Text>
          </View>
          <View style={styles.card}>
            <SliderRow
              label="Durasi Minimum Tangisan"
              description="Notifikasi dikirim setelah bayi menangis selama durasi ini"
              value={config.cryingMinDurationSec}
              min={5}
              max={60}
              unit="detik"
              onDecrease={() => update('cryingMinDurationSec', -1, 1)}
              onIncrease={() => update('cryingMinDurationSec', 1, 1)}
            />
          </View>
        </View>

        {/* Notifikasi */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon
              name="notifications-outline"
              library="ionicons"
              size={18}
              color={Colors.secondary}
            />
            <Text style={styles.sectionTitle}>Notifikasi</Text>
          </View>
          <View style={styles.card}>
            <SliderRow
              label="Cooldown Notifikasi"
              description="Jeda minimum antar notifikasi untuk kondisi yang sama"
              value={config.notificationCooldownSec}
              min={30}
              max={300}
              unit="detik"
              onDecrease={() => update('notificationCooldownSec', -1, 10)}
              onIncrease={() => update('notificationCooldownSec', 1, 10)}
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Icon
            name="information-circle-outline"
            library="ionicons"
            size={16}
            color={Colors.secondary}
          />
          <Text style={styles.infoText}>
            Perubahan konfigurasi berlaku segera setelah disimpan.
          </Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <Icon
            name="save-outline"
            library="ionicons"
            size={20}
            color={Colors.white}
          />
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const sliderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  labelBox: { flex: 1, gap: 3 },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  desc: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  control: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: Colors.borderLight },
  valueBox: { alignItems: 'center', minWidth: 52 },
  value: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 18,
    color: Colors.secondaryDark,
  },
  unit: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textMuted,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: { padding: 4 },
  headerTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 16,
    color: Colors.secondaryDark,
  },
  headerSub: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.secondaryLight,
    borderRadius: 10,
    padding: 12,
  },
  infoText: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.secondaryMid,
    lineHeight: 18,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 15,
  },
  saveBtnDisabled: { backgroundColor: '#B5D4F4' },
  saveBtnText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 16,
    color: Colors.white,
  },
});
