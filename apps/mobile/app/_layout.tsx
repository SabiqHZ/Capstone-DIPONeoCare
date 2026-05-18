import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts as useNunito,
} from '@expo-google-fonts/nunito';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts as useInter,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '../stores/auth.store';
import { BabyProvider } from '../context/BabyContext';
import { useNotifications } from '../hooks/useNotifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { user, isHydrated, hydrate } = useAuthStore();
  useNotifications();
  const router = useRouter();
  const segments = useSegments();

  const [nunitoLoaded] = useNunito({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const fontsLoaded = nunitoLoaded && interLoaded;

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!isHydrated || !fontsLoaded) return;
    SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)';
    const inParent = segments[0] === '(parent)';
    const inCaregiver = segments[0] === '(caregiver)';

    if (!user && !inAuth) {
      router.replace('/(auth)/code-entry');
    } else if (user?.role === 'parent' && !inParent) {
      router.replace('/(parent)/dashboard');
    } else if (user?.role === 'caregiver' && !inCaregiver) {
      router.replace('/(caregiver)/dashboard');
    }
  }, [isHydrated, fontsLoaded, user]);

  if (!fontsLoaded || !isHydrated) return null;

  return (
    <BabyProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </BabyProvider>
  );
}