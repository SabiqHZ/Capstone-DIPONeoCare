import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  Modal,
  Pressable,
  StatusBar,
} from "react-native";
import { LoadingLogo } from "../../../components/ui/LoadingLogo";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Icon } from "../../../components/ui/Icon";
import { Colors } from "../../../constants/colors";
import { Fonts, Typography } from "../../../constants/fonts";
import { Radii, Spacing } from "../../../constants/ui";
import { AlertBanner } from "../../../components/ui/AlertBanner";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SuccessModal } from "../../../components/ui/SuccessModal";
import { babyService } from "../../../services/baby.service";
import { deviceService } from "../../../services/device.service";
import {
  useBabyContext,
  useBabyStatusById,
  useActiveAlerts,
  isBabyDetectionExpired,
} from "../../../context/BabyContext";
import { useTheme } from "../../../context/ThemeContext";
import React from "react";

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
  const { isDark } = useTheme();

  const [baby, setBaby] = useState<BabyDetail | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [cameraDisplayName, setCameraDisplayName] = useState("Kamera");
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [isDischargeConfirmVisible, setIsDischargeConfirmVisible] =
    useState(false);
  const [isDischarging, setIsDischarging] = useState(false);
  const [isCopySuccessVisible, setIsCopySuccessVisible] = useState(false);
  const [isDevicePickerOpen, setIsDevicePickerOpen] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<
    Array<{
      id: string;
      name: string | null;
      mac_address: string;
      is_online: boolean;
    }>
  >([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);

  const realtimeStatus = useBabyStatusById(id ?? "");
  const allAlerts = useActiveAlerts();
  const babyAlerts = allAlerts.filter((a) => a.babyId === id);

  const fetchBaby = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await babyService.getBabyById(id);
      setBaby(data as BabyDetail);
    } catch {
      setError(
        "Tidak dapat memuat informasi bayi. Periksa koneksi lalu coba lagi.",
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

  useEffect(() => {
    if (!id) return;
    const refreshId = setInterval(() => {
      void fetchBaby();
      void setFocused(id);
    }, 15000);
    return () => clearInterval(refreshId);
  }, [id, fetchBaby, setFocused]);

  const deviceId = baby?.devices?.id;

  useEffect(() => {
    let cancelled = false;
    const fallbackName = baby?.devices?.name?.trim() || "Kamera";

    if (!deviceId) {
      setCameraDisplayName("Kamera");
      return;
    }

    setCameraDisplayName(fallbackName);
    void deviceService
      .getManagedDevices()
      .then((devices) => {
        const cameraIndex = devices.findIndex(
          (device) => device.id === deviceId,
        );
        if (!cancelled && cameraIndex >= 0) {
          setCameraDisplayName(
            `cam-${String(cameraIndex + 1).padStart(2, "0")}`,
          );
        }
      })
      .catch(() => {
        // Keep the camera's existing name if its position cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, [deviceId, baby?.devices?.name]);

  const openDevicePicker = async () => {
    setIsDevicePickerOpen((open) => !open);
    if (isDevicePickerOpen) return;
    setIsLoadingDevices(true);
    try {
      setAvailableDevices(await babyService.getAvailableDevices());
    } catch {
      Alert.alert("Gagal memuat kamera", "Periksa koneksi lalu coba lagi.");
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handlePairCamera = async (availableDeviceId: string) => {
    if (!baby) return;
    setPairingDeviceId(availableDeviceId);
    try {
      await babyService.pairDevice(baby.id, availableDeviceId);
      setIsDevicePickerOpen(false);
      await fetchBaby();
      Alert.alert(
        "Kamera terpasang",
        "Kamera berhasil dipasangkan dengan bayi.",
      );
    } catch {
      Alert.alert(
        "Gagal memasang kamera",
        "Kamera mungkin sudah terpasang pada bayi lain. Muat ulang daftar kamera.",
      );
    } finally {
      setPairingDeviceId(null);
    }
  };

  const handleUnpairCamera = () => {
    if (!baby?.devices?.id) return;
    Alert.alert("Lepas kamera?", `Kamera akan dilepas dari ${baby.name}.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Lepas kamera",
        style: "destructive",
        onPress: async () => {
          setPairingDeviceId("unpair");
          try {
            await babyService.unpairDevice(baby.id, baby.devices!.id);
            setIsDevicePickerOpen(false);
            await fetchBaby();
            Alert.alert("Kamera dilepas", "Kamera berhasil dilepas dari bayi.");
          } catch {
            Alert.alert("Gagal melepas kamera", "Coba lagi beberapa saat.");
          } finally {
            setPairingDeviceId(null);
          }
        },
      },
    ]);
  };

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

  const openBabyReport = () => {
    if (!baby) return;
    router.push({
      pathname: "/(caregiver)/baby/report",
      params: { babyId: baby.id, babyName: baby.name },
    });
  };

  const handleDischarge = () => {
    if (!id) {
      Alert.alert("Gagal", "Informasi bayi tidak ditemukan.");
      return;
    }

    setIsDischargeConfirmVisible(true);
  };

  const confirmDischarge = async () => {
    if (!id) return;

    setIsDischarging(true);
    try {
      await babyService.dischargeBaby(id);
      setIsDischargeConfirmVisible(false);
      Alert.alert("Sukses", "Bayi berhasil dikeluarkan dari sistem.", [
        {
          text: "Baik",
          onPress: () => router.replace("/(caregiver)/dashboard"),
        },
      ]);
    } catch (err: any) {
      console.error(
        "[BabyDetail] Gagal mengeluarkan bayi:",
        err.response?.data || err,
      );
      setIsDischargeConfirmVisible(false);
      Alert.alert(
        "Gagal",
        "Tidak dapat mengeluarkan bayi saat ini. Coba lagi.",
      );
    } finally {
      setIsDischarging(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, isDark && darkStyles.safe]}>
        <Header backOnly title="Detail Bayi" isDark={isDark} />
        <View style={styles.centerBox}>
          <LoadingLogo size="large" color={Colors.secondary} />
          <Text style={[styles.loadingText, isDark && darkStyles.mutedText]}>
            Memuat data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !baby) {
    return (
      <SafeAreaView style={[styles.safe, isDark && darkStyles.safe]}>
        <Header backOnly title="Detail Bayi" isDark={isDark} />
        <View style={styles.centerBox}>
          <Icon
            name="alert-circle-outline"
            library="ionicons"
            size={48}
            color={Colors.textDisabled}
          />
          <Text style={[styles.errorText, isDark && darkStyles.bodyText]}>
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

  const detectionExpired = Boolean(
    realtimeStatus?.isDetectionStale ||
    isBabyDetectionExpired(
      realtimeStatus?.lastUpdated ?? baby.baby_statuses?.updated_at,
    ),
  );

  const activity = detectionExpired
    ? null
    : (realtimeStatus?.activity ?? baby.baby_statuses?.activity ?? null);

  // Gunakan satu status klasifikasi yang sama untuk seluruh kartu di detail bayi.
  const noBabyDetected = detectionExpired || activity == null;
  const isCrying = noBabyDetected
    ? null
    : (realtimeStatus?.isCrying ?? baby.baby_statuses?.is_crying ?? null);

  const faceAnomaly = noBabyDetected
    ? null
    : (realtimeStatus?.faceAnomaly ?? baby.baby_statuses?.face_anomaly ?? null);

  const faceCovered =
    !noBabyDetected && faceAnomaly != null && faceAnomaly !== "none";
  const faceStatusUnknown =
    !faceCovered && (noBabyDetected || faceAnomaly == null);

  const cryingDurationSec = noBabyDetected
    ? null
    : (realtimeStatus?.cryingDurationSec ??
      baby.baby_statuses?.crying_duration_sec ??
      null);

  const lastUpdated =
    realtimeStatus?.lastUpdated ?? baby.baby_statuses?.updated_at ?? null;

  const renderCameraStream = () => (
    <>
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
                <Text
                  style={[styles.offlineSub, isDark && darkStyles.bodyText]}
                >
                  Mencoba kembali secara otomatis...
                </Text>
              ) : (
                <>
                  <LoadingLogo color={Colors.secondary} size="large" />
                  <Text
                    style={[styles.waitingText, isDark && darkStyles.bodyText]}
                  >
                    Memuat gambar kamera...
                  </Text>
                </>
              )}
              <Text style={[styles.offlineText, isDark && darkStyles.bodyText]}>
                Pembaruan terakhir perangkat:{" "}
                {baby.devices?.last_heartbeat
                  ? new Date(baby.devices.last_heartbeat).toLocaleString(
                      "id-ID",
                    )
                  : "Belum pernah"}
              </Text>
            </View>
          ) : null}
        </>
      ) : isLoadingStream ? (
        <View style={styles.cameraMessageOverlay}>
          <LoadingLogo color={Colors.secondary} size="large" />
          <Text style={[styles.waitingText, isDark && darkStyles.bodyText]}>
            Menghubungkan ke kamera...
          </Text>
        </View>
      ) : hasStreamError ? (
        <View style={styles.cameraMessageOverlay}>
          <Text style={[styles.offlineText, isDark && darkStyles.bodyText]}>
            Gagal menyiapkan tampilan kamera langsung
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
          <Text style={[styles.offlineText, isDark && darkStyles.bodyText]}>
            Tampilan kamera langsung belum tersedia
          </Text>
          <Text style={[styles.offlineSub, isDark && darkStyles.bodyText]}>
            Periksa pemasangan dan koneksi perangkat kamera.
          </Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.safe, isDark && darkStyles.safe]}>
      <View style={[styles.header, isDark && darkStyles.surface]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          accessibilityHint="Kembali ke daftar bayi"
        >
          <Icon
            name="arrow-back"
            library="ionicons"
            size={22}
            color={isDark ? "#BFDBFE" : Colors.secondaryDark}
          />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, isDark && darkStyles.heading]}
          numberOfLines={1}
        >
          {baby.name}
        </Text>
        <TouchableOpacity
          onPress={handleDeviceConfig}
          style={styles.configBtn}
          disabled={!isDevicePaired}
          accessibilityRole="button"
          accessibilityLabel="Konfigurasi kamera"
          accessibilityHint="Membuka pengaturan kamera bayi"
        >
          <Icon
            name="settings-outline"
            library="ionicons"
            size={22}
            color={
              isDevicePaired
                ? isDark
                  ? "#BFDBFE"
                  : Colors.secondaryDark
                : Colors.textDisabled
            }
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isDark && darkStyles.page]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor="transparent"
            progressBackgroundColor="transparent"
            onRefresh={handleRefresh}
            colors={["transparent"]}
          />
        }
      >
        {isRefreshing ? (
          <LoadingLogo size={36} style={{ position: "absolute", top: 10, alignSelf: "center", zIndex: 20 }} />
        ) : null}
        {/* Info Box */}
        <View style={[styles.infoCard, isDark && darkStyles.surface]}>
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
                <Text style={[styles.infoName, isDark && darkStyles.heading]}>
                  {baby.name}
                </Text>
                <Text style={[styles.infoBed, isDark && darkStyles.mutedText]}>
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
              isDark={isDark}
            />
            <InfoItem
              icon="calendar-outline"
              label="Tanggal Lahir"
              value={new Date(
                `${baby.date_of_birth}T00:00:00`,
              ).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              isDark={isDark}
            />
            <InfoItem
              icon="key-outline"
              label="Kode Orang Tua"
              value={baby.unique_code}
              mono
              onPress={async () => {
                if (!baby.unique_code) return;
                await Clipboard.setStringAsync(baby.unique_code);
                setIsCopySuccessVisible(true);
              }}
              accessibilityLabel={`Kode orang tua ${baby.unique_code}`}
              accessibilityHint="Ketuk untuk menyalin kode orang tua"
              isDark={isDark}
            />
            <InfoItem
              icon="time-outline"
              label="Terdaftar"
              value={new Date(baby.created_at).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              isDark={isDark}
            />
          </View>
          <TouchableOpacity
            style={[styles.editBabyButton, isDark && darkStyles.softAction]}
            onPress={() =>
              router.push({
                pathname: "/(caregiver)/baby-edit",
                params: { babyId: baby.id },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Edit informasi bayi"
          >
            <Icon
              name="create-outline"
              library="ionicons"
              size={17}
              color={isDark ? "#BFDBFE" : Colors.secondaryDark}
            />
            <Text
              style={[styles.copyParentCodeText, isDark && darkStyles.linkText]}
            >
              Edit informasi bayi
            </Text>
          </TouchableOpacity>
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
                  "Peringatan belum dapat ditandai sebagai sudah ditangani.",
                );
              }
            }}
          />
        ))}

        {!isDevicePaired ? (
          <View style={[styles.noPairBox, isDark && darkStyles.surface]}>
            <Icon
              name="cctv"
              library="material"
              size={48}
              color={Colors.textDisabled}
            />
            <Text style={[styles.noPairTitle, isDark && darkStyles.heading]}>
              Kamera Belum Terpasang
            </Text>
            <Text style={[styles.noPairText, isDark && darkStyles.bodyText]}>
              Bayi ini tidak terikat dengan perangkat kamera manapun.
            </Text>
          </View>
        ) : (
          <>
            {/* Keep frame polling and display logic unchanged between regular and full screen. */}
            {!isFullscreen ? (
              <View style={styles.cameraContainer}>
                {renderCameraStream()}
                {hasFrame ? (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveText}> LANGSUNG</Text>
                  </View>
                ) : null}
                <Text
                  style={styles.cameraNameBadge}
                  numberOfLines={1}
                  accessibilityLabel={`Nama kamera ${cameraDisplayName}`}
                >
                  {cameraDisplayName}
                </Text>
                <TouchableOpacity
                  style={styles.fullscreenButton}
                  onPress={() => setIsFullscreen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Buka kamera layar penuh"
                  accessibilityHint="Menampilkan kamera memenuhi layar"
                >
                  <Icon
                    name="expand-outline"
                    library="ionicons"
                    size={19}
                    color={Colors.white}
                  />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Status AI Komprehensif */}
            <View style={styles.aiStatusGrid}>
              <TouchableOpacity
                style={[
                  styles.aiCard,
                  isCrying === true ? styles.cryActive : styles.normalCard,
                  isDark &&
                    (isCrying === true
                      ? darkStyles.criticalCard
                      : darkStyles.aiCard),
                ]}
                onPress={openBabyReport}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Buka laporan suara bayi"
                accessibilityHint="Membuka laporan harian bayi ini"
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
                  color={isCrying === true ? Colors.critical : Colors.success}
                />
                <Text
                  style={[styles.aiCardLabel, isDark && darkStyles.mutedText]}
                >
                  Suara
                </Text>
                <Text
                  style={[styles.aiCardValue, isDark && darkStyles.heading]}
                >
                  {isCrying === null
                    ? "Tidak terdeteksi"
                    : isCrying
                      ? `Menangis${
                          cryingDurationSec != null
                            ? ` (${cryingDurationSec}s)`
                            : ""
                        }`
                      : "Tenang"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.aiCard,
                  faceCovered ? styles.anomalyActive : styles.normalCard,
                  isDark &&
                    (faceCovered ? darkStyles.criticalCard : darkStyles.aiCard),
                ]}
                onPress={openBabyReport}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Buka laporan kondisi wajah bayi"
                accessibilityHint="Membuka laporan harian bayi ini"
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
                      ? Colors.neutral
                      : faceCovered
                        ? Colors.critical
                        : Colors.success
                  }
                />
                <Text
                  style={[styles.aiCardLabel, isDark && darkStyles.mutedText]}
                >
                  Kondisi wajah
                </Text>
                <Text
                  style={[
                    styles.aiCardValue,
                    isDark && darkStyles.heading,
                    faceStatusUnknown && { color: Colors.neutral },
                    faceCovered && { color: Colors.critical },
                  ]}
                >
                  {faceStatusUnknown
                    ? noBabyDetected
                      ? "Tidak terdeteksi"
                      : "Menunggu hasil pemantauan"
                    : faceCovered
                      ? "Tertutupi!"
                      : "Terlihat"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.aiCard,
                  styles.normalCard,
                  isDark && darkStyles.aiCard,
                ]}
                onPress={openBabyReport}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Buka laporan aktivitas bayi"
                accessibilityHint="Membuka laporan harian bayi ini"
              >
                <Icon
                  name="body-outline"
                  library="ionicons"
                  size={24}
                  color={Colors.success}
                />
                <Text
                  style={[styles.aiCardLabel, isDark && darkStyles.mutedText]}
                >
                  Aktivitas
                </Text>
                <Text
                  style={[styles.aiCardValue, isDark && darkStyles.heading]}
                >
                  {activity === null
                    ? "Tidak terdeteksi"
                    : activity === "sleeping"
                      ? "Tidur"
                      : activity === "awake"
                        ? "Bangun"
                        : "Menangis"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.lastUpdated, isDark && darkStyles.mutedText]}>
              {detectionExpired
                ? "Tidak terdeteksi · terakhir diperbarui "
                : "Diperbarui: "}
              {lastUpdated
                ? new Date(lastUpdated).toLocaleTimeString("id-ID")
                : "Menunggu hasil pemantauan"}
            </Text>

            {!baby.devices ? (
              <View style={[styles.deviceCard, isDark && darkStyles.surface]}>
                <View style={styles.deviceCardHeader}>
                  <Icon
                    name="cctv"
                    library="material"
                    size={18}
                    color={Colors.secondary}
                  />
                  <Text
                    style={[styles.deviceCardTitle, isDark && darkStyles.heading]}
                  >
                    Kamera belum terpasang
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.installCameraBtn,
                    isDark && darkStyles.softAction,
                  ]}
                  onPress={() => void openDevicePicker()}
                  accessibilityRole="button"
                  accessibilityLabel="Pasang kamera"
                >
                  <Icon
                    name="add-circle-outline"
                    library="ionicons"
                    size={16}
                    color={Colors.secondary}
                  />
                  <Text
                    style={[
                      styles.installCameraBtnText,
                      isDark && darkStyles.linkText,
                    ]}
                  >
                    Pasang kamera
                  </Text>
                </TouchableOpacity>
                {isDevicePickerOpen ? (
                  <View
                    style={[
                      styles.cameraDropdown,
                      isDark && darkStyles.surfaceAlt,
                    ]}
                  >
                    {isLoadingDevices ? (
                      <LoadingLogo color={Colors.secondary} />
                    ) : availableDevices.length ? (
                      availableDevices.map((availableDevice) => (
                        <TouchableOpacity
                          key={availableDevice.id}
                          style={[
                            styles.cameraDropdownOption,
                            isDark && darkStyles.surfaceAlt,
                          ]}
                          onPress={() =>
                            void handlePairCamera(availableDevice.id)
                          }
                          disabled={pairingDeviceId !== null}
                          accessibilityRole="button"
                          accessibilityLabel={`Pasang ${availableDevice.name || "kamera"}`}
                        >
                          <Text
                            style={[
                              styles.reportBtnText,
                              isDark && darkStyles.linkText,
                            ]}
                          >
                            {availableDevice.name || "Kamera"}
                            {availableDevice.is_online
                              ? " · Aktif"
                              : " · Tidak aktif"}
                          </Text>
                          {pairingDeviceId === availableDevice.id ? (
                            <LoadingLogo
                              size="small"
                              color={Colors.secondary}
                            />
                          ) : null}
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text
                        style={[
                          styles.lastUpdated,
                          isDark && darkStyles.mutedText,
                        ]}
                      >
                        Tidak ada kamera tersedia.
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
        <View style={[styles.cameraActionsCard, isDark && darkStyles.surface]}>
          <TouchableOpacity
            style={[
              styles.cameraActionButton,
              styles.primaryCameraAction,
              isDark && darkStyles.softAction,
            ]}
            onPress={() =>
              router.push({
                pathname: "/(caregiver)/baby/report",
                params: { babyId: baby.id, babyName: baby.name },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Buka laporan bayi"
          >
            <Icon
              name="bar-chart-outline"
              library="ionicons"
              size={17}
              color={Colors.success}
            />
            <Text
              style={[styles.cameraActionText, isDark && darkStyles.linkText]}
            >
              Laporan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.cameraActionButton,
              styles.secondaryCameraAction,
              isDark && darkStyles.dangerAction,
              (!baby.devices || pairingDeviceId !== null) && [
                styles.disabledCameraAction,
                isDark && darkStyles.disabledAction,
              ],
            ]}
            onPress={handleUnpairCamera}
            disabled={!baby.devices || pairingDeviceId !== null}
            accessibilityRole="button"
            accessibilityLabel="Lepas kamera dari bayi"
            accessibilityHint="Lepaskan kamera yang terpasang pada bayi ini"
          >
            {pairingDeviceId === "unpair" ? (
              <LoadingLogo size="small" color={Colors.critical} />
            ) : null}
            <Text
              style={[
                styles.cameraActionText,
                styles.criticalActionText,
                !baby.devices && styles.disabledCameraActionText,
              ]}
            >
              Lepas kamera
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.dischargeIconButton,
              isDark && darkStyles.dangerAction,
            ]}
            onPress={handleDischarge}
            accessibilityRole="button"
            accessibilityLabel="Keluarkan bayi dari sistem"
            accessibilityHint="Membuka konfirmasi untuk mengeluarkan bayi"
          >
            <Icon
              name="exit-outline"
              library="ionicons"
              size={20}
              color={Colors.critical}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <StatusBar hidden={isFullscreen} />
      <Modal
        visible={isFullscreen && isDevicePaired}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenRoot}>
          <View style={styles.fullscreenCameraContainer}>
            {renderCameraStream()}
            {hasFrame ? (
              <View style={styles.liveBadge}>
                <Text style={styles.liveText}>LANGSUNG</Text>
              </View>
            ) : null}
            <Text style={styles.fullscreenCameraName} numberOfLines={1}>
              {cameraDisplayName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.fullscreenExitButton}
            onPress={() => setIsFullscreen(false)}
            accessibilityRole="button"
            accessibilityLabel="Keluar dari layar penuh"
            accessibilityHint="Kembali ke detail bayi"
          >
            <Icon
              name="contract-outline"
              library="ionicons"
              size={22}
              color={Colors.white}
            />
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal
        visible={isDischargeConfirmVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isDischarging) setIsDischargeConfirmVisible(false);
        }}
      >
        <View style={styles.confirmOverlay}>
          <BlurView
            intensity={45}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.confirmScrim]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup konfirmasi"
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isDischarging) setIsDischargeConfirmVisible(false);
            }}
          />
          <View
            style={[styles.confirmCard, isDark && darkStyles.surface]}
            accessibilityViewIsModal
            accessibilityLabel="Konfirmasi keluarkan bayi"
          >
            <View style={styles.confirmIcon}>
              <Icon
                name="log-out-outline"
                library="ionicons"
                size={28}
                color={Colors.critical}
              />
            </View>
            <Text style={[styles.confirmTitle, isDark && darkStyles.heading]}>
              Keluarkan Bayi
            </Text>
            <Text
              style={[styles.confirmMessage, isDark && darkStyles.bodyText]}
            >
              Yakin ingin mengeluarkan {baby?.name} dari sistem? Kamera yang
              terhubung akan dilepas dari bayi ini.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[
                  styles.confirmCancelButton,
                  isDark && darkStyles.cancelButton,
                ]}
                onPress={() => setIsDischargeConfirmVisible(false)}
                disabled={isDischarging}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.confirmCancelText,
                    isDark && darkStyles.bodyText,
                  ]}
                >
                  Batal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDischargeButton}
                onPress={() => void confirmDischarge()}
                disabled={isDischarging}
                accessibilityRole="button"
              >
                {isDischarging ? (
                  <LoadingLogo size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmDischargeText}>Keluarkan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <SuccessModal
        visible={isCopySuccessVisible}
        title="Kode disalin"
        message="Kode akses orang tua berhasil disalin."
        buttonLabel="Tutup"
        onClose={() => setIsCopySuccessVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Komponen Pembantu ──────────────────────────────────────────────────
function Header({
  backOnly,
  title,
  isDark = false,
}: {
  backOnly: boolean;
  title: string;
  isDark?: boolean;
}) {
  const router = useRouter();
  return (
    <View style={[styles.header, isDark && darkStyles.surface]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        accessibilityHint="Kembali ke halaman sebelumnya"
      >
        <Icon
          name="arrow-back"
          library="ionicons"
          size={22}
          color={isDark ? "#BFDBFE" : Colors.secondaryDark}
        />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, isDark && darkStyles.heading]}>
        {title}
      </Text>
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
  onPress,
  accessibilityLabel,
  accessibilityHint,
  isDark = false,
}: {
  icon: string;
  iconLib?: "ionicons" | "material" | "feather";
  label: string;
  value: string;
  mono?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  isDark?: boolean;
}) {
  const content = (
    <>
      <View style={infoStyles.labelRow}>
        <Icon
          name={icon}
          library={iconLib}
          size={13}
          color={isDark ? "#9CA3AF" : Colors.textMuted}
        />
        <Text
          style={[infoStyles.label, isDark && darkStyles.mutedText]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          infoStyles.value,
          mono && infoStyles.mono,
          isDark && (mono ? darkStyles.linkText : darkStyles.heading),
        ]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={infoStyles.wrapper}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={infoStyles.wrapper}>{content}</View>;
}

const infoStyles = StyleSheet.create({
  wrapper: { gap: 3, width: "46%", minWidth: 0 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
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
const darkStyles = StyleSheet.create({
  safe: { backgroundColor: "#111827" },
  page: { backgroundColor: "#111827" },
  surface: { backgroundColor: "#1F2937", borderColor: "#374151" },
  surfaceAlt: { backgroundColor: "#111827", borderColor: "#374151" },
  heading: { color: "#F9FAFB" },
  bodyText: { color: "#D1D5DB" },
  mutedText: { color: "#9CA3AF" },
  linkText: { color: "#BFDBFE" },
  softAction: { backgroundColor: "#263548", borderColor: "#374151" },
  dangerAction: { backgroundColor: "#3B2025", borderColor: "#7F1D1D" },
  disabledAction: { backgroundColor: "#1F2937", borderColor: "#374151" },
  aiCard: { backgroundColor: "#1F2937", borderColor: "#374151" },
  criticalCard: { backgroundColor: "#3B2025", borderColor: "#7F1D1D" },
  cancelButton: { borderColor: "#4B5563" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  confirmOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmScrim: {
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.criticalLight,
  },
  confirmTitle: {
    fontFamily: Fonts.interRegular,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  confirmMessage: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: "center",
  },
  confirmActions: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  confirmDischargeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.critical,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDischargeText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.white,
  },
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
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.secondaryDark,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  configBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
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
    minHeight: 44,
    justifyContent: "center",
    borderRadius: Radii.control,
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
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
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
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  infoBed: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  copyParentCodeButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.secondaryLight,
    backgroundColor: Colors.secondaryLight,
  },
  editBabyButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.secondaryLight,
    backgroundColor: Colors.secondaryLight,
  },
  copyParentCodeText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.secondaryDark,
  },
  noPairBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  noPairTitle: {
    ...Typography.h3,
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
    borderRadius: Radii.card,
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
    aspectRatio: 4 / 3,
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  fullscreenRoot: { flex: 1, backgroundColor: "#000" },
  fullscreenCameraContainer: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
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
  cameraNameBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    maxWidth: "48%",
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: "rgba(17, 24, 39, 0.72)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    color: Colors.white,
    fontFamily: Fonts.interMedium,
    fontSize: 11,
  },
  fullscreenCameraName: {
    position: "absolute",
    top: 44,
    right: 18,
    maxWidth: "48%",
    overflow: "hidden",
    borderRadius: 7,
    backgroundColor: "rgba(17, 24, 39, 0.72)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: Colors.white,
    fontFamily: Fonts.interMedium,
    fontSize: 13,
  },
  fullscreenButton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(17, 24, 39, 0.76)",
  },
  fullscreenExitButton: {
    position: "absolute",
    top: 42,
    left: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(17, 24, 39, 0.76)",
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
    backgroundColor: Colors.criticalLight,
    borderWidth: 1,
    borderColor: Colors.critical,
  },
  anomalyActive: {
    backgroundColor: Colors.criticalLight,
    borderWidth: 1,
    borderColor: Colors.critical,
  },
  aiCardLabel: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  aiCardValue: {
    fontFamily: Fonts.interMedium,
    fontSize: 9,
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
  cameraActionsCard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: Colors.white,
    elevation: 2,
  },
  cameraActionButton: {
    flex: 2,
    minWidth: 0,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 10,
  },
  primaryCameraAction: {
    borderColor: Colors.secondaryLight,
    backgroundColor: Colors.secondaryLight,
  },
  secondaryCameraAction: {
    borderColor: Colors.criticalLight,
    backgroundColor: "#FFF7F6",
  },
  cameraActionText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.secondaryDark,
  },
  criticalActionText: { color: Colors.critical },
  disabledCameraAction: {
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  disabledCameraActionText: { color: Colors.textDisabled },
  dischargeIconButton: {
    flex: 1,
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.criticalLight,
    borderRadius: 10,
    backgroundColor: Colors.criticalLight,
  },
  installCameraBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.secondaryLight,
    backgroundColor: Colors.secondaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  installCameraBtnText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.secondaryDark,
  },
  cameraDropdown: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 10,
    backgroundColor: Colors.white,
    padding: 6,
    gap: 4,
  },
  cameraDropdownOption: {
    minHeight: 42,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 7,
    backgroundColor: Colors.backgroundNurse,
  },
  reportBtnText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  dangerTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.critical,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
