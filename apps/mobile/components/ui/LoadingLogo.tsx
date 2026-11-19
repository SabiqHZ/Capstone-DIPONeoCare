import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type LoadingLogoProps = {
  size?: number | "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function LoadingLogo({
  size = "small",
  style,
  accessibilityLabel = "Memuat",
}: LoadingLogoProps) {
  const breathing = useRef(new Animated.Value(0)).current;
  const dimension =
    typeof size === "number" ? size : size === "large" ? 48 : 26;

  useEffect(() => {
    const animation = Animated.loop(
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

    animation.start();
    return () => animation.stop();
  }, [breathing]);

  const scale = breathing.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.06],
  });
  const opacity = breathing.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <View
      style={[styles.container, { width: dimension, height: dimension }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      <Animated.Image
        source={require("../../assets/icon.png")}
        resizeMode="contain"
        style={{ width: dimension, height: dimension, opacity, transform: [{ scale }] }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
