import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, {
  Path,
  Circle,
  Line,
} from "react-native-svg";
import { useAuthStore } from "../../stores/auth.store";
import { authService } from "../../services/auth.service";
import { Typography } from "../../constants/fonts";
import { Colors } from "../../constants/colors";

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
  const { setUser } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState<"username" | "password" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Lengkapi Data", "Nama pengguna dan kata sandi wajib diisi.");
      return;
    }
    setIsLoading(true);
    try {
      const user = await authService.loginCaregiver(username.trim(), password);
      await setUser(user);
      router.replace("/(caregiver)/dashboard");
    } catch (err: any) {
      Alert.alert(
        "Gagal masuk",
        err.message || "Nama pengguna atau kata sandi salah.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <View pointerEvents="none" style={styles.gridPattern} />
            <View pointerEvents="none" style={styles.dotPattern} />
            <View style={styles.logoGlow}>
              <Image
                source={require("../../assets/icon.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Masuk Pengasuh</Text>
            <Text style={styles.subtitle}>
              Masuk untuk memantau bayi dan mengelola aktivitas pengasuhan.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: focusedField === "username" ? Colors.secondary : Colors.border }]}>Nama Pengasuh</Text>
              <TextInput
                style={[styles.input, focusedField === "username" && styles.inputFocused]}
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
              <Text style={[styles.label, { color: focusedField === "password" ? Colors.secondary : Colors.border }]}>Kata sandi</Text>
              <View>
                <TextInput
                  style={[styles.input, focusedField === "password" && styles.inputFocused]}
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
                    showPass ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
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
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Bukan Pengasuh? Kembali"
          >
            <Text style={styles.backText}>Bukan Pengasuh?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FA" },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    justifyContent: "center",
  },
  backBtn: {
    alignSelf: "center",
    marginTop: 20,
    justifyContent: "center",
    paddingVertical: 8,
  },
  backText: {
    ...Typography.bodyStrong,
    color: Colors.secondaryDark,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.secondary,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "49%",
    paddingTop: 76,
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
    marginTop: 178,
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
    textAlign: "center",
    maxWidth: 300,
    marginTop: 10,
  },
  subtitle: { ...Typography.body, color: "#EAF3FF", textAlign: "center" },
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
    marginTop: 104,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  field: { position: "relative", paddingTop: 8 },
  label: { ...Typography.captionStrong, position: "absolute", zIndex: 1, top: 0, left: 12, paddingHorizontal: 4, backgroundColor: "#FFFFFF" },
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
});
