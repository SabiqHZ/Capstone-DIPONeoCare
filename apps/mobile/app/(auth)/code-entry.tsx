import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OtpInput } from '../../components/ui/OtpInput';
import { useAuthStore } from '../../stores/auth.store';
import { authService } from '../../services/auth.service';

export default function CodeEntryScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [code, setCode] = useState('');

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
      router.replace('/(parent)/dashboard');
    } catch (err: any) {
      setError(true);
      Alert.alert('Gagal Masuk', err.message || 'Kode tidak valid');
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
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.logoImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>Smart Vision</Text>
            <Text style={styles.appSub}>Monitoring Bayi Real-time</Text>
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
            />

            {error ? (
              <Text style={styles.errorText}>Kode tidak valid. Periksa kembali.</Text>
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
            style={styles.nurseLink}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.nurseLinkText}>Pengasuh? Login di sini</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F9F5' },
  flex: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 28 },
  header: { alignItems: 'center', gap: 8 },
  logoCircle: {
    width: 85, height: 85, borderRadius: 50,
    backgroundColor: '#1D9E75',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    overflow: 'hidden',
  },
  logoImage: { width: 80, height: 80 },
  appName: { fontSize: 28, fontWeight: '700', color: '#085041', letterSpacing: -0.5 },
  appSub: { fontSize: 14, color: '#0F6E56' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28, gap: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  cardDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  errorText: { fontSize: 12, color: '#E24B4A', textAlign: 'center' },
  btn: { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#9FE1CB' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  nurseLink: { alignItems: 'center', paddingVertical: 8 },
  nurseLinkText: { fontSize: 13, color: '#0F6E56', textDecorationLine: 'underline' },
});