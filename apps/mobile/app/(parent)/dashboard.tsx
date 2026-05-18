import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../../stores/auth.store';
import {
  useBabyContext,
  useFocusedBabyStatus,
  useActiveAlerts,
} from '../../context/BabyContext';
import { babyService } from '../../services/baby.service';
import { ActivityCard } from '../../components/baby/ActivityCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { FaceAnomalyBanner } from '@/components/ui/FaceAnomalyBanner';

interface BabyProfile {
  id: string;
  name: string;
  bed_number: string;
  date_of_birth: string;
  parent_name: string;
  unique_code: string;
  unit_id: string;
  created_at: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const { setFocused, acknowledgeAlert } = useBabyContext();
  const status = useFocusedBabyStatus();
  const alerts = useActiveAlerts();
  
  const [babyProfile, setBabyProfile] = useState<BabyProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [faceAnomalyDismissed, setFaceAnomalyDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const babyName = useAuthStore((s) => s.user?.role === 'parent' ? s.user.babyName : '');
  const babyId = useAuthStore((s) => s.user?.role === 'parent' ? s.user.babyId : '');
  const logout = useAuthStore((s) => s.logout);

  const fetchBabyProfile = useCallback(async () => {
    if (!babyId) return;
    try {
      setIsProfileLoading(true);
      const res = await babyService.getBabyById(babyId);
      setBabyProfile(res as BabyProfile);
    } catch (err) {
      console.error('[Dashboard] Gagal memuat profil identitas bayi:', err);
    } finally {
      setIsProfileLoading(false);
    }
  }, [babyId]);

  useEffect(() => {
    if (babyId) {
      setFocused(babyId);
      fetchBabyProfile();
    }
  }, [babyId, setFocused, fetchBabyProfile]);

  useEffect(() => {
    if (status?.faceAnomaly === 'face_covered') {
      setFaceAnomalyDismissed(false);
    }
  }, [status?.faceAnomaly, status?.lastUpdated]);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/code-entry');
  };

  if (!babyId) return null;

  const showFaceAnomaly = status?.faceAnomaly === 'face_covered' && !faceAnomalyDismissed;
  const visibleAlerts = alerts.slice(0, 3);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Halo, Orang Tua</Text>
            <Text style={styles.babyName}>{babyName || babyProfile?.name}</Text>
          </View>
          
          <View style={styles.headerRight}>
            <View style={[
              styles.badge,
              { backgroundColor: status?.deviceOnline ? '#052e16' : '#1f0a0a' },
            ]}>
              <View style={[
                styles.badgeDot,
                { backgroundColor: status?.deviceOnline ? '#4ade80' : '#f87171' },
              ]} />
              <Text style={[
                styles.badgeText,
                { color: status?.deviceOnline ? '#4ade80' : '#f87171' },
              ]}>
                {status?.deviceOnline ? 'Online' : 'Offline'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>Keluar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banners Peringatan */}
        {visibleAlerts.map((a) => (
          <AlertBanner
            key={a.id}
            message={a.message}
            severity={a.severity}
            time={new Date(a.timestamp).toLocaleTimeString('id-ID')}
            onDismiss={() => acknowledgeAlert(a.id)}
          />
        ))}

        <FaceAnomalyBanner
          visible={showFaceAnomaly}
          onDismiss={() => setFaceAnomalyDismissed(true)}
        />

        {/* Konten Utama: Data Identitas Pasien (4 di Awal + Toggle) */}
        {isProfileLoading || !babyProfile ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1D9E75" />
            <Text style={styles.loadingText}>Memuat identitas pasien...</Text>
          </View>
        ) : (
          <View style={styles.identityCard}>
            <Text style={styles.cardTitle}>Data Identitas Pasien Bayi</Text>
            <View style={styles.divider} />
            
            {/* 4 Identitas Utama Utama */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama Lengkap</Text>
              <Text style={styles.infoValue}>{babyProfile.name}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nomor Tempat Tidur</Text>
              <Text style={styles.infoValue}>{babyProfile.bed_number}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal Lahir</Text>
              <Text style={styles.infoValue}>
                {new Date(babyProfile.date_of_birth).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama Orang Tua (Wali)</Text>
              <Text style={styles.infoValue}>{babyProfile.parent_name}</Text>
            </View>

            {/* Identitas Tambahan Tersembunyi */}
            {isExpanded && (
              <View style={styles.expandedContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Kode Unik Akses</Text>
                  <Text style={[styles.infoValue, styles.monoText]}>{babyProfile.unique_code}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Waktu Masuk Sistem</Text>
                  <Text style={styles.infoValue}>
                    {new Date(babyProfile.created_at).toLocaleDateString('id-ID')} - {new Date(babyProfile.created_at).toLocaleTimeString('id-ID')}
                  </Text>
                </View>
              </View>
            )}

            {/* Tombol Lebih Lanjut Menggunakan SVG Panah */}
            <TouchableOpacity 
              style={styles.expandButton} 
              onPress={() => setIsExpanded(!isExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'Sembunyikan' : 'Lebih Lanjut'}
              </Text>
              <Svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#0F6E56" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }], marginLeft: 4 }}
              >
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        {/* Activity Card Utama diletakkan di bawah Identitas Bayi */}
        {status && (
          <ActivityCard
            key={`${status.activity}-${status.soundClass}-${status.lastUpdated}`}
            activity={status.activity ?? 'sleeping'}
            soundClass={status.soundClass ?? 'not_crying'}
            soundConfidence={status.soundConfidence ?? 0}
            nightVision={status.nightVisionActive}
            faceAnomaly={status.faceAnomaly ?? 'none'}
          />
        )}

        {status?.lastUpdated && (
          <Text style={styles.lastUpdated}>
            Sinkronisasi terakhir: {new Date(status.lastUpdated).toLocaleTimeString('id-ID')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F9F5' },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  headerLeft: { flex: 1, gap: 2 },
  greeting: { fontSize: 13, color: '#0F6E56', fontWeight: '500' },
  babyName: { fontSize: 24, fontWeight: '700', color: '#085041' },
  bedNum: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 8 },

  // Badges & Buttons
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  logoutText: { fontSize: 11, color: '#E24B4A', fontWeight: '600' },

  // Loading State
  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  loadingText: { fontSize: 13, color: '#6B7280' },

  // Identity Card Style
  identityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#085041',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1.5,
  },
  expandedContent: {
    gap: 12,
    marginTop: 4,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  expandButtonText: {
    fontSize: 12,
    color: '#0F6E56',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif-medium',
    fontWeight: '600',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#0F6E56',
    letterSpacing: 0.5,
  },
  lastUpdated: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
  },
});