import { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/ui/Icon';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

// Kita menggunakan Fetch API bawaan agar tidak terikat aturan Axios (seperti interceptor token)
// Karena saat konek ke ESP32, kita sedang offline dari internet dan tidak butuh JWT.
const ESP32_SETUP_URL = 'http://192.168.4.1/setup'; 

export default function DeviceSetupScreen() {
  const router = useRouter();
  
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleSendCredentials = async () => {
    if (!ssid.trim()) {
      Alert.alert('Data Tidak Lengkap', 'Nama WiFi (SSID) Daycare wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      // Mengirim POST ke web server lokal di dalam ESP32
      const response = await fetch(ESP32_SETUP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Sesuaikan key JSON ini dengan apa yang ESP32 C++ milikmu harapkan!
        body: JSON.stringify({
          ssid: ssid.trim(),
          password: password, 
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Berhasil Dikirim!',
          'Kamera sekarang akan merestart dan mencoba terhubung ke WiFi Daycare. Silakan hubungkan kembali HP Anda ke WiFi Daycare.',
          [{ text: 'Selesai', onPress: () => router.replace('/(caregiver)/dashboard') }]
        );
      } else {
        throw new Error('ESP32 menolak data.');
      }
    } catch (error) {
      Alert.alert(
        'Koneksi Gagal',
        'Tidak bisa menghubungi kamera. Pastikan HP Anda SUDAH TERHUBUNG ke WiFi yang dipancarkan oleh kamera (misal: SmartVision_Setup).'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" library="ionicons" size={22} color={Colors.secondaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Konfigurasi Kamera Baru</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Step 1: Instruksi Koneksi Fisik */}
        <View style={[styles.stepCard, step === 2 && styles.stepCardDimmed]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepCircleText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Hubungkan ke Kamera</Text>
          </View>
          
          <Text style={styles.instructionText}>
            1. Nyalakan perangkat kamera Smart Vision. Tunggu hingga lampu berkedip.
          </Text>
          <Text style={styles.instructionText}>
            2. Buka Pengaturan WiFi di HP Anda.
          </Text>
          <Text style={styles.instructionText}>
            3. Cari dan hubungkan ke WiFi bernama <Text style={styles.bold}>"SmartVision_Setup"</Text>.
          </Text>
          <Text style={styles.instructionText}>
            4. Setelah terhubung, kembali ke aplikasi ini.
          </Text>

          {step === 1 && (
            <TouchableOpacity 
              style={styles.nextBtn} 
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextBtnText}>Saya Sudah Terhubung</Text>
              <Icon name="arrow-forward" library="ionicons" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Step 2: Input Kredensial */}
        {step === 2 && (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Masukkan WiFi Daycare</Text>
            </View>
            
            <Text style={styles.instructionText}>
              Masukkan nama WiFi (SSID) dan password klinik/daycare Anda agar kamera bisa terhubung ke internet.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nama WiFi (SSID)</Text>
              <View style={styles.inputBox}>
                <Icon name="wifi" library="ionicons" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: WiFi_Daycare_Lantai1"
                  value={ssid}
                  onChangeText={setSsid}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password WiFi</Text>
              <View style={styles.inputBox}>
                <Icon name="lock-closed-outline" library="ionicons" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Kosongkan jika WiFi tidak dikunci"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]} 
              onPress={handleSendCredentials}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Icon name="hardware-chip-outline" library="ionicons" size={20} color={Colors.white} />
                  <Text style={styles.submitBtnText}>Kirim Konfigurasi ke Kamera</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => setStep(1)}
              disabled={isLoading}
            >
              <Text style={styles.cancelBtnText}>Kembali ke Langkah 1</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

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
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 18,
    color: Colors.secondaryDark,
  },
  content: { padding: 20, gap: 16 },
  stepCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stepCardDimmed: {
    opacity: 0.5,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 14,
    color: Colors.white,
  },
  stepTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  instructionText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  bold: {
    fontFamily: Fonts.interSemiBold,
    color: Colors.secondaryDark,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
  },
  nextBtnText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 14,
    color: Colors.white,
  },
  formGroup: {
    marginTop: 16,
    gap: 8,
  },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.backgroundNurse,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 24,
  },
  submitBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitBtnText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 15,
    color: Colors.white,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontFamily: Fonts.interMedium,
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});