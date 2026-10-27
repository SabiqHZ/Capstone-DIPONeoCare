import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
} from "react-native";

import Svg, { Path } from "react-native-svg";

import { useAuthStore } from "../../stores/auth.store";
import { useBabyContext } from "../../context/BabyContext";
import { api } from "../../services/api";
import { deviceService } from "../../services/device.service";
import { reportService } from "../../services/report.service";
import { DailyReport } from "../../types";
import React from "react";

const { width } = Dimensions.get("window");

export default function CameraScreen() {
  const user = useAuthStore((s) => s.user);
  const { state, setFocused } = useBabyContext();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Dua buffer gambar: satu tampil, satu menyiapkan frame berikutnya.
  const [frameUrls, setFrameUrls] = useState<[string | null, string | null]>([
    null,
    null,
  ]);

  const [activeFrameIndex, setActiveFrameIndex] = useState<0 | 1>(0);
  const [hasFrame, setHasFrame] = useState(false);

  // Ref untuk mengetahui frame mana yang sedang dimuat.
  const pendingFrameRef = useRef<{
    index: 0 | 1;
    url: string;
  } | null>(null);

  // Ref agar event gambar dapat mengetahui apakah pernah ada frame.
  const hasFrameRef = useRef(false);

  // Digunakan untuk meminta frame berikutnya setelah frame siap.
  const scheduleFrameRef = useRef<((index: 0 | 1) => void) | null>(null);

  const [isLoadingDevice, setIsLoadingDevice] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);

  const [apiDeviceOnline, setApiDeviceOnline] = useState<boolean | null>(null);
  const lastReportFetchedAtRef = useRef(0);

  const babyId = user?.role === "parent" ? user.babyId : null;

  const focusedStatus = babyId ? state.statuses[babyId] : null;

  const isDeviceOnline =
    focusedStatus?.deviceOnline ?? apiDeviceOnline ?? false;

  const getActivityDistribution = () => {
    if (!dailyReport) {
      return {
        sleepPct: 0,
        awakePct: 0,
        cryingPct: 0,
      };
    }

    let sleep = 0;
    let awake = 0;
    let crying = 0;

    for (const hour of dailyReport.hourlyActivities) {
      sleep += hour.sleepMinutes;
      awake += hour.awakeMinutes;
      crying += hour.cryingMinutes;
    }

    const total = sleep + awake + crying;

    if (total <= 0) {
      return {
        sleepPct: 0,
        awakePct: 0,
        cryingPct: 0,
      };
    }

    const sleepPct = Math.round((sleep / total) * 100);

    const awakePct = Math.round((awake / total) * 100);

    const cryingPct = Math.max(0, 100 - sleepPct - awakePct);

    return {
      sleepPct,
      awakePct,
      cryingPct,
    };
  };

  const activityDistribution = getActivityDistribution();

  const resetCameraFrames = () => {
    setFrameUrls([null, null]);
    setActiveFrameIndex(0);
    setHasFrame(false);

    hasFrameRef.current = false;
    pendingFrameRef.current = null;
  };

  const handleFrameLoaded = (index: 0 | 1, url: string | null) => {
    if (!url) return;

    const pending = pendingFrameRef.current;

    // Abaikan event dari frame lama atau frame yang bukan target saat ini.
    if (!pending || pending.index !== index || pending.url !== url) {
      return;
    }

    // Frame baru sudah siap. Baru sekarang ganti gambar yang terlihat.
    pendingFrameRef.current = null;
    hasFrameRef.current = true;

    setActiveFrameIndex(index);
    setHasFrame(true);
    setHasError(false);

    // Siapkan buffer satunya untuk frame berikutnya.
    const nextIndex: 0 | 1 = index === 0 ? 1 : 0;
    scheduleFrameRef.current?.(nextIndex);
  };

  const handleFrameError = (index: 0 | 1, url: string | null) => {
    if (!url) return;

    const pending = pendingFrameRef.current;

    if (!pending || pending.index !== index || pending.url !== url) {
      return;
    }

    pendingFrameRef.current = null;

    // Jangan menutup gambar lama hanya karena frame baru gagal.
    if (!hasFrameRef.current) {
      setHasError(true);
    }

    // Coba muat ulang buffer yang gagal.
    scheduleFrameRef.current?.(index);
  };

  /**
   * Ambil device + stream URL dari backend.
   */
  const fetchStreamUrl = async () => {
    if (!babyId) {
      setStreamUrl(null);
      resetCameraFrames();
      setApiDeviceOnline(null);
      setHasError(false);
      setIsLoadingDevice(false);
      return;
    }

    setIsLoadingDevice(true);
    setHasError(false);

    try {
      console.log("[ParentCamera] Mulai mengambil device...");

      const response = await api.get(`/babies/${babyId}`);

      console.log("[ParentCamera] baby response:", response.data);

      const device = response.data.data?.devices;

      console.log("[ParentCamera] device:", device);

      const deviceId = device?.id;

      console.log("[ParentCamera] deviceId:", deviceId);

      if (!deviceId) {
        console.error("[ParentCamera] Device ID tidak ditemukan.");

        setStreamUrl(null);
        resetCameraFrames();
        setApiDeviceOnline(false);
        setHasError(true);

        return;
      }

      const url = await deviceService.getStreamUrl(deviceId);

      console.log("[ParentCamera] streamUrl:", url);

      setApiDeviceOnline(
        typeof device?.is_online === "boolean" ? device.is_online : null,
      );

      setStreamUrl(url);
    } catch (error) {
      console.error("[ParentCamera] fetchStreamUrl ERROR:", error);

      setStreamUrl(null);
      resetCameraFrames();
      setApiDeviceOnline(null);
      setHasError(true);
    } finally {
      setIsLoadingDevice(false);
    }
  };

  /**
   * Ambil report harian.
   */
  const fetchDailyReport = useCallback(async () => {
    if (!babyId) {
      setDailyReport(null);
      return;
    }

    try {
      const now = new Date();
      const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      const report = await reportService.getDailyReport(babyId, today);

      setDailyReport(report);
    } catch (error) {
      console.error(
        "[ParentCamera] Gagal memuat distribusi aktivitas harian:",
        error,
      );

      setDailyReport(null);
    }
  }, [babyId]);

  /**
   * Load the latest AI status when the camera screen opens.
   */
  useEffect(() => {
    if (babyId) {
      void setFocused(babyId);
    }
  }, [babyId, setFocused]);

  /**
   * Ketika baby berubah, ambil device terbaru.
   */
  useEffect(() => {
    void fetchStreamUrl();
  }, [babyId]);

  /**
   * Refresh activity totals after each finalized AI status update.
   */
  useEffect(() => {
    const timeSinceLastFetch = Date.now() - lastReportFetchedAtRef.current;
    const delay = Math.max(0, 5_000 - timeSinceLastFetch);
    const timer = setTimeout(() => {
      lastReportFetchedAtRef.current = Date.now();
      void fetchDailyReport();
    }, delay);

    return () => clearTimeout(timer);
  }, [fetchDailyReport, focusedStatus?.lastUpdated]);

  /**
   * Polling frame terbaru dengan double buffering mechanism.
   */
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

    // Minta sebuah frame untuk buffer yang sedang tidak ditampilkan.
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

    // Lanjutkan polling hanya setelah frame sebelumnya selesai diproses.
    const scheduleNextFrame = (index: 0 | 1) => {
      if (cancelled) return;

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        requestFrame(index);
      }, 1000);
    };

    scheduleFrameRef.current = scheduleNextFrame;

    // Reset ketika URL kamera berubah.
    setFrameUrls([null, null]);
    setActiveFrameIndex(0);
    setHasFrame(false);

    hasFrameRef.current = false;
    pendingFrameRef.current = null;

    // Ambil frame pertama.
    requestFrame(0);

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }

      pendingFrameRef.current = null;

      if (scheduleFrameRef.current === scheduleNextFrame) {
        scheduleFrameRef.current = null;
      }
    };
  }, [streamUrl]);

  if (!babyId) {
    return null;
  }

  const videoHeight = isFullscreen ? width * 1.1 : width * 0.75;

  const currentActivityLabel = () => {
    if (!focusedStatus) {
      return "—";
    }

    if (focusedStatus.activity === "sleeping") {
      return "Tidur";
    }

    if (focusedStatus.activity === "awake") {
      return "Bangun";
    }

    if (focusedStatus.activity === "crying") {
      return "Menangis";
    }

    return "—";
  };

  const anomalyType = focusedStatus?.faceAnomaly ?? null;

  const hasAnomaly = anomalyType !== null && anomalyType !== "none";

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Kamera</Text>

        <View style={styles.badges}>
          <View
            style={[
              styles.onlineBadge,
              {
                backgroundColor: isDeviceOnline ? "#052e16" : "#1f0a0a",
              },
            ]}
          >
            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: isDeviceOnline ? "#4ade80" : "#f87171",
                },
              ]}
            />

            <Text
              style={[
                styles.onlineText,
                {
                  color: isDeviceOnline ? "#4ade80" : "#f87171",
                },
              ]}
            >
              {isDeviceOnline ? "Live" : "Offline"}
            </Text>
          </View>
        </View>
      </View>

      {/* CAMERA */}
      <View
        style={[
          styles.videoWrapper,
          {
            height: videoHeight,
          },
        ]}
      >
        {streamUrl ? (
          <>
            {/* BUFFER 0 */}
            {frameUrls[0] ? (
              <Image
                key={`camera-0-${frameUrls[0]}`}
                source={{ uri: frameUrls[0] }}
                style={[
                  styles.cameraImage,
                  {
                    opacity: hasFrame && activeFrameIndex === 0 ? 1 : 0,
                  },
                ]}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => handleFrameLoaded(0, frameUrls[0])}
                onError={() => handleFrameError(0, frameUrls[0])}
              />
            ) : null}

            {/* BUFFER 1 */}
            {frameUrls[1] ? (
              <Image
                key={`camera-1-${frameUrls[1]}`}
                source={{ uri: frameUrls[1] }}
                style={[
                  styles.cameraImage,
                  {
                    opacity: hasFrame && activeFrameIndex === 1 ? 1 : 0,
                  },
                ]}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => handleFrameLoaded(1, frameUrls[1])}
                onError={() => handleFrameError(1, frameUrls[1])}
              />
            ) : null}

            {/* Tampilkan indikator hanya sebelum frame pertama berhasil */}
            {!hasFrame ? (
              <View style={styles.centerBox}>
                {hasError ? (
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
                    <ActivityIndicator color="#1D9E75" />

                    <Text style={styles.centerText}>
                      Menunggu frame kamera...
                    </Text>
                  </>
                )}
              </View>
            ) : null}
          </>
        ) : isLoadingDevice ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" />

            <Text style={styles.centerText}>Menghubungkan ke kamera...</Text>
          </View>
        ) : hasError ? (
          <View style={styles.centerBox}>
            <Text style={styles.offlineText}>Gagal memuat kamera</Text>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void fetchStreamUrl()}
            >
              <Text style={styles.retryText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.centerBox}>
            <Text style={styles.offlineText}>Kamera belum dikonfigurasi</Text>

            <Text style={styles.offlineSub}>
              Hubungi tenaga medis untuk scan QR perangkat
            </Text>
          </View>
        )}

        {/* FULLSCREEN */}
        <TouchableOpacity
          style={styles.fullscreenBtn}
          onPress={() => setIsFullscreen((current) => !current)}
        >
          <Text style={styles.fullscreenIcon}>{isFullscreen ? "⊠" : "⊡"}</Text>
        </TouchableOpacity>
      </View>

      {/* INFO */}
      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Aktivitas bayi</Text>

            <Text style={styles.infoValue}>{currentActivityLabel()}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Wajah bayi</Text>

            <Text
              style={[
                styles.infoValue,
                {
                  color: !isDeviceOnline
                    ? "#fff"
                    : hasAnomaly
                      ? "#E24B4A"
                      : "#1D9E75",
                },
              ]}
            >
              {!isDeviceOnline || !focusedStatus
                ? "—"
                : anomalyType === null
                  ? "Menunggu data AI"
                  : hasAnomaly
                    ? anomalyType
                    : "Terdeteksi"}
            </Text>
          </View>
        </View>

        {/* ACTIVITY DISTRIBUTION */}
        <View style={styles.chartCard}>
          {/* TIDUR */}
          <View style={styles.progressGroup}>
            <Text
              style={[
                styles.progressLabel,
                {
                  color: "#4ade80",
                },
              ]}
            >
              {activityDistribution.sleepPct}%{" "}
              <Text style={styles.labelSub}>Tidur</Text>
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${activityDistribution.sleepPct}%`,
                    backgroundColor: "#1D9E75",
                  },
                ]}
              />
            </View>
          </View>

          {/* BANGUN */}
          <View style={styles.progressGroup}>
            <Text
              style={[
                styles.progressLabel,
                {
                  color: "#f59e0b",
                },
              ]}
            >
              {activityDistribution.awakePct}%{" "}
              <Text style={styles.labelSub}>Bangun</Text>
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${activityDistribution.awakePct}%`,
                    backgroundColor: "#EF9F27",
                  },
                ]}
              />
            </View>
          </View>

          {/* MENANGIS */}
          <View style={styles.progressGroup}>
            <Text
              style={[
                styles.progressLabel,
                {
                  color: "#ef4444",
                },
              ]}
            >
              {activityDistribution.cryingPct}%{" "}
              <Text style={styles.labelSub}>Menangis</Text>
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${activityDistribution.cryingPct}%`,
                    backgroundColor: "#E24B4A",
                  },
                ]}
              />
            </View>
          </View>

          <Text style={styles.streamNote}>
            Live camera melalui frame JPEG terbaru · Tidak ada overlay deteksi
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#111",
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },

  badges: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  onlineText: {
    fontSize: 11,
    fontWeight: "600",
  },

  videoWrapper: {
    width,
    backgroundColor: "#000",
    position: "relative",
  },

  cameraImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    transform: [{ rotate: "180deg" }],
  },

  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#000",
  },

  centerText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },

  offlineText: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },

  offlineSub: {
    fontSize: 12,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  retryBtn: {
    marginTop: 8,
    backgroundColor: "#1D9E75",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  fullscreenBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: 8,
  },

  fullscreenIcon: {
    fontSize: 20,
    color: "#fff",
  },

  fullscreenIconDisabled: {
    opacity: 0.5,
  },

  infoPanel: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 16,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },

  infoItem: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },

  infoLabel: {
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "500",
  },

  infoValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },

  chartCard: {
    backgroundColor: "#161616",
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
    fontWeight: "700",
  },

  labelSub: {
    color: "#9CA3AF",
    fontWeight: "500",
    fontSize: 12,
  },

  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#222",
    overflow: "hidden",
    width: "100%",
  },

  progressBar: {
    height: "100%",
    borderRadius: 4,
  },

  streamNote: {
    fontSize: 11,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "500",
  },
});
