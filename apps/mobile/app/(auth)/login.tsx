import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Alert, SafeAreaView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useAuthStore } from '../../stores/auth.store';
import { authService } from '../../services/auth.service';

// --- Komponen SVG ---
const EyeIcon = ({ color = "#9CA3AF", size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

const EyeOffIcon = ({ color = "#9CA3AF", size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <Line x1="1" y1="1" x2="23" y2="23" />
  </Svg>
);
// --------------------

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Lengkapi Data', 'Username dan password wajib diisi.');
      return;
    }
    setIsLoading(true);
    try {
      const user = await authService.loginCaregiver(username.trim(), password);
      await setUser(user);
      router.replace('/(caregiver)/dashboard');
    } catch (err: any) {
      Alert.alert('Login Gagal', err.message || 'Username atau password salah.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Kembali</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.logoImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Portal Pengasuh</Text>
            <Text style={styles.subtitle}>Smart Vision Daycare</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Masukkan username"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Masukkan password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPass(!showPass)}
                  activeOpacity={0.7}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EFF6FF' },
  flex: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 24 },
  backBtn: { position: 'absolute', top: 16, left: 24, zIndex: 10, padding: 8 },
  backText: { fontSize: 14, color: '#185FA5', fontWeight: '600' },
  header: { alignItems: 'center', gap: 8 },
  logoCircle: {
    width: 85, height: 85, borderRadius: 50,
    backgroundColor: '#378ADD',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    overflow: 'hidden',
  },
  logoImage: { width: 85, height: 85 },
  title: { fontSize: 24, fontWeight: '700', color: '#0C447C', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#185FA5' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28, gap: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, paddingRight: 45, 
    fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  eyeBtn: { 
    position: 'absolute', 
    right: 14, 
    top: 10, 
    padding: 2 
  },
  btn: { backgroundColor: '#378ADD', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#B5D4F4' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});