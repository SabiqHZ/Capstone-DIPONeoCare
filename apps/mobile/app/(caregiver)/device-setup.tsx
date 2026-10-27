import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "../../components/ui/Icon";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";
import { ControlSize, Radii, Spacing } from "../../constants/ui";

// Kita menggunakan Fetch API bawaan agar tidak terikat aturan Axios (seperti interceptor token)
// Karena saat konek ke ESP32, kita sedang offline dari internet dan tidak butuh JWT.
const ESP32_SETUP_URL = "http://192.168.4.1/setup";

export default function DeviceSetupScreen() {
  const router = useRouter();

  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleSendCredentials = async () => {
    if (!ssid.trim()) {
      Alert.alert(
        "Data Tidak Lengkap",
        "Nama jaringan Wi-Fi daycare wajib diisi.",
      );
      return;
    }

    setIsLoading(true);
    try {
      // Mengirim POST ke web server lokal di dalam ESP32
      const response = await fetch(ESP32_SETUP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Sesuaikan key JSON ini dengan apa yang ESP32 C++ milikmu harapkan!
        body: JSON.stringify({
          ssid: ssid.trim(),
          password: password,
        }),
      });

      if (response.ok) {
        Alert.alert(
          "Berhasil Dikirim!",
          "Kamera akan mulai ulang dan mencoba terhubung ke Wi-Fi daycare. Hubungkan kembali ponsel Anda ke Wi-Fi daycare.",
          [
            {
              text: "Selesai",
              onPress: () => router.replace("/(caregiver)/dashboard"),
            },
          ],
        );
      } else {
        throw new Error("ESP32 menolak data.");
      }
    } catch (error) {
      Alert.alert(
        "Koneksi Gagal",
        "Tidak bisa menghubungi kamera. Pastikan ponsel Anda sudah terhubung ke jaringan Wi-Fi kamera (misalnya: DIPONeoCare-Setup).",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          accessibilityHint="Kembali ke halaman sebelumnya"
        >
          <Icon
            name="arrow-back"
            library="ionicons"
            size={22}
            color={Colors.secondaryDark}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Konfigurasi Kamera Baru</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Instruksi Koneksi Fisik */}
        <View style={[styles.stepCard, step === 2 && styles.stepCardDimmed]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepCircleText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Hubungkan ke Kamera</Text>
          </View>

          <Text style={styles.instructionText}>
            1. Nyalakan perangkat kamera Smart Vision. Tunggu hingga lampu
            berkedip.
          </Text>
          <Text style={styles.instructionText}>
            2. Buka Pengaturan Wi-Fi di ponsel Anda.
          </Text>
          <Text style={styles.instructionText}>
            3. Cari dan hubungkan ke jaringan Wi-Fi bernama{" "}
            <Text style={styles.bold}>"SmartVision_Setup"</Text>.
          </Text>
          <Text style={styles.instructionText}>
            4. Setelah terhubung, kembali ke aplikasi ini.
          </Text>

          {step === 1 && (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
              <Text style={styles.nextBtnText}>Saya Sudah Terhubung</Text>
              <Icon
                name="arrow-forward"
                library="ionicons"
                size={18}
                color={Colors.white}
              />
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
              <Text style={styles.stepTitle}>Masukkan Wi-Fi Daycare</Text>
            </View>

            <Text style={styles.instructionText}>
              Masukkan nama jaringan Wi-Fi dan kata sandi klinik/daycare agar
              kamera bisa terhubung ke internet.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nama jaringan Wi-Fi</Text>
              <View style={styles.inputBox}>
                <Icon
                  name="wifi"
                  library="ionicons"
                  size={18}
                  color={Colors.textMuted}
                />
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
              <Text style={styles.label}>Kata sandi Wi-Fi</Text>
              <View style={styles.inputBox}>
                <Icon
                  name="lock-closed-outline"
                  library="ionicons"
                  size={18}
                  color={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Kosongkan jika Wi-Fi tidak dikunci"
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
                  <Icon
                    name="hardware-chip-outline"
                    library="ionicons"
                    size={20}
                    color={Colors.white}
                  />
                  <Text style={styles.submitBtnText}>
                    Kirim Konfigurasi ke Kamera
                  </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    ...Typography.h2,
    color: Colors.secondaryDark,
  },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  stepCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    shadowColor: "#000",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    justifyContent: "center",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: Radii.control,
    minHeight: ControlSize.minTouchTarget,
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
    textTransform: "uppercase",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radii.control,
    minHeight: ControlSize.minTouchTarget,
    marginTop: 24,
  },
  submitBtnDisabled: {
    backgroundColor: "#9ca3af",
  },
  submitBtnText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 15,
    color: Colors.white,
  },
  cancelBtn: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontFamily: Fonts.interMedium,
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
});
