import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/ui/Icon';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { babyService } from '../../services/baby.service';
import  api  from '../../services/api'; // Pastikan path ini benar sesuai strukturmu
import { Baby } from '../../types';

interface BabyForm {
  name: string;
  bedNumber: string;
  dateOfBirth: string;
  parentName: string;
  deviceId: string; // Tambahan state untuk kamera
}

interface Device {
  id: string;
  mac_address: string;
  name: string;
}

export default function RegisterBabyScreen() {
  const router = useRouter();
  const [form, setForm] = useState<BabyForm>({
    name: '',
    bedNumber: '',
    dateOfBirth: '',
    parentName: '',
    deviceId: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [registeredBaby, setRegisteredBaby] = useState<Baby | null>(null);
  
  // State untuk Dropdown Kamera
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isDeviceModalVisible, setIsDeviceModalVisible] = useState(false);

  // Fetch daftar kamera yang nganggur saat halaman dimuat
  useEffect(() => {
    fetchAvailableDevices();
  }, []);

  const fetchAvailableDevices = async () => {
    setIsLoadingDevices(true);
    try {
      const response = await api.get('/devices/available');
      if (response.data.success) {
        setAvailableDevices(response.data.data);
      }
    } catch (error) {
      console.error('Gagal mengambil daftar kamera:', error);
      Alert.alert('Error', 'Gagal memuat daftar kamera yang tersedia.');
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const update = (key: keyof BabyForm, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const isValid =
    form.name.trim() !== '' &&
    form.bedNumber.trim() !== '' &&
    form.dateOfBirth.trim() !== '' &&
    form.parentName.trim() !== '' &&
    form.deviceId !== ''; // Wajib pilih kamera

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('Lengkapi Data', 'Semua field termasuk kamera wajib diisi.');
      return;
    }

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(form.dateOfBirth)) {
      Alert.alert('Format Salah', 'Tanggal lahir harus dalam format DD/MM/YYYY');
      return;
    }

    setIsLoading(true);
    try {
      const [day, month, year] = form.dateOfBirth.split('/');
      const isoDate = `${year}-${month}-${day}`;

      // 1. Daftarkan Bayi
      const baby = await babyService.registerBaby({
        name: form.name.trim(),
        bedNumber: form.bedNumber.trim(),
        dateOfBirth: isoDate,
        parentName: form.parentName.trim(),
      });

      // 2. Pair Perangkat secara otomatis (Tidak perlu Scan QR lagi)
      await babyService.pairDevice(baby.id, form.deviceId);

      // Tandai sukses
      setRegisteredBaby(baby);
    } catch (err: any) {
      Alert.alert(
        'Gagal Mendaftarkan',
        err.response?.data?.message || err.message || 'Terjadi kesalahan, coba lagi.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Tampilan sukses ───────────────────────────────────────────────
  if (registeredBaby) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successIconWrapper}>
            <Icon name="checkmark-circle" library="ionicons" size={72} color={Colors.primary} />
          </View>

          <Text style={styles.successTitle}>Bayi & Kamera Tersambung!</Text>
          <Text style={styles.successSub}>
            Sistem pemantauan aktif. Berikan kode berikut kepada orang tua.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>KODE AKSES ORANG TUA</Text>
            <Text style={styles.codeValue}>{registeredBaby.uniqueCode}</Text>
            <Text style={styles.codeNote}>Kode berlaku selama pasien dirawat</Text>
          </View>

          <View style={styles.babyInfoBox}>
            <View style={styles.babyInfoRow}>
              <Icon name="baby-face-outline" library="material" size={20} color={Colors.textMuted} />
              <Text style={styles.babyInfoText}>{registeredBaby.name}</Text>
            </View>
            <View style={styles.babyInfoRow}>
              <Icon name="bed" library="ionicons" size={20} color={Colors.textMuted} />
              <Text style={styles.babyInfoText}>Tempat Tidur {registeredBaby.bedNumber}</Text>
            </View>
            <View style={styles.babyInfoRow}>
              <Icon name="videocam-outline" library="ionicons" size={20} color={Colors.textMuted} />
              <Text style={styles.babyInfoText}>
                {availableDevices.find(d => d.id === form.deviceId)?.name || 'Kamera Terhubung'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addAnotherBtn}
            onPress={() => {
              setRegisteredBaby(null);
              setForm({ name: '', bedNumber: '', dateOfBirth: '', parentName: '', deviceId: '' });
              fetchAvailableDevices(); // Refresh list kamera
            }}
          >
            <Icon name="add-circle-outline" library="ionicons" size={18} color={Colors.secondary} />
            <Text style={styles.addAnotherText}>Daftarkan Bayi Lain</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToDashBtn}
            onPress={() => router.replace('/(caregiver)/dashboard')}
          >
            <Text style={styles.backToDashText}>Kembali ke Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Icon name="arrow-back" library="ionicons" size={22} color={Colors.secondaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daftarkan Bayi Baru</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.infoBox}>
          <Icon name="information-circle-outline" library="ionicons" size={18} color={Colors.secondary} />
          <Text style={styles.infoText}>
            Pilih kamera yang belum terpakai untuk memantau bayi secara otomatis.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Field
            label="Nama Bayi"
            placeholder="contoh: Bayi Budi Santoso"
            value={form.name}
            onChangeText={(v) => update('name', v)}
            icon="baby-face-outline"
            iconLibrary="material"
          />
          <View style={styles.divider} />
          <Field
            label="Nomor Tempat Tidur"
            placeholder="contoh: B-03"
            value={form.bedNumber}
            onChangeText={(v) => update('bedNumber', v)}
            icon="bed"
            iconLibrary="ionicons"
          />
          <View style={styles.divider} />
          <Field
            label="Tanggal Lahir"
            placeholder="DD/MM/YYYY"
            value={form.dateOfBirth}
            onChangeText={(v) => {
              let val = v.replace(/\D/g, '');
              if (val.length >= 3 && val.length <= 4) {
                val = val.slice(0, 2) + '/' + val.slice(2);
              } else if (val.length > 4) {
                val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4, 8);
              }
              update('dateOfBirth', val);
            }}
            icon="calendar-outline"
            iconLibrary="ionicons"
            keyboardType="numeric"
            maxLength={10}
          />
          <View style={styles.divider} />
          <Field
            label="Nama Orang Tua"
            placeholder="contoh: Budi Santoso"
            value={form.parentName}
            onChangeText={(v) => update('parentName', v)}
            icon="person-outline"
            iconLibrary="ionicons"
          />
          <View style={styles.divider} />
          
          {/* Custom Dropdown untuk Pilih Kamera */}
          <View style={fieldStyles.wrapper}>
            <Text style={fieldStyles.label}>Pilih Kamera Pemantau</Text>
            <TouchableOpacity 
              style={fieldStyles.dropdownButton}
              onPress={() => setIsDeviceModalVisible(true)}
              disabled={isLoadingDevices}
            >
              <Icon name="videocam-outline" library="ionicons" size={18} color={Colors.textMuted} />
              <Text style={form.deviceId ? fieldStyles.dropdownSelectedText : fieldStyles.dropdownPlaceholder}>
                {isLoadingDevices ? 'Memuat kamera...' : 
                  (form.deviceId 
                    ? availableDevices.find(d => d.id === form.deviceId)?.name 
                    : (availableDevices.length === 0 ? 'Tidak ada kamera tersedia' : 'Pilih Kamera...'))}
              </Text>
              <Icon name="chevron-down" library="ionicons" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!isValid || isLoading) ? styles.submitBtnDisabled : null]}
          onPress={handleSubmit}
          disabled={!isValid || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Icon name="save-outline" library="ionicons" size={20} color={Colors.white} />
              <Text style={styles.submitBtnText}>Simpan & Pair Kamera</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Dropdown Kamera */}
      <Modal visible={isDeviceModalVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsDeviceModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Kamera</Text>
            {availableDevices.length === 0 ? (
              <Text style={styles.modalEmptyText}>Semua kamera sedang digunakan. Tambahkan perangkat baru terlebih dahulu.</Text>
            ) : (
              <FlatList
                data={availableDevices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      update('deviceId', item.id);
                      setIsDeviceModalVisible(false);
                    }}
                  >
                    <Icon name="videocam-outline" library="ionicons" size={20} color={Colors.secondary} />
                    <View>
                      <Text style={styles.modalItemName}>{item.name}</Text>
                      <Text style={styles.modalItemMac}>{item.mac_address}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsDeviceModalVisible(false)}>
              <Text style={styles.modalCloseText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ── Field component ───────────────────────────────────────────────────

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  icon: string;
  iconLibrary?: 'ionicons' | 'material' | 'feather';
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
}

function Field({ label, placeholder, value, onChangeText, icon, iconLibrary = 'material', keyboardType = 'default', maxLength }: FieldProps) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.inputRow}>
        <Icon name={icon} library={iconLibrary} size={18} color={Colors.textMuted} />
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDisabled}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize="words"
        />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const fieldStyles = StyleSheet.create({
  wrapper: { gap: 6, paddingVertical: 4 },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  dropdownPlaceholder: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 15,
    color: Colors.textDisabled,
  },
  dropdownSelectedText: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 15,
    color: Colors.textPrimary,
  }
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
    fontSize: 18,
    color: Colors.secondaryDark,
  },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.secondaryLight,
    borderRadius: 10,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    color: Colors.secondaryMid,
    lineHeight: 20,
  },
  formCard: {
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
  divider: { height: 1, backgroundColor: Colors.border },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 15,
  },
  submitBtnDisabled: { backgroundColor: '#B5D4F4' },
  submitBtnText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 16,
    color: Colors.white,
  },
  successContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 16,
    paddingBottom: 40,
  },
  successIconWrapper: { marginTop: 16, marginBottom: 8 },
  successTitle: {
    fontFamily: Fonts.nunitoExtraBold,
    fontSize: 24,
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  successSub: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  codeBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    width: '100%',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  codeLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.primaryMid,
    letterSpacing: 1.5,
  },
  codeValue: {
    fontFamily: Fonts.nunitoExtraBold,
    fontSize: 38,
    color: Colors.primaryDark,
    letterSpacing: 6,
  },
  codeNote: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  babyInfoBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  babyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  babyInfoText: {
    fontFamily: Fonts.interMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
  },
  addAnotherText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.secondary,
  },
  backToDashBtn: {
    paddingVertical: 8,
  },
  backToDashText: {
    fontFamily: Fonts.interMedium,
    fontSize: 14,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  modalEmptyText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalItemName: {
    fontFamily: Fonts.interMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  modalItemMac: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalCloseBtn: {
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: Colors.backgroundNurse,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 15,
    color: Colors.textSecondary,
  }
});