import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../../stores/auth.store';
import { useBabyContext } from '../../context/BabyContext';
import { api } from '../../services/api';

const { width } = Dimensions.get('window');

export default function CameraScreen() {
  const user = useAuthStore((s) => s.user);
  const { state } = useBabyContext();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);

  const babyId = user?.role === 'parent' ? user.babyId : null;
  const focusedStatus = babyId ? state.statuses[babyId] : null;
  const isDeviceOnline = true;
  const nightVision = focusedStatus?.nightVisionActive ?? false;

  useEffect(() => {
    fetchStreamUrlBypass();
  }, []);

  const fetchStreamUrlBypass = async () => {
    setIsLoading(true);
    setHasError(false);
    
    const esp32LocalUrl = 'http://10.76.65.127/stream'; 
    
    setTimeout(() => {
      setStreamUrl(esp32LocalUrl);
      setIsLoading(false);
    }, 500);
  };

  if (!babyId) return null;

  const videoHeight = isFullscreen ? width * 1.1 : width * 0.75;

  const currentActivityLabel = () => {
    if (!isDeviceOnline || !focusedStatus) return '—';
    if (focusedStatus.activity === 'sleeping') return 'Tidur';
    if (focusedStatus.activity === 'awake') return 'Bangun';
    if (focusedStatus.activity === 'crying') return 'Menangis';
    return '—';
  };

  const isFaceLost = focusedStatus?.faceAnomaly === 'face_covered';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Kamera</Text>
        <View style={styles.badges}>
          {nightVision && (
            <View style={styles.nightBadge}>
              <Text style={styles.nightText}>Night Vision</Text>
            </View>
          )}
          <View style={[
            styles.onlineBadge,
            { backgroundColor: isDeviceOnline ? '#052e16' : '#1f0a0a' },
          ]}>
            <View style={[
              styles.onlineDot,
              { backgroundColor: isDeviceOnline ? '#4ade80' : '#f87171' },
            ]} />
            <Text style={[
              styles.onlineText,
              { color: isDeviceOnline ? '#4ade80' : '#f87171' },
            ]}>
              {isDeviceOnline ? 'Live' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      {/* Video Area */}
      <View style={[styles.videoWrapper, { height: videoHeight }]}>
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#1D9E75" size="large" />
            <Text style={styles.centerText}>Menghubungkan ke kamera...</Text>
          </View>
        ) : !streamUrl || !isDeviceOnline ? (
          <View style={styles.centerBox}>
            <Svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M1 1l22 22M21 16V8a2 2 0 0 0-2-2h-3.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 10.93 3H8.58" />
              <Path d="M7.2 7.2A2 2 0 0 0 5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 1.41-.59" />
              <Path d="M16 16a4 4 0 1 1-5.3-5.3" />
              <Path d="M23 7l-7 5 7 5V7z" />
            </Svg>
            <Text style={styles.offlineText}>
              {!streamUrl ? 'Kamera belum dikonfigurasi' : 'Perangkat offline'}
            </Text>
            <Text style={styles.offlineSub}>
              {!streamUrl
                ? 'Hubungi tenaga medis untuk scan QR perangkat'
                : 'Pastikan Smart Vision menyala dan terhubung WiFi'}
            </Text>
          </View>
        ) : hasError ? (
          <View style={styles.centerBox}>
            <Svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF9F27" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
            </Svg>
            <Text style={styles.offlineText}>Gagal memuat stream</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setStreamUrl(babyId)}
            >
              <Text style={styles.retryText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: streamUrl }}
            style={styles.webview}
            scrollEnabled={false}
            bounces={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onError={() => setHasError(true)}
            onHttpError={() => setHasError(true)}
            renderLoading={() => (
              <View style={styles.centerBox}>
                <ActivityIndicator color="#1D9E75" />
              </View>
            )}
            startInLoadingState
          />
        )}

        {/* Fullscreen toggle */}
        <TouchableOpacity
          style={styles.fullscreenBtn}
          onPress={() => setIsFullscreen(!isFullscreen)}
        >
          <Text style={styles.fullscreenIcon}>
            {isFullscreen ? '⊠' : '⊡'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Panel Kontrol */}
      <View style={styles.infoPanel}>
        
        {/* Hanya Menyisakan 2 Parameter Utama */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Aktivitas bayi</Text>
            <Text style={styles.infoValue}>{currentActivityLabel()}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Wajah bayi</Text>
            <Text style={[
              styles.infoValue,
              { color: !isDeviceOnline ? '#fff' : isFaceLost ? '#E24B4A' : '#1D9E75' }
            ]}>
              {!isDeviceOnline || !focusedStatus
                ? '—' 
                : isFaceLost 
                ? 'Tidak Terdeteksi' 
                : 'Terdeteksi'
              }
            </Text>
          </View>
        </View>

        {/* Card Bar Chart Akumulasi Distribusi */}
        <View style={styles.chartCard}>
          <View style={styles.progressGroup}>
            <Text style={[styles.progressLabel, { color: '#4ade80' }]}>60% <Text style={styles.labelSub}>Tidur</Text></Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: '60%', backgroundColor: '#1D9E75' }]} />
            </View>
          </View>

          <View style={styles.progressGroup}>
            <Text style={[styles.progressLabel, { color: '#f59e0b' }]}>35% <Text style={styles.labelSub}>Bangun</Text></Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: '35%', backgroundColor: '#EF9F27' }]} />
            </View>
          </View>

          <View style={styles.progressGroup}>
            <Text style={[styles.progressLabel, { color: '#ef4444' }]}>5% <Text style={styles.labelSub}>Menangis</Text></Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: '5%', backgroundColor: '#E24B4A' }]} />
            </View>
          </View>

          <Text style={styles.streamNote}>
            Video stream langsung dari perangkat · Tidak ada overlay deteksi
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#111',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  badges: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nightBadge: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nightText: { fontSize: 11, color: '#a78bfa', fontWeight: '600' },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontSize: 11, fontWeight: '600' },
  videoWrapper: {
    width,
    backgroundColor: '#000',
    position: 'relative',
  },
  webview: { flex: 1, backgroundColor: '#000' },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#000',
  },
  centerText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  offlineText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600', marginTop: 8 },
  offlineSub: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  fullscreenBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 8,
  },
  fullscreenIcon: { fontSize: 20, color: '#fff' },
  infoPanel: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  infoItem: { alignItems: 'center', gap: 6, flex: 1 },
  infoLabel: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#fff', fontWeight: '700', textAlign: 'center' },
  chartCard: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginTop: 4,
  },
  progressGroup: {
    gap: 6,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelSub: {
    color: '#9CA3AF',
    fontWeight: '500',
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#222',
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  streamNote: {
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
});