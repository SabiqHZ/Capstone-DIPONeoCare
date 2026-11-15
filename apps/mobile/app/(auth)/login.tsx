import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useAuthStore } from "../../stores/auth.store";
import { authService } from "../../services/auth.service";
import { Icon } from "../../components/ui/Icon";
import { Typography } from "../../constants/fonts";
import { Colors } from "../../constants/colors";

interface RecoveryModalState {
  title: string;
  message: string;
  whatsappUrl: string | null;
  emailUrl: string | null;
}

// --- Komponen SVG ---
const EyeIcon = ({ color = "#9CA3AF", size = 22 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

const EyeOffIcon = ({ color = "#9CA3AF", size = 22 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <Line x1="1" y1="1" x2="23" y2="23" />
  </Svg>
);
// --------------------

export default function LoginScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const headerHeight = Math.min(300, Math.max(220, windowHeight * 0.34));
  const { setUser } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState<
    "username" | "password" | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isContactingAdmin, setIsContactingAdmin] = useState(false);
  const [recoveryModal, setRecoveryModal] = useState<RecoveryModalState | null>(
    null,
  );
  const enterProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterProgress, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [enterProgress]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Nama pengguna dan kata sandi wajib diisi.");
      return;
    }
    setErrorMessage("");
    setIsLoading(true);
    try {
      const user = await authService.loginCaregiver(username.trim(), password);
      await setUser(user);
      router.replace("/(caregiver)/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message || "Nama pengguna atau kata sandi salah.");
    } finally {
      setIsLoading(false);
    }
  };

  const openAdminContact = async (url: string) => {
    setRecoveryModal(null);
    try {
      await Linking.openURL(url);
    } catch {
      setRecoveryModal({
        title: "Tidak dapat membuka kontak",
        message: "Coba hubungi admin secara langsung.",
        whatsappUrl: null,
        emailUrl: null,
      });
    }
  };

  const handleForgotPassword = async () => {
    if (!username.trim()) {
      setRecoveryModal({
        title: "Masukkan nama pengguna",
        message: "Isi nama pengguna agar admin dapat mengenali akun Anda.",
        whatsappUrl: null,
        emailUrl: null,
      });
      return;
    }

    setIsContactingAdmin(true);
    try {
      const contact = await authService.getCaregiverRecoveryContact();
      const message = `Halo Admin, saya pengasuh dengan nama pengguna ${username.trim()}. Saya lupa kata sandi dan memerlukan bantuan pemulihan akun.`;
      const whatsappNumber = contact.whatsapp?.replace(/\D/g, "");
      const whatsappUrl = whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
        : null;
      const emailUrl = contact.email
        ? `mailto:${contact.email}?subject=${encodeURIComponent("Bantuan pemulihan akun pengasuh")}&body=${encodeURIComponent(message)}`
        : null;

      setRecoveryModal(
        whatsappUrl || emailUrl
          ? {
              title: "Hubungi Admin",
              message: "Pilih cara untuk meminta bantuan pemulihan akun.",
              whatsappUrl,
              emailUrl,
            }
          : {
              title: "Kontak belum tersedia",
              message: "Kontak admin belum dikonfigurasi.",
              whatsappUrl: null,
              emailUrl: null,
            },
      );
    } catch {
      setRecoveryModal({
        title: "Belum dapat menghubungi admin",
        message:
          "Kontak admin belum tersedia dari server. Silakan coba lagi nanti.",
        whatsappUrl: null,
        emailUrl: null,
      });
    } finally {
      setIsContactingAdmin(false);
    }
  };

  const openRecoveryChannel = (url: string | null | undefined) => {
    if (url) void openAdminContact(url);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View
        style={[
          styles.flex,
          {
            opacity: enterProgress,
            transform: [
              {
                translateY: enterProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.inner}>
            <TouchableOpacity
              style={styles.backToWelcome}
              onPress={() => router.replace("/(auth)")}
              accessibilityRole="button"
              accessibilityLabel="Kembali ke halaman awal"
              hitSlop={8}
            >
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <View style={[styles.header, { height: headerHeight }]}>
              <View pointerEvents="none" style={styles.gridPattern} />
              <View pointerEvents="none" style={styles.dotPattern} />
              <Text style={styles.title}>Masuk Pengasuh</Text>
              <Text style={styles.subtitle}>
                Masuk untuk memantau bayi dan mengelola aktivitas pengasuhan.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.field}>
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        focusedField === "username"
                          ? Colors.secondary
                          : Colors.border,
                    },
                  ]}
                >
                  Nama Pengasuh
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === "username" && styles.inputFocused,
                  ]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Masukkan nama Pengasuh"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.field}>
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        focusedField === "password"
                          ? Colors.secondary
                          : Colors.border,
                    },
                  ]}
                >
                  Kata sandi
                </Text>
                <View>
                  <TextInput
                    style={[
                      styles.input,
                      focusedField === "password" && styles.inputFocused,
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Masukkan kata sandi"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    editable={!isLoading}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPass(!showPass)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPass
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                    accessibilityHint={
                      showPass
                        ? "Menyamarkan kata sandi di kolom"
                        : "Menampilkan kata sandi di kolom"
                    }
                  >
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </TouchableOpacity>
                </View>
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.btn, isLoading ? styles.btnDisabled : null]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Masuk</Text>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.recoveryBtn}
              onPress={() => void handleForgotPassword()}
              disabled={isLoading || isContactingAdmin}
              accessibilityRole="button"
              accessibilityLabel="Lupa password? Hubungi Admin"
              accessibilityHint="Membuka WhatsApp atau email untuk meminta bantuan pemulihan akun"
            >
              {isContactingAdmin ? (
                <ActivityIndicator size="small" color={Colors.secondaryDark} />
              ) : (
                <Text style={styles.recoveryText}>
                  Lupa password?{" "}
                  <Text style={styles.recoveryLinkText}>Hubungi Admin</Text>
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace("/(auth)/code-entry")}
              accessibilityRole="button"
              accessibilityLabel="Bukan Pengasuh? Masuk dengan kode akses"
            >
              <Text style={styles.backText}>Bukan Pengasuh?</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
      <Modal
        visible={recoveryModal !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setRecoveryModal(null)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={45}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.modalScrim]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup dialog pemulihan sandi"
            style={StyleSheet.absoluteFill}
            onPress={() => setRecoveryModal(null)}
          />
          {recoveryModal ? (
            <View
              style={styles.modalCard}
              accessibilityViewIsModal
              accessibilityLabel={recoveryModal.title}
            >
              <View style={styles.modalTopRow}>
                <View style={styles.modalIcon}>
                  <Icon
                    name="chatbubble-ellipses-outline"
                    library="ionicons"
                    size={24}
                    color={Colors.secondaryDark}
                  />
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setRecoveryModal(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Tutup dialog"
                >
                  <Icon name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalTitle}>{recoveryModal.title}</Text>
              <Text style={styles.modalMessage}>{recoveryModal.message}</Text>
              <View style={styles.modalActions}>
                {recoveryModal.emailUrl ? (
                  <TouchableOpacity
                    style={
                      recoveryModal.whatsappUrl
                        ? styles.modalCancelButton
                        : styles.modalConfirmButton
                    }
                    onPress={() => openRecoveryChannel(recoveryModal.emailUrl)}
                    accessibilityRole="button"
                    accessibilityLabel="Hubungi admin melalui email"
                  >
                    <Text
                      style={
                        recoveryModal.whatsappUrl
                          ? styles.modalCancelText
                          : styles.modalConfirmText
                      }
                    >
                      Email
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {recoveryModal.whatsappUrl ? (
                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={() =>
                      openRecoveryChannel(recoveryModal.whatsappUrl)
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Hubungi admin melalui WhatsApp"
                  >
                    <Text style={styles.modalConfirmText}>WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
                {!recoveryModal.emailUrl && !recoveryModal.whatsappUrl ? (
                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={() => setRecoveryModal(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Tutup informasi"
                  >
                    <Text style={styles.modalConfirmText}>Tutup</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FA" },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    backgroundColor: "#F7F8FA",
  },
  backToWelcome: {
    position: "absolute",
    zIndex: 3,
    top: 4,
    left: 0,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  backArrow: {
    color: Colors.white,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "Poppins_400Regular",
  },
  backBtn: {
    alignSelf: "center",
    marginTop: 12,
    justifyContent: "center",
    paddingVertical: 8,
  },
  recoveryBtn: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    marginTop: 8,
  },
  recoveryText: {
    ...Typography.body,
    color: "#6B7280",
    textAlign: "center",
  },
  recoveryLinkText: {
    ...Typography.bodyStrong,
    fontSize: 12,
    color: Colors.secondaryDark,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalScrim: {
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: "stretch",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.infoLight,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
    marginRight: -8,
  },
  modalTitle: {
    ...Typography.h3,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: "left",
  },
  modalMessage: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: "left",
  },
  modalActions: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    ...Typography.bodyStrong,
    color: Colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    ...Typography.bodyStrong,
    color: Colors.white,
  },
  backText: {
    ...Typography.bodyStrong,
    color: Colors.secondaryDark,
    textAlign: "center",
  },
  header: {
    alignItems: "flex-start",
    justifyContent: "flex-end",
    backgroundColor: Colors.secondary,
    marginHorizontal: -20,
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: 28,
    overflow: "hidden",
  },
  gridPattern: {
    ...StyleSheet.absoluteFill,
    opacity: 0.1,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
  },
  dotPattern: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 24,
    right: -70,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  logoGlow: {
    width: 100,
    height: 100,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 50,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 10,
  },
  logoImage: { width: 100, height: 100 },
  title: {
    ...Typography.display,
    fontSize: 30,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    textAlign: "left",
    maxWidth: 300,
    marginTop: 8,
  },
  subtitle: { ...Typography.body, color: "#EAF3FF", textAlign: "left" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: Colors.secondaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
    marginTop: -20,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  field: { position: "relative", paddingTop: 8 },
  label: {
    ...Typography.captionStrong,
    position: "absolute",
    zIndex: 1,
    top: 0,
    left: 12,
    paddingHorizontal: 4,
    backgroundColor: "#FFFFFF",
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 50,
    ...Typography.body,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  inputFocused: { borderWidth: 2, borderColor: Colors.secondary },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 0,
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    minHeight: 50,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: { backgroundColor: "#B5D4F4" },
  btnText: { ...Typography.bodyStrong, color: "#fff" },
  errorText: {
    ...Typography.caption,
    color: "#B91C1C",
    textAlign: "center",
  },
});
