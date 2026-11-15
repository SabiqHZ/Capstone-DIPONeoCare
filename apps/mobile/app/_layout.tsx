import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts as usePoppins,
} from "@expo-google-fonts/poppins";
import { useAuthStore } from "../stores/auth.store";
import { BabyProvider } from "../context/BabyContext";
import { useNotifications } from "../hooks/useNotifications";
import { ThemeProvider } from "../context/ThemeContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { user, isHydrated, hydrate } = useAuthStore();
  useNotifications();
  const router = useRouter();
  const segments = useSegments();

  const [poppinsLoaded] = usePoppins({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  const fontsLoaded = poppinsLoaded;

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!isHydrated || !fontsLoaded) return;
    SplashScreen.hideAsync();

    const inAuth = segments[0] === "(auth)";
    const inSplash = segments[0] === "splash";
    const inParent = segments[0] === "(parent)";
    const inCaregiver = segments[0] === "(caregiver)";

    if (!user && !inAuth && !inSplash) {
      router.replace("/(auth)");
    } else if (user?.role === "parent" && !inParent) {
      router.replace("/(parent)/dashboard");
    } else if (user?.role === "caregiver" && !inCaregiver) {
      router.replace("/(caregiver)/dashboard");
    }
  }, [isHydrated, fontsLoaded, user]);

  if (!fontsLoaded || !isHydrated) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BabyProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </BabyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
