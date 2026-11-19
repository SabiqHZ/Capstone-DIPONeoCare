import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../constants/colors";
import { Typography } from "../constants/fonts";

export default function SplashRoute() {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(1)).current;
  const breathing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathing, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(breathing, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    breathingAnimation.start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => router.replace("/(auth)"));
    }, 1100);
    return () => {
      clearTimeout(timer);
      breathingAnimation.stop();
    };
  }, [breathing, opacity, router]);

  const logoScale = breathing.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.06],
  });
  const logoOpacity = breathing.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brand, { opacity }]}>
        <View style={styles.logoShell}>
          <Animated.Image
            source={require("../assets/icon.png")}
            style={[
              styles.logo,
              { opacity: logoOpacity, transform: [{ scale: logoScale }] },
            ]}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>DIPONeoCare</Text>
        <Text style={styles.tagline}>
          Pemantauan bayi yang lebih tenang dan aman
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  brand: { alignItems: "center", paddingHorizontal: 24 },
  logoShell: {
    width: 136,
    height: 136,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 68,
    backgroundColor: "#F7FAFF",
    marginBottom: 18,
  },
  logo: { width: "82%", height: "82%" },
  title: { ...Typography.display, color: Colors.secondaryDark },
  tagline: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
});
