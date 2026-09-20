import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';
import { Icon } from '../../components/ui/Icon';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { babyService } from '../../services/baby.service';
import { Baby } from '../../types';
import { MuteToggle } from '../../components/ui/MuteToggle';
// INJEKSI REALTIME: Import context
import { useAllBabyStatuses } from '../../context/BabyContext'; 

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface BabyWithStatus extends Baby {
  baby_statuses?: {
    is_crying: boolean;
    crying_duration_sec: number;
    alert_level: string;
    night_vision_active: boolean;
    activity?: string;
    sound_class?: string;
    face_anomaly?: string;
    updated_at: string;
  } | null;
  devices?: {
    id: string;
    mac_address: string;
    is_online: boolean;
    last_heartbeat: string | null;
  } | null;
}

const activityLabel: Record<string, string> = {
  sleeping: 'Tidur',
  awake: 'Bangun',
  crying: 'Menangis',
};
const activityColor: Record<string, string> = {
  sleeping: Colors.primary,
  awake: Colors.warning,
  crying: Colors.danger,
};

function BabyCard({ baby, onPress }: { baby: BabyWithStatus; onPress: () => void }) {
  // INJEKSI REALTIME: Membaca status real-time dari context, fallback ke data statis jika context kosong
  const realtimeStatuses = useAllBabyStatuses();
  const activeStatus = realtimeStatuses[baby.id];

  const isOnline = activeStatus ? activeStatus.deviceOnline : (baby.devices?.is_online ?? false);
  const isCrying = activeStatus ? activeStatus.isCrying : (baby.baby_statuses?.is_crying ?? false);
  const activity = activeStatus ? activeStatus.activity : (baby.baby_statuses?.activity ?? 'sleeping');
  const faceCovered = activeStatus ? activeStatus.faceAnomaly !== 'none' : Boolean(baby.baby_statuses?.face_anomaly && baby.baby_statuses.face_anomaly !== 'none');
  const nvActive = activeStatus ? activeStatus.nightVisionActive : (baby.baby_statuses?.night_vision_active ?? false);
  const cryingSec = activeStatus ? activeStatus.cryingDurationSec : (baby.baby_statuses?.crying_duration_sec ?? 0);

  const borderColor = faceCovered
    ? '#7C3AED'
    : isCrying
    ? Colors.danger
    : Colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderTopColor: borderColor, borderTopWidth: 3 },
        !isOnline && styles.cardOffline,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardThumb}>
        <Icon
          name="baby-face-outline"
          library="material"
          size={40}
          color={isOnline ? borderColor : Colors.textDisabled}
        />

        {faceCovered ? (
          <View style={[styles.nvPill, { backgroundColor: '#5B21B6' }]}>
            <Icon name="eye-off-outline" library="ionicons" size={10} color="#fff" />
            <Text style={[styles.nvText, { color: '#fff' }]}>Wajah</Text>
          </View>
        ) : nvActive ? (
          <View style={styles.nvPill}>
            <Icon name="moon" library="ionicons" size={10} color="#a78bfa" />
            <Text style={styles.nvText}>NV</Text>
          </View>
        ) : null}

        <View style={[styles.onlinePill, { backgroundColor: isOnline ? '#052e16' : Colors.borderLight }]}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#4ade80' : Colors.textDisabled }]} />
          <Text style={[styles.onlinePillText, { color: isOnline ? '#4ade80' : Colors.textDisabled }]}>
            {isOnline ? 'Live' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{baby.name}</Text>
        <Text style={styles.cardBed}>Bed {baby.bedNumber}</Text>

        <View style={[styles.alertBadge, { backgroundColor: activityColor[activity] + '22' }]}>
          <Text style={[styles.alertBadgeText, { color: activityColor[activity] }]}>
            {activityLabel[activity] ?? 'Tidak Diketahui'}
          </Text>
        </View>

        {isCrying ? (
          <View style={styles.statItem}>
            <Icon name="emoticon-cry-outline" library="material" size={12} color={Colors.danger} />
            <Text style={[styles.statText, { color: Colors.danger }]}>
              Menangis {`${cryingSec}s`}
            </Text>
          </View>
        ) : null}

        {faceCovered ? (
          <Text style={styles.faceWarning}>⚠ Wajah tertutup</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function NurseDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  
  const [babies, setBabies] = useState<BabyWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // INJEKSI REALTIME: Untuk Summary Bar
  const realtimeStatuses = useAllBabyStatuses();

  const fetchBabies = useCallback(async () => {
    try {
      setError(null);
      const data = await babyService.getBabies();
      setBabies(data as BabyWithStatus[]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Gagal memuat data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBabies();
  }, [fetchBabies]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBabies();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/code-entry');
  };

  if (!user || user.role !== 'caregiver') return null;

  // INJEKSI REALTIME: Menghitung rekapitulasi berdasarkan data real-time jika tersedia
  const { cryingCount, faceAnomalyCount, onlineCount } = useMemo(() => {
    let cry = 0;
    let face = 0;
    let online = 0;

    babies.forEach(baby => {
      const rtStatus = realtimeStatuses[baby.id];
      const isCry = rtStatus ? rtStatus.isCrying : (baby.baby_statuses?.is_crying ?? false);
      const isFace = rtStatus ? rtStatus.faceAnomaly !== 'none' : Boolean(baby.baby_statuses?.face_anomaly && baby.baby_statuses.face_anomaly !== 'none');
      const isOn = rtStatus ? rtStatus.deviceOnline : (baby.devices?.is_online ?? false);

      if (isCry) cry++;
      if (isFace) face++;
      if (isOn) online++;
    });

    return { cryingCount: cry, faceAnomalyCount: face, onlineCount: online };
  }, [babies, realtimeStatuses]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>{user.name}</Text>
        </View>
        
        <View style={styles.headerRight}>
          <MuteToggle />
          
          {cryingCount > 0 || faceAnomalyCount > 0 ? (
            <View style={styles.criticalBadge}>
              <Icon name="alert-circle" library="ionicons" size={14} color={Colors.white} />
              <Text style={styles.criticalBadgeText}>
                {String(cryingCount + faceAnomalyCount)}
              </Text>
            </View>
          ) : null}
          
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsMenuVisible(true)}
          >
            <Icon name="add-circle" library="ionicons" size={30} color={Colors.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleLogout}>
            <Icon name="log-out-outline" library="ionicons" size={24} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{babies.length}</Text>
          <Text style={styles.summaryLabel}>Total Bayi</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.primary }]}>{onlineCount}</Text>
          <Text style={styles.summaryLabel}>Online</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.danger }]}>{cryingCount}</Text>
          <Text style={styles.summaryLabel}>Menangis</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: '#3f384aff' }]}>{faceAnomalyCount}</Text>
          <Text style={styles.summaryLabel}>Anomali</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Memuat data bayi...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Icon name="wifi-off" library="material" size={48} color={Colors.textDisabled} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBabies}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : babies.length === 0 ? (
        <View style={styles.centerBox}>
          <Icon name="baby-face-outline" library="material" size={64} color={Colors.textDisabled} />
          <Text style={styles.emptyTitle}>Belum Ada Bayi</Text>
          <Text style={styles.emptyText}>Tap tombol + untuk mendaftarkan bayi baru</Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            onPress={() => router.push('/(caregiver)/register-baby')}
          >
            <Icon name="add-circle-outline" library="ionicons" size={18} color={Colors.white} />
            <Text style={styles.addFirstBtnText}>Daftarkan Bayi Pertama</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.secondary]}
              tintColor={Colors.secondary}
            />
          }
        >
          {babies.map((baby) => (
            <BabyCard
              key={baby.id}
              baby={baby}
              onPress={() => router.push(`/(caregiver)/baby/${baby.id}`)}
            />
          ))}
        </ScrollView>
      )}

      <Modal visible={isMenuVisible} transparent={true} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownMenu}>
                
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => {
                    setIsMenuVisible(false);
                    router.push('/(caregiver)/register-baby');
                  }}
                >
                  <View style={styles.dropdownIconBox}>
                    <Icon name="person-add-outline" library="ionicons" size={20} color={Colors.secondaryDark} />
                  </View>
                  <View>
                    <Text style={styles.dropdownTitle}>Daftarkan Bayi</Text>
                    <Text style={styles.dropdownDesc}>Tambah profil bayi baru</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.dropdownDivider} />

                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => {
                    setIsMenuVisible(false);
                    router.push('/(caregiver)/device-setup');
                  }}
                >
                  <View style={[styles.dropdownIconBox, { backgroundColor: Colors.primaryLight }]}>
                    <Icon name="hardware-chip-outline" library="ionicons" size={20} color={Colors.primaryDark} />
                  </View>
                  <View>
                    <Text style={styles.dropdownTitle}>Konfigurasi Perangkat</Text>
                    <Text style={styles.dropdownDesc}>Atur kamera baru</Text>
                  </View>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: Fonts.nunitoBold, fontSize: 22, color: Colors.secondaryDark },
  headerSub: { fontFamily: Fonts.interRegular, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  criticalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.danger, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  criticalBadgeText: { fontFamily: Fonts.interSemiBold, fontSize: 12, color: Colors.white },
  addBtn: { padding: 2 },
  summaryBar: { flexDirection: 'row', backgroundColor: Colors.white, paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryNum: { fontFamily: Fonts.nunitoBold, fontSize: 20, color: Colors.textPrimary },
  summaryLabel: { fontFamily: Fonts.interRegular, fontSize: 10, color: Colors.textMuted },
  summaryDivider: { width: 1, height: '80%', backgroundColor: Colors.border, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 16 },
  card: { width: CARD_WIDTH, backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  faceWarning: { fontFamily: Fonts.interSemiBold, fontSize: 10, color: '#7C3AED' },
  cardOffline: { opacity: 0.6 },
  cardThumb: { height: 110, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  nvPill: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  nvText: { fontFamily: Fonts.interMedium, fontSize: 9, color: '#a78bfa' },
  onlinePill: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlinePillText: { fontFamily: Fonts.interMedium, fontSize: 9 },
  cardInfo: { padding: 12, gap: 6 },
  cardName: { fontFamily: Fonts.nunitoBold, fontSize: 14, color: Colors.textPrimary },
  cardBed: { fontFamily: Fonts.interRegular, fontSize: 11, color: Colors.textMuted },
  alertBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  alertBadgeText: { fontFamily: Fonts.interSemiBold, fontSize: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontFamily: Fonts.interMedium, fontSize: 11, color: Colors.textMuted },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText: { fontFamily: Fonts.interRegular, fontSize: 14, color: Colors.textMuted },
  errorText: { fontFamily: Fonts.interRegular, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  retryText: { fontFamily: Fonts.interSemiBold, fontSize: 14, color: Colors.white },
  emptyTitle: { fontFamily: Fonts.nunitoBold, fontSize: 18, color: Colors.textPrimary },
  emptyText: { fontFamily: Fonts.interRegular, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.secondary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  addFirstBtnText: { fontFamily: Fonts.nunitoBold, fontSize: 14, color: Colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  dropdownMenu: { position: 'absolute', top: 70, right: 20, backgroundColor: Colors.white, borderRadius: 14, padding: 8, width: 220, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10 },
  dropdownIconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.secondaryLight, justifyContent: 'center', alignItems: 'center' },
  dropdownTitle: { fontFamily: Fonts.nunitoBold, fontSize: 14, color: Colors.textPrimary },
  dropdownDesc: { fontFamily: Fonts.interRegular, fontSize: 10, color: Colors.textMuted },
  dropdownDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 4, marginHorizontal: 8 },
});
