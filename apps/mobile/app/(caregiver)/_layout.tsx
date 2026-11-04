import { Stack } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../context/ThemeContext';

export default function NurseLayout() {
  const { isDark } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? '#111827' : Colors.backgroundNurse },
      }}
    />
  );
}
