import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";

export default function WelcomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        style={{ opacity: fade }}
        contentContainerStyle={[
          styles.content,
          compact && styles.contentCompact,
        ]}
        bounces={false}
      >
        <View style={[styles.brand, compact && styles.brandCompact]}>
          <View style={[styles.logoShell, compact && styles.logoShellCompact]}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Logo DIPONeoCare"
            />
          </View>
          <Text style={styles.appName}>DIPONeoCare</Text>
          <Text style={styles.tagline}>
            Smart Baby Monitoring, Safer Tomorrow.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.parentButton}
            onPress={() => router.push("/(auth)/code-entry")}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Masuk sebagai orang tua dengan kode akses"
          >
            <Text style={styles.parentButtonText}>Masuk sebagai Orang Tua</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.caregiverButton}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Masuk sebagai pengasuh"
          >
            <Text style={styles.caregiverButtonText}>
              Masuk sebagai Pengasuh
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  content: {
    flexGrow: 1,
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 48,
  },
  contentCompact: { paddingTop: 28, paddingBottom: 28 },
  brand: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingBottom: 20,
  },
  brandCompact: { paddingBottom: 8 },
  logoShell: {
    width: 156,
    height: 156,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 78,
    backgroundColor: Colors.white,
    marginBottom: 18,
    elevation: 5,
    shadowColor: Colors.secondaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  logoShellCompact: {
    width: 124,
    height: 124,
    borderRadius: 62,
    marginBottom: 12,
  },
  logo: { width: "82%", height: "82%" },
  appName: {
    ...Typography.display,
    color: Colors.secondaryDark,
    textAlign: "center",
  },
  tagline: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  actions: { width: "100%", maxWidth: 440, alignItems: "center", gap: 12 },
  description: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  parentButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    elevation: 3,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  parentButtonText: { ...Typography.bodyStrong, color: Colors.white },
  caregiverButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondaryLight,
  },
  caregiverButtonText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 15,
    color: Colors.secondaryDark,
  },
});
