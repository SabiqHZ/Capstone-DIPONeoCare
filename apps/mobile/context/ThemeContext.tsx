import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Icon } from "../components/ui/Icon";

type ThemeMode = "light" | "dark";
type ThemeContextValue = { mode: ThemeMode; isDark: boolean; toggleMode: () => void };
const ThemeContext = createContext<ThemeContextValue>({ mode: "light", isDark: false, toggleMode: () => {} });
const STORAGE_KEY = "diponeocare-theme-mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then(value => { if (value === "dark" || value === "light") setMode(value); }).catch(() => {}); }, []);
  const toggleMode = () => setMode(current => {
    const next = current === "light" ? "dark" : "light";
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    return next;
  });
  return <ThemeContext.Provider value={{ mode, isDark: mode === "dark", toggleMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeSwitch() {
  const { isDark, toggleMode } = useTheme();
  const slide = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  useEffect(() => { Animated.timing(slide, { toValue: isDark ? 1 : 0, duration: 220, useNativeDriver: true }).start(); }, [isDark, slide]);
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  return (
    <Pressable onPress={toggleMode} accessibilityRole="switch" accessibilityState={{ checked: isDark }} accessibilityLabel={isDark ? "Mode gelap aktif" : "Mode terang aktif"} style={[switchStyles.track, isDark && switchStyles.trackDark]}>
      <Icon name={isDark ? "moon" : "sunny"} size={13} color={isDark ? "#CBD5E1" : "#92400E"} />
      <Animated.View style={[switchStyles.thumb, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}
const switchStyles = StyleSheet.create({ track: { width: 52, height: 30, borderRadius: 16, backgroundColor: "#D1FAE5", flexDirection: "row", alignItems: "center", justifyContent: "space-around" }, trackDark: { backgroundColor: "#374151" }, thumb: { position: "absolute", left: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", elevation: 2 } });
