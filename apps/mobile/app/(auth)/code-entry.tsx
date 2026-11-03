import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Image,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { OtpInput } from "../../components/ui/OtpInput";
import { useAuthStore } from "../../stores/auth.store";
import { authService } from "../../services/auth.service";
import { Typography } from "../../constants/fonts";
import { Colors } from "../../constants/colors";

const PARENT_LOGIN_ACCENT = "#26B893";

export default function CodeEntryScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [code, setCode] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleComplete = (val: string) => {
    setCode(val);
    setError(false);
  };

  const handleSubmit = async () => {
    if (code.length !== 8) return;
    setIsLoading(true);
    setError(false);
    try {
      const user = await authService.loginWithCode(code);
      await setUser(user);
      router.replace("/(parent)/dashboard");
    } catch (err: any) {
      setError(true);
      Alert.alert("Gagal Masuk", err.message || "Kode tidak valid");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactCaregiver = async () => {
    try {
      await Linking.openURL("https://wa.me/6282221023983");
    } catch {
      Alert.alert(
        "Tidak dapat membuka WhatsApp",
        "Silakan hubungi pengasuh melalui WhatsApp di nomor +62 822-2102-3983.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inner}>
          <View
            style={[
              styles.header,
              isKeyboardVisible && styles.headerKeyboardVisible,
            ]}
          >
            <View pointerEvents="none" style={styles.gridPattern} />
            <View pointerEvents="none" style={styles.dotPattern} />
            <View style={styles.headerBrand}>
              <View style={styles.logoCircle}>
                <Image
                  source={require("../../assets/icon.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandText}>
                <Text style={styles.appName}>DIPONeoCare</Text>
                <Text style={styles.appSub}>
                  Smart Baby Monitoring, Safer Tomorrow.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Masukkan Kode Akses</Text>
            <Text style={styles.cardDesc}>
              Kode 8 karakter diberikan oleh pengasuh
            </Text>

            <OtpInput
              onComplete={handleComplete}
              disabled={isLoading}
              error={error}
              accentColor={PARENT_LOGIN_ACCENT}
            />

            {error ? (
              <Text style={styles.errorText}>
                Kode tidak valid. Periksa kembali.
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.btn,
                code.length !== 8 || isLoading ? styles.btnDisabled : null,
              ]}
              onPress={handleSubmit}
              disabled={code.length !== 8 || isLoading}
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
            style={styles.codeHelpLink}
            onPress={handleContactCaregiver}
            accessibilityRole="link"
            accessibilityLabel="Lupa kode? Hubungi Pengasuh melalui WhatsApp"
          >
            <Text style={styles.codeHelpPrompt}>Lupa kode? </Text>
            <Text style={styles.codeHelpAction}>Hubungi Pengasuh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nurseLink}
            onPress={() => router.push("/(auth)/login")}
            accessibilityRole="link"
            accessibilityLabel="Pengasuh? Masuk di sini"
          >
            <Text style={styles.nurseLinkPrompt}>Pengasuh? </Text>
            <Text style={styles.nurseLinkAction}>Masuk di sini</Text>
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
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  header: {
    alignItems: "center",
    gap: 8,
    backgroundColor: PARENT_LOGIN_ACCENT,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "49%",
    paddingTop: 320,
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  headerKeyboardVisible: {
    paddingTop: 85,
    overflow: "visible",
  },
  gridPattern: {
    ...StyleSheet.absoluteFill,
    opacity: 0.1,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: Colors.white,
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
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    alignSelf: "center",
    maxWidth: 360,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    overflow: "hidden",
  },
  logoImage: { width: 96, height: 96 },
  brandText: {
    flexShrink: 1,
    maxWidth: 220,
    gap: 4,
    alignItems: "flex-start",
  },
  appName: {
    ...Typography.display,
    color: Colors.white,
    letterSpacing: -0.5,
    textAlign: "left",
  },
  appSub: { ...Typography.body, color: "#E9FFF8", textAlign: "left" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#126D57",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
    marginTop: 10,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  cardTitle: { ...Typography.h3, color: "#111827", textAlign: "center" },
  cardDesc: {
    ...Typography.body,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: { ...Typography.caption, color: "#B91C1C", textAlign: "center" },
  btn: {
    backgroundColor: PARENT_LOGIN_ACCENT,
    borderRadius: 12,
    minHeight: 50,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PARENT_LOGIN_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: { backgroundColor: "#A8E5D4", shadowOpacity: 0 },
  btnText: { ...Typography.bodyStrong, color: "#fff" },
  codeHelpLink: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 8,
    marginTop: 12,
  },
  codeHelpPrompt: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  codeHelpAction: {
    ...Typography.captionStrong,
    color: Colors.primaryMid,
    textDecorationLine: "underline",
  },
  nurseLink: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 12,
  },
  nurseLinkPrompt: {
    ...Typography.captionStrong,
    color: Colors.textMuted,
  },
  nurseLinkAction: {
    ...Typography.captionStrong,
    color: Colors.primaryMid,
    textDecorationLine: "underline",
  },
});
