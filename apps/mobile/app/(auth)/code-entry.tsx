import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  useWindowDimensions,
} from "react-native";
import { LoadingLogo } from "../../components/ui/LoadingLogo";
import { useRouter } from "expo-router";
import { OtpInput } from "../../components/ui/OtpInput";
import { useAuthStore } from "../../stores/auth.store";
import { CONFIG } from "../../constants/config";
import { authService } from "../../services/auth.service";
import { Typography } from "../../constants/fonts";
import { Colors } from "../../constants/colors";

const PARENT_LOGIN_ACCENT = "#26B893";

export default function CodeEntryScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const headerHeight = useRef(
    Math.min(300, Math.max(220, windowHeight * 0.34)),
  ).current;
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    "Kode tidak valid. Periksa kembali.",
  );
  const [code, setCode] = useState("");
  const enterProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterProgress, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [enterProgress]);

  const handleComplete = (val: string) => {
    setCode(val);
    setError(false);
    setErrorMessage("Kode tidak valid. Periksa kembali.");
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
      setErrorMessage(err.message || "Kode tidak valid");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactCaregiver = async () => {
    try {
      await Linking.openURL(
        `https://wa.me/${CONFIG.CAREGIVER_WHATSAPP_NUMBER}`,
      );
    } catch {
      Alert.alert(
        "Tidak dapat membuka WhatsApp",
        `Silakan hubungi pengasuh melalui WhatsApp di nomor +${CONFIG.CAREGIVER_WHATSAPP_NUMBER}.`,
      );
    }
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
              <View style={styles.headerBrand}>
                <View style={styles.brandText}>
                  <Text style={styles.appName}>Masuk Orang Tua</Text>
                  <Text style={styles.appSub}>
                    Masuk dengan kode akses dari pengasuh
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Masukkan Kode Akses</Text>

              <OtpInput
                onComplete={handleComplete}
                disabled={isLoading}
                error={error}
                accentColor={PARENT_LOGIN_ACCENT}
              />

              {error ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
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
                  <LoadingLogo color="#fff" />
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
      </Animated.View>
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
    zIndex: 10,
    top: 10,
    left: 5,
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
  header: {
    alignItems: "flex-start",
    justifyContent: "flex-end",
    backgroundColor: PARENT_LOGIN_ACCENT,
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
    alignItems: "flex-start",
    alignSelf: "stretch",
    maxWidth: 420,
  },
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
    marginTop: -20,
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
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 230,
    marginBottom: 12,
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
