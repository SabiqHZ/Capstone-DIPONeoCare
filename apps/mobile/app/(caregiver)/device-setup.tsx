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
  PermissionsAndroid,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import WifiManager from "react-native-wifi-reborn";
import type { WifiEntry } from "react-native-wifi-reborn";
import { Icon } from "../../components/ui/Icon";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";
import { ControlSize, Radii, Spacing } from "../../constants/ui";
import { SuccessModal } from "../../components/ui/SuccessModal";
import { useTheme } from "../../context/ThemeContext";

// Kita menggunakan Fetch API bawaan agar tidak terikat aturan Axios (seperti interceptor token)
// Karena saat konek ke ESP32, kita sedang offline dari internet dan tidak butuh JWT.
const ESP32_SETUP_URL = "http://192.168.4.1/setup";

export default function DeviceSetupScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<"ssid" | "password" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [availableNetworks, setAvailableNetworks] = useState<WifiEntry[]>([]);
  const [isScanningNetworks, setIsScanningNetworks] = useState(false);
  const [scanError, setScanError] = useState("");

  const scanNearbyNetworks = async () => {
    setStep(2);
    setScanError("");

    if (Platform.OS !== "android") {
      setScanError("Pemindaian otomatis hanya tersedia di Android. Masukkan nama Wi-Fi secara manual.");
      return;
    }

    if (!WifiManager || typeof WifiManager.reScanAndLoadWifiList !== "function") {
      setScanError("Pemindaian memerlukan aplikasi Android hasil build baru. Masukkan nama Wi-Fi secara manual untuk sementara.");
      return;
    }

    setIsScanningNetworks(true);
    try {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Izin lokasi diperlukan",
          message: "Android memerlukan izin lokasi untuk memindai jaringan Wi-Fi di sekitar.",
          buttonNegative: "Nanti",
          buttonPositive: "Izinkan",
        },
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        setAvailableNetworks([]);
        setScanError("Izin lokasi tidak diberikan. Nama Wi-Fi tetap dapat dimasukkan secara manual.");
        return;
      }

      const networks = await WifiManager.reScanAndLoadWifiList();
      const uniqueNetworks = new Map<string, WifiEntry>();
      for (const network of networks) {
        const networkName = network.SSID.trim();
        if (networkName && !uniqueNetworks.has(networkName)) {
          uniqueNetworks.set(networkName, network);
        }
      }
      const sortedNetworks = Array.from(uniqueNetworks.values()).sort(
        (a, b) => b.level - a.level,
      );
      setAvailableNetworks(sortedNetworks);
      if (sortedNetworks.length === 0) {
        setScanError("Tidak ada jaringan Wi-Fi ditemukan. Anda dapat memasukkan nama Wi-Fi secara manual.");
      }
    } catch (error) {
      setAvailableNetworks([]);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("locationServicesOff")) {
        setScanError("Layanan lokasi perangkat sedang mati. Aktifkan lokasi lalu pindai ulang, atau masukkan nama Wi-Fi secara manual.");
      } else if (message.includes("couldNotScan")) {
        setScanError("Pemindaian Wi-Fi dibatasi sementara oleh Android. Coba pindai lagi sebentar lagi atau masukkan nama Wi-Fi secara manual.");
      } else if (
        message.includes("Native module") ||
        message.includes("undefined") ||
        message.includes("is not a function")
      ) {
        setScanError("Pemindaian memerlukan aplikasi Android hasil build baru. Masukkan nama Wi-Fi secara manual untuk sementara.");
      } else {
        console.error("[DeviceSetup] Gagal memindai Wi-Fi:", error);
        setScanError("Jaringan Wi-Fi gagal dipindai. Anda dapat mencoba lagi atau memasukkan nama Wi-Fi secara manual.");
      }
    } finally {
      setIsScanningNetworks(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch(ESP32_SETUP_URL);
    } catch {
      Alert.alert(
        "Koneksi Gagal",
        "Tidak bisa menghubungi kamera. Pastikan ponsel Anda terhubung ke jaringan Wi-Fi kamera.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

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
        setIsSuccessModalVisible(true);
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
    <SafeAreaView style={[styles.safe, isDark && { backgroundColor: "#111827" }]}>
      {/* Header */}
      <View style={[styles.header, isDark && { backgroundColor: "#1F2937", borderBottomColor: "#374151" }]}>
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
            color={isDark ? "#BFDBFE" : Colors.secondaryDark}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && { color: "#BFDBFE" }]}>Konfigurasi Kamera Baru</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.secondary]}
            tintColor={Colors.secondary}
          />
        }
      >
        {/* Step 1: Instruksi Koneksi Fisik */}
        <View style={[styles.stepCard, isDark && { backgroundColor: "#1F2937" }, step === 2 && styles.stepCardDimmed]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepCircleText}>1</Text>
            </View>
            <Text style={[styles.stepTitle, isDark && { color: "#F9FAFB" }]}>Hubungkan ke Kamera</Text>
          </View>

          <Text style={[styles.instructionText, isDark && { color: "#D1D5DB" }]}>
            1. Nyalakan perangkat kamera Smart Vision. Tunggu hingga lampu
            berkedip.
          </Text>
          <Text style={[styles.instructionText, isDark && { color: "#D1D5DB" }]}>
            2. Buka Pengaturan Wi-Fi di ponsel Anda.
          </Text>
          <Text style={[styles.instructionText, isDark && { color: "#D1D5DB" }]}>
            3. Cari dan hubungkan ke jaringan Wi-Fi bernama{" "}
            <Text style={styles.bold}>"SmartVision_Setup"</Text>.
          </Text>
          <Text style={[styles.instructionText, isDark && { color: "#D1D5DB" }]}>
            4. Setelah terhubung, kembali ke aplikasi ini.
          </Text>

          {step === 1 && (
            <TouchableOpacity style={styles.nextBtn} onPress={() => void scanNearbyNetworks()}>
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
          <View style={[styles.stepCard, isDark && { backgroundColor: "#1F2937" }]}>
            <View style={styles.stepHeader}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>2</Text>
              </View>
              <Text style={[styles.stepTitle, isDark && { color: "#F9FAFB" }]}>Masukkan Wi-Fi Daycare</Text>
            </View>

            <Text style={[styles.instructionText, isDark && { color: "#D1D5DB" }]}>
              Masukkan nama jaringan Wi-Fi dan kata sandi klinik/daycare agar
              kamera bisa terhubung ke internet.
            </Text>

            <View style={styles.formGroup}>
              {Platform.OS === "android" ? (
                <View style={styles.networkScanSection}>
                  {isScanningNetworks ? (
                    <View style={styles.scanStatus}>
                      <ActivityIndicator size="small" color={Colors.secondary} />
                      <Text style={styles.scanMessage}>Memindai Wi-Fi di sekitar...</Text>
                    </View>
                  ) : scanError ? (
                    <Text style={styles.scanError}>{scanError}</Text>
                  ) : null}
                  {availableNetworks.map((network) => (
                    <TouchableOpacity
                      key={network.BSSID || network.SSID}
                      style={[
                        styles.networkOption,
                        ssid === network.SSID && styles.networkOptionSelected,
                      ]}
                      onPress={() => setSsid(network.SSID)}
                      accessibilityRole="button"
                      accessibilityLabel={`Pilih jaringan ${network.SSID}`}
                    >
                      <Icon name="wifi" library="ionicons" size={18} color={Colors.secondary} />
                      <Text style={[styles.networkName, isDark && { color: "#F9FAFB" }]} numberOfLines={1}>{network.SSID}</Text>
                      <Text style={styles.networkSignal}>{network.level} dBm</Text>
                    </TouchableOpacity>
                  ))}
                  {!isScanningNetworks ? (
                    <TouchableOpacity
                      style={styles.rescanButton}
                      onPress={() => void scanNearbyNetworks()}
                      accessibilityRole="button"
                    >
                      <Icon name="refresh" library="ionicons" size={16} color={Colors.secondaryDark} />
                      <Text style={styles.rescanText}>Pindai ulang</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.scanMessage}>
                  Pemindaian otomatis tidak tersedia di iOS. Masukkan nama Wi-Fi secara manual.
                </Text>
              )}
              <View style={styles.outlinedField}>
                <Text style={[styles.label, { color: focusedField === "ssid" ? Colors.secondary : isDark ? "#4B5563" : Colors.border, backgroundColor: isDark ? "#111827" : Colors.backgroundNurse }]}>Nama jaringan Wi-Fi</Text>
                <View style={[styles.inputBox, { borderColor: focusedField === "ssid" ? Colors.secondary : isDark ? "#4B5563" : Colors.border, borderWidth: focusedField === "ssid" ? 2 : 1 }, isDark && { backgroundColor: "#111827" }]}>
                  <Icon
                    name="wifi"
                    library="ionicons"
                    size={18}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    style={[styles.input, isDark && { color: "#F9FAFB" }]}
                    placeholder="Contoh: WiFi_Daycare_Lantai1"
                    value={ssid}
                    onChangeText={setSsid}
                    autoCapitalize="none"
                    onFocus={() => setFocusedField("ssid")}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.outlinedField}>
                <Text style={[styles.label, { color: focusedField === "password" ? Colors.secondary : isDark ? "#4B5563" : Colors.border, backgroundColor: isDark ? "#111827" : Colors.backgroundNurse }]}>Kata sandi Wi-Fi</Text>
                <View style={[styles.inputBox, { borderColor: focusedField === "password" ? Colors.secondary : isDark ? "#4B5563" : Colors.border, borderWidth: focusedField === "password" ? 2 : 1 }, isDark && { backgroundColor: "#111827" }]}>
                  <Icon
                    name="lock-closed-outline"
                    library="ionicons"
                    size={18}
                    color={Colors.textMuted}
                  />
                  <TextInput
                    style={[styles.input, isDark && { color: "#F9FAFB" }]}
                    placeholder="Kosongkan jika Wi-Fi tidak dikunci"
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    secureTextEntry
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
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
      <SuccessModal
        visible={isSuccessModalVisible}
        title="Konfigurasi kamera berhasil dikirim"
        message="Kamera akan mulai ulang dan mencoba terhubung ke Wi-Fi daycare. Hubungkan kembali ponsel Anda ke Wi-Fi daycare."
        onClose={() => router.replace("/(caregiver)/dashboard")}
      />
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
  outlinedField: { position: "relative", paddingTop: 8 },
  networkScanSection: { gap: 8 },
  scanStatus: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  scanMessage: { ...Typography.caption, color: Colors.textMuted },
  scanError: { ...Typography.caption, color: Colors.warningDark, lineHeight: 18 },
  networkOption: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: Radii.control, backgroundColor: Colors.white },
  networkOptionSelected: { borderWidth: 1, borderColor: Colors.secondary, backgroundColor: Colors.secondaryLight },
  networkName: { ...Typography.body, flex: 1, color: Colors.textPrimary },
  networkSignal: { ...Typography.caption, color: Colors.textMuted },
  rescanButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  rescanText: { ...Typography.captionStrong, color: Colors.secondaryDark },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    position: "absolute",
    zIndex: 1,
    top: 0,
    left: 12,
    paddingHorizontal: 4,
    backgroundColor: Colors.backgroundNurse,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
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
