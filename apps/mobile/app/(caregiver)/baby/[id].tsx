import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Icon } from "../../../components/ui/Icon";
import { Colors } from "../../../constants/colors";
import { Fonts } from "../../../constants/fonts";
import { AlertBanner } from "../../../components/ui/AlertBanner";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { babyService } from "../../../services/baby.service";
import { deviceService } from "../../../services/device.service";
import {
  useBabyContext,
  useBabyStatusById,
  useActiveAlerts,
} from "../../../context/BabyContext";

interface BabyDetail {
  baby_statuses: any;
  id: string;
  name: string;
  bed_number: string;
  date_of_birth: string;
  parent_name: string;
  unique_code: string;
  unit_id: string;
  created_at: string;
  devices?: {
    id: string;
    mac_address: string;
    name: string;
    is_online: boolean;
    last_heartbeat: string | null;
    local_ip: string | null;
    stream_url: string | null;
    crying_min_duration_sec: number;
    notification_cooldown_sec: number;
  } | null;
}

export default function BabyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setFocused, acknowledgeAlert } = useBabyContext();

  const [baby, setBaby] = useState<BabyDetail | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [frameUrls, setFrameUrls] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [activeFrameIndex, setActiveFrameIndex] = useState<0 | 1>(0);
  const [hasFrame, setHasFrame] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [hasStreamError, setHasStreamError] = useState(false);

  const pendingFrameRef = useRef<{ index: 0 | 1; url: string } | null>(null);
  const hasFrameRef = useRef(false);
  const scheduleFrameRef = useRef<((index: 0 | 1) => void) | null>(null);
  const streamRequestIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const realtimeStatus = useBabyStatusById(id ?? "");
  const allAlerts = useActiveAlerts();
  const babyAlerts = allAlerts.filter((a) => a.babyId === id);

  const fetchBaby = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await babyService.getBabyById(id);
      setBaby(data as BabyDetail);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Gagal memuat data",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBaby();
    if (id) setFocused(id);
  }, [id, setFocused, fetchBaby]);

  const deviceId = baby?.devices?.id;

  const resetCameraFrames = useCallback(() => {
    setFrameUrls([null, null]);
    setActiveFrameIndex(0);
    setHasFrame(false);
    hasFrameRef.current = false;
    pendingFrameRef.current = null;
  }, []);

  const fetchStreamUrl = useCallback(async () => {
    const requestId = ++streamRequestIdRef.current;

    setStreamUrl(null);
    resetCameraFrames();
    setHasStreamError(false);

    if (!deviceId) {
      setIsLoadingStream(false);
      return;
    }

    setIsLoadingStream(true);
    try {
      const url = await deviceService.getStreamUrl(deviceId);
      if (requestId === streamRequestIdRef.current) {
        setStreamUrl(url);
      }
    } catch {
      if (requestId === streamRequestIdRef.current) {
        setStreamUrl(null);
        setHasStreamError(true);
      }
    } finally {
      if (requestId === streamRequestIdRef.current) {
        setIsLoadingStream(false);
      }
    }
  }, [deviceId, resetCameraFrames]);

  useEffect(() => {
    void fetchStreamUrl();
    return () => {
      // Ignore any late URL result after the selected baby/device changes.
      streamRequestIdRef.current += 1;
    };
  }, [fetchStreamUrl]);

  const handleFrameLoaded = (index: 0 | 1, url: string | null) => {
    if (!url) return;

    const pending = pendingFrameRef.current;
    if (!pending || pending.index !== index || pending.url !== url) return;

    pendingFrameRef.current = null;
    hasFrameRef.current = true;
    setActiveFrameIndex(index);
    setHasFrame(true);
    setHasStreamError(false);

    const nextIndex: 0 | 1 = index === 0 ? 1 : 0;
    scheduleFrameRef.current?.(nextIndex);
  };

  const handleFrameError = (index: 0 | 1, url: string | null) => {
    if (!url) return;

    const pending = pendingFrameRef.current;
    if (!pending || pending.index !== index || pending.url !== url) return;

    pendingFrameRef.current = null;
    // Keep the last good frame visible if a later frame request fails.
    if (!hasFrameRef.current) {
      setHasStreamError(true);
    }
    // Keep retrying just like the Parents camera screen.
    scheduleFrameRef.current?.(index);
  };

  useEffect(() => {
    if (!streamUrl) {
      resetCameraFrames();
      return;
    }

    const normalizedStreamUrl = streamUrl.endsWith("/")
      ? streamUrl.slice(0, -1)
      : streamUrl;
    const frameEndpoint = `${normalizedStreamUrl}/frame`;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const requestFrame = (index: 0 | 1) => {
      if (cancelled) return;
      const url = `${frameEndpoint}?t=${Date.now()}`;
      pendingFrameRef.current = { index, url };
      setFrameUrls((current) => {
        const next: [string | null, string | null] = [current[0], current[1]];
        next[index] = url;
        return next;
      });
    };

    const scheduleNextFrame = (index: 0 | 1) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => requestFrame(index), 1000);
    };

    scheduleFrameRef.current = scheduleNextFrame;
    setFrameUrls([null, null]);
    setActiveFrameIndex(0);
    setHasFrame(false);
    hasFrameRef.current = false;
    pendingFrameRef.current = null;
    requestFrame(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      pendingFrameRef.current = null;
      if (scheduleFrameRef.current === scheduleNextFrame) {
        scheduleFrameRef.current = null;
      }
    };
  }, [streamUrl, resetCameraFrames]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBaby();
  };

  const handleDeviceConfig = () => {
    router.push({
      pathname: "/(caregiver)/device-config",
      params: { deviceId: baby?.devices?.id, babyName: baby?.name },
    });
  };

  const handleDischarge = () => {
    if (!id) {
      Alert.alert("Gagal", "ID bayi tidak ditemukan.");
      return;
    }

    Alert.alert(
      "Keluarkan Pasien",
      `Yakin ingin mengeluarkan ${baby?.name} dari sistem? Semua relasi perangkat akan diputus.`,
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Keluarkan",
          style: "destructive",
          onPress: async () => {
            try {
              await babyService.dischargeBaby(id);

              Alert.alert(
                "Sukses",
                "Pasien berhasil dikeluarkan dari sistem.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      router.replace("/(caregiver)/dashboard");
                    },
                  },
                ],
              );
            } catch (err: any) {
              console.error(
                "[BabyDetail] Gagal mengeluarkan pasien:",
                err.response?.data || err,
              );

              Alert.alert(
                "Gagal",
                err.response?.data?.error ||
                  "Tidak dapat mengeluarkan pasien saat ini.",
              );
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header backOnly title="Detail Bayi" />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !baby) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header backOnly title="Detail Bayi" />
        <View style={styles.centerBox}>
          <Icon
            name="alert-circle-outline"
            library="ionicons"
            size={48}
            color={Colors.textDisabled}
          />
          <Text style={styles.errorText}>
            {error || "Data tidak ditemukan"}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBaby}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // LOGIKA PEMBONGKAR GEMBOK: Menggunakan data socket sebagai bukti absolut jika DB gagal
  const isDevicePaired = !!baby.devices || !!realtimeStatus;

  // INJEKSI REALTIME: Memaksa UI menggunakan detak jantung dari Socket.io
  const isDeviceOnline =
    realtimeStatus?.deviceOnline ?? baby.devices?.is_online ?? false;

  const isCrying =
    realtimeStatus?.isCrying ?? baby.baby_statuses?.is_crying ?? null;

  const faceAnomaly =
    realtimeStatus?.faceAnomaly ?? baby.baby_statuses?.face_anomaly ?? null;

  // null berarti AI belum memberikan hasil; jangan menyamakannya dengan kondisi normal.
  const faceStatusUnknown = faceAnomaly == null;
  const faceCovered = !faceStatusUnknown && faceAnomaly !== "none";

  const activity =
    realtimeStatus?.activity ?? baby.baby_statuses?.activity ?? null;

  const cryingDurationSec =
    realtimeStatus?.cryingDurationSec ??
    baby.baby_statuses?.crying_duration_sec ??
    null;

  const lastUpdated =
    realtimeStatus?.lastUpdated ?? baby.baby_statuses?.updated_at ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon
            name="arrow-back"
            library="ionicons"
            size={22}
            color={Colors.secondaryDark}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {baby.name}
        </Text>
        <TouchableOpacity
          onPress={handleDeviceConfig}
          style={styles.configBtn}
          disabled={!isDevicePaired}
        >
          <Icon
            name="settings-outline"
            library="ionicons"
            size={22}
            color={isDevicePaired ? Colors.secondaryDark : Colors.textDisabled}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.secondary]}
          />
        }
      >
        {/* Info Box */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <View style={styles.avatarCircle}>
                <Icon
                  name="baby-face-outline"
                  library="material"
                  size={36}
                  color={Colors.secondary}
                />
              </View>
              <View>
                <Text style={styles.infoName}>{baby.name}</Text>
                <Text style={styles.infoBed}>
                  Tempat Tidur {baby.bed_number}
                </Text>
              </View>
            </View>
            <StatusBadge online={isDeviceOnline} />
          </View>
          <View style={styles.infoGrid}>
            <InfoItem
              icon="person-outline"
              label="Orang Tua"
              value={baby.parent_name}
            />
            <InfoItem
              icon="key-outline"
              label="Kode Orang Tua"
              value={baby.unique_code}
              mono
            />
            <InfoItem
              icon="time-outline"
              label="Terdaftar"
              value={new Date(baby.created_at).toLocaleDateString("id-ID")}
            />
          </View>
        </View>

        {babyAlerts.map((a) => (
          <AlertBanner
            key={a.id}
            message={a.message}
            severity={a.severity}
            time={new Date(a.timestamp).toLocaleTimeString("id-ID")}
            onDismiss={async () => {
              try {
                await acknowledgeAlert(a.id);
              } catch {
                Alert.alert(
                  "Gagal",
                  "Alert belum dapat ditandai sebagai sudah ditangani.",
                );
              }
            }}
          />
        ))}

        {!isDevicePaired ? (
          <View style={styles.noPairBox}>
            <Icon
              name="cctv"
              library="material"
              size={48}
              color={Colors.textDisabled}
            />
            <Text style={styles.noPairTitle}>Kamera Belum Terpasang</Text>
            <Text style={styles.noPairText}>
              Bayi ini tidak terikat dengan perangkat kamera manapun.
            </Text>
          </View>
        ) : (
          <>
            {/* Stream memakai polling /frame + double buffering, sama dengan Parents. */}
            <View style={styles.cameraContainer}>
              {streamUrl ? (
                <>
                  {frameUrls[0] ? (
                    <Image
                      key={`caregiver-camera-0-${frameUrls[0]}`}
                      source={{ uri: frameUrls[0] }}
                      style={[
                        styles.cameraImage,
                        { opacity: hasFrame && activeFrameIndex === 0 ? 1 : 0 },
                      ]}
                      resizeMode="contain"
                      fadeDuration={0}
                      onLoad={() => handleFrameLoaded(0, frameUrls[0])}
                      onError={() => handleFrameError(0, frameUrls[0])}
                    />
                  ) : null}

                  {frameUrls[1] ? (
                    <Image
                      key={`caregiver-camera-1-${frameUrls[1]}`}
                      source={{ uri: frameUrls[1] }}
                      style={[
                        styles.cameraImage,
                        { opacity: hasFrame && activeFrameIndex === 1 ? 1 : 0 },
                      ]}
                      resizeMode="contain"
                      fadeDuration={0}
                      onLoad={() => handleFrameLoaded(1, frameUrls[1])}
                      onError={() => handleFrameError(1, frameUrls[1])}
                    />
                  ) : null}

                  {!hasFrame ? (
                    <View style={styles.cameraMessageOverlay}>
                      {hasStreamError ? (
                        <>
                          <Text style={styles.offlineText}>
                            Belum menerima frame kamera
                          </Text>
                          <Text style={styles.offlineSub}>
                            Mencoba kembali secara otomatis...
                          </Text>
                        </>
                      ) : (
                        <>
                          <ActivityIndicator
                            color={Colors.secondary}
                            size="large"
                          />
                          <Text style={styles.waitingText}>
                            Menunggu frame kamera...
                          </Text>
                        </>
                      )}
                      <Text style={styles.offlineText}>
                        Terakhir online:{" "}
                        {baby.devices?.last_heartbeat
                          ? new Date(
                              baby.devices.last_heartbeat,
                            ).toLocaleString("id-ID")
                          : "Belum pernah"}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : isLoadingStream ? (
                <View style={styles.cameraMessageOverlay}>
                  <ActivityIndicator color={Colors.secondary} size="large" />
                  <Text style={styles.waitingText}>
                    Menghubungkan ke kamera...
                  </Text>
                </View>
              ) : hasStreamError ? (
                <View style={styles.cameraMessageOverlay}>
                  <Text style={styles.offlineText}>
                    Gagal menyiapkan stream kamera
                  </Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => void fetchStreamUrl()}
                  >
                    <Text style={styles.retryText}>Coba Lagi</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraMessageOverlay}>
                  <Text style={styles.offlineText}>
                    Stream kamera belum tersedia
                  </Text>
                  <Text style={styles.offlineSub}>
                    Periksa pemasangan dan koneksi perangkat kamera.
                  </Text>
                </View>
              )}

              {hasFrame ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>🔴 LIVE</Text>
                </View>
              ) : null}
            </View>

            {/* Status AI Komprehensif */}
            <View style={styles.aiStatusGrid}>
              <View
                style={[
                  styles.aiCard,
                  isCrying === true ? styles.cryActive : styles.normalCard,
                ]}
              >
                <Icon
                  name={
                    isCrying === true
                      ? "emoticon-cry-outline"
                      : isCrying === false
                        ? "emoticon-happy-outline"
                        : "help-circle-outline"
                  }
                  library="material"
                  size={24}
                  color={isCrying === true ? Colors.danger : Colors.primary}
                />
                <Text style={styles.aiCardLabel}>Suara</Text>
                <Text style={styles.aiCardValue}>
                  {isCrying === null
                    ? "Menunggu data AI"
                    : isCrying
                      ? `Menangis${
                          cryingDurationSec != null
                            ? ` (${cryingDurationSec}s)`
                            : ""
                        }`
                      : "Tenang"}
                </Text>
              </View>

              <View
                style={[
                  styles.aiCard,
                  faceCovered ? styles.anomalyActive : styles.normalCard,
                ]}
              >
                <Icon
                  name={
                    faceStatusUnknown
                      ? "help-circle-outline"
                      : faceCovered
                        ? "eye-off-outline"
                        : "eye-outline"
                  }
                  library="ionicons"
                  size={24}
                  color={
                    faceStatusUnknown
                      ? Colors.textMuted
                      : faceCovered
                        ? Colors.warning
                        : Colors.primary
                  }
                />
                <Text style={styles.aiCardLabel}>Wajah (YOLO)</Text>
                <Text
                  style={[
                    styles.aiCardValue,
                    faceStatusUnknown && { color: Colors.textMuted },
                  ]}
                >
                  {faceStatusUnknown
                    ? "Menunggu data AI"
                    : faceCovered
                      ? "Tertutup!"
                      : "Terlihat"}
                </Text>
              </View>

              <View style={[styles.aiCard, styles.normalCard]}>
                <Icon
                  name="body-outline"
                  library="ionicons"
                  size={24}
                  color={Colors.primary}
                />
                <Text style={styles.aiCardLabel}>Aktivitas</Text>
                <Text style={styles.aiCardValue}>
                  {activity === null
                    ? "Menunggu data AI"
                    : activity === "sleeping"
                      ? "Tidur"
                      : activity === "awake"
                        ? "Bangun"
                        : "Menangis"}
                </Text>
              </View>
            </View>
            <Text style={styles.lastUpdated}>
              Diperbarui:{" "}
              {lastUpdated
                ? new Date(lastUpdated).toLocaleTimeString("id-ID")
                : "Menunggu data AI"}
            </Text>

            <View style={styles.deviceCard}>
              <View style={styles.deviceCardHeader}>
                <Icon
                  name="cctv"
                  library="material"
                  size={18}
                  color={Colors.secondary}
                />
                <Text style={styles.deviceCardTitle}>
                  Kamera: {baby.devices?.name || "Smart Vision Cam"}
                </Text>
              </View>
              <View style={styles.infoGrid}>
                <InfoItem
                  icon="wifi"
                  label="MAC Address"
                  value={baby.devices?.mac_address ?? "Terhubung (Live)"}
                  mono
                />
                <InfoItem
                  icon="mic-outline"
                  label="Cooldown Notifikasi"
                  value={`${baby.devices?.notification_cooldown_sec ?? 60} detik`}
                />
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.reportBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/(caregiver)/baby/report",
                      params: { babyId: baby.id, babyName: baby.name },
                    })
                  }
                >
                  <Icon
                    name="bar-chart-outline"
                    library="ionicons"
                    size={16}
                    color={Colors.primary}
                  />
                  <Text style={styles.reportBtnText}>Laporan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Zona Berbahaya</Text>
          <TouchableOpacity
            style={styles.dischargeBtn}
            onPress={handleDischarge}
          >
            <Icon
              name="exit-outline"
              library="ionicons"
              size={18}
              color={Colors.danger}
            />
            <Text style={styles.dischargeBtnText}>Keluarkan Pasien</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Komponen Pembantu ──────────────────────────────────────────────────
function Header({ backOnly, title }: { backOnly: boolean; title: string }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Icon
          name="arrow-back"
          library="ionicons"
          size={22}
          color={Colors.secondaryDark}
        />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

function InfoItem({
  icon,
  iconLib = "ionicons",
  label,
  value,
  mono = false,
}: any) {
  return (
    <View style={infoStyles.wrapper}>
      <View style={infoStyles.labelRow}>
        <Icon
          name={icon}
          library={iconLib}
          size={13}
          color={Colors.textMuted}
        />
        <Text style={infoStyles.label}>{label}</Text>
      </View>
      <Text
        style={[infoStyles.value, mono && infoStyles.mono]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  wrapper: { gap: 3, width: "45%" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  value: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  mono: {
    fontFamily: Fonts.interMedium,
    letterSpacing: 1,
    color: Colors.secondaryDark,
  },
});

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 18,
    color: Colors.secondaryDark,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  configBtn: { padding: 4 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 32,
  },
  loadingText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  errorText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.white,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  infoName: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  infoBed: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  noPairBox: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  noPairTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  noPairText: {
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
  waitingBox: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  waitingText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  offlineText: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textDisabled,
    textAlign: "center",
  },
  offlineSub: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  cameraContainer: {
    width: "100%",
    height: 220,
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  cameraImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#111827",
  },
  cameraMessageOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 20,
    backgroundColor: "#111827",
  },
  liveBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(226, 75, 74, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  nvBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(99, 102, 241, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nvText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  aiStatusGrid: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  aiCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  normalCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cryActive: {
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  anomalyActive: {
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  aiCardLabel: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  aiCardValue: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  lastUpdated: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textDisabled,
    textAlign: "center",
    marginTop: -6,
  },
  deviceCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    elevation: 2,
  },
  deviceCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  deviceCardTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reportBtnText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  dangerCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.dangerLight,
  },
  dangerTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.danger,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dischargeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  dischargeBtnText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.danger,
  },
});
