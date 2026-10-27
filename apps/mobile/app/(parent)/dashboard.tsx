import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

import { useAuthStore } from "../../stores/auth.store";
import {
  useBabyContext,
  useFocusedBabyStatus,
  useActiveAlerts,
} from "../../context/BabyContext";
import { babyService } from "../../services/baby.service";
import { reportService } from "../../services/report.service";

import { ActivityCard } from "../../components/baby/ActivityCard";
import { AlertBanner } from "../../components/ui/AlertBanner";
import { FaceAnomalyBanner } from "../../components/ui/FaceAnomalyBanner";
import { ActionButton } from "../../components/ui/ActionButton";
import { Colors } from "../../constants/colors";
import { Typography } from "../../constants/fonts";
import { ControlSize, Radii, Spacing } from "../../constants/ui";

import { DailyReport } from "../../types";
import * as Clipboard from "expo-clipboard";

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
  const copyParentAccessCode = async () => {
    if (!babyProfile?.unique_code) return;

    await Clipboard.setStringAsync(babyProfile.unique_code);

    Alert.alert(
      "Kode disalin",
      "Kode akses orang tua berhasil disalin.",
    );
  };
  const router = useRouter();

  const { setFocused, acknowledgeAlert } = useBabyContext();
  const status = useFocusedBabyStatus();
  const alerts = useActiveAlerts();

  const [babyProfile, setBabyProfile] = useState<BabyProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const [faceAnomalyDismissed, setFaceAnomalyDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const babyName = useAuthStore((s) =>
    s.user?.role === "parent" ? s.user.babyName : "",
  );

  const babyId = useAuthStore((s) =>
    s.user?.role === "parent" ? s.user.babyId : "",
  );

  const logout = useAuthStore((s) => s.logout);

  const fetchBabyProfile = useCallback(async () => {
    if (!babyId) {
      setBabyProfile(null);
      setProfileError(true);
      setIsProfileLoading(false);
      return;
    }

    try {
      setIsProfileLoading(true);
      setProfileError(false);

      const res = await babyService.getBabyById(babyId);

      if (!res) {
        setBabyProfile(null);
        setProfileError(true);
        return;
      }

      setBabyProfile(res as BabyProfile);
    } catch (err) {
      console.error("[ParentDashboard] Gagal memuat profil bayi:", err);

      setBabyProfile(null);
      setProfileError(true);
    } finally {
      setIsProfileLoading(false);
    }
  }, [babyId]);

  const fetchDailyReport = useCallback(async () => {
    if (!babyId) {
      setDailyReport(null);
      return;
    }

    try {
      setIsReportLoading(true);

      const today = new Date().toISOString().split("T")[0];

      const report = await reportService.getDailyReport(babyId, today);

      setDailyReport(report);
    } catch (err) {
      console.error("[ParentDashboard] Gagal memuat laporan harian:", err);

      setDailyReport(null);
    } finally {
      setIsReportLoading(false);
    }
  }, [babyId]);

  useEffect(() => {
    if (!babyId) return;

    setFocused(babyId);

    void fetchBabyProfile();
    void fetchDailyReport();
  }, [babyId, setFocused, fetchBabyProfile, fetchDailyReport]);

  useEffect(() => {
    if (status?.faceAnomaly && status.faceAnomaly !== "none") {
      setFaceAnomalyDismissed(false);
    }
  }, [status?.faceAnomaly, status?.lastUpdated]);

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/code-entry");
  };

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return "belum tersedia";

    const time = new Date(timestamp).getTime();

    if (!Number.isFinite(time)) {
      return "belum tersedia";
    }

    const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));

    if (diffSeconds < 5) {
      return "baru saja";
    }

    if (diffSeconds < 60) {
      return `${diffSeconds} detik lalu`;
    }

    const minutes = Math.floor(diffSeconds / 60);

    if (minutes < 60) {
      return `${minutes} menit lalu`;
    }

    const hours = Math.floor(minutes / 60);

    return `${hours} jam lalu`;
  };

  const isStatusStale = (() => {
    if (!status?.lastUpdated) return false;

    const timestamp = new Date(status.lastUpdated).getTime();

    if (!Number.isFinite(timestamp)) return false;

    const ageSeconds = (Date.now() - timestamp) / 1000;

    return ageSeconds > 30;
  })();

  const showFaceAnomaly = Boolean(
    status?.faceAnomaly &&
    status.faceAnomaly !== "none" &&
    !faceAnomalyDismissed,
  );

  const visibleAlerts = alerts.slice(0, 3);

  const deviceOnline = status?.deviceOnline ?? null;

  const isDeviceStatusUnknown = deviceOnline === null;

  const deviceBadgeBackground = isDeviceStatusUnknown
    ? Colors.neutralLight
    : deviceOnline
      ? Colors.successLight
      : Colors.offlineLight;

  const deviceStatusColor = isDeviceStatusUnknown
    ? Colors.neutral
    : deviceOnline
      ? Colors.success
      : Colors.offlineDark;

  const todaySleepMinutes = dailyReport?.totalSleepMinutes ?? 0;

  const todayAwakeMinutes = dailyReport?.totalAwakeMinutes ?? 0;

  const todayCryingEvents = dailyReport?.totalCryingEvents ?? 0;

  const formatDuration = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return "0m";
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours <= 0) {
      return `${remainingMinutes}m`;
    }

    if (remainingMinutes === 0) {
      return `${hours}j`;
    }

    return `${hours}j ${remainingMinutes}m`;
  };

  if (!babyId) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* =====================================================
            HEADER
        ====================================================== */}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Halo, Orang Tua</Text>

            <Text style={styles.babyName}>
              {babyName || babyProfile?.name || "Bayi"}
            </Text>

            {babyProfile?.bed_number ? (
              <Text style={styles.bedNumber}>
                Tempat tidur {babyProfile.bed_number}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            <View
              style={[
                styles.deviceBadge,
                {
                  backgroundColor: deviceBadgeBackground,
                },
              ]}
            >
              <View
                style={[
                  styles.deviceDot,
                  {
                    backgroundColor: deviceStatusColor,
                  },
                ]}
              />

              <Text
                style={[
                  styles.deviceBadgeText,
                  {
                    color: deviceStatusColor,
                  },
                ]}
              >
                {isDeviceStatusUnknown
                  ? "Belum diketahui"
                  : deviceOnline
                    ? "Aktif"
                    : "Tidak aktif"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Keluar dari akun"
            >
              <Text style={styles.logoutText}>Keluar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =====================================================
            MONITORING HEADER
        ====================================================== */}

        <View style={styles.monitoringHeader}>
          <View style={styles.monitoringHeaderText}>
            <Text style={styles.monitoringTitle}>Status Bayi</Text>

            <Text style={styles.monitoringSubtitle}>
              Kondisi terbaru berdasarkan pemantauan
            </Text>
          </View>

          <View style={styles.liveIndicator}>
            <View
              style={[
                styles.liveDot,
                {
                  backgroundColor:
                    deviceOnline === true ? Colors.success : Colors.offline,
                },
              ]}
            />

            <Text style={styles.liveText}>
              {deviceOnline === true ? "LANGSUNG" : "TIDAK AKTIF"}
            </Text>
          </View>
        </View>

        {/* =====================================================
            PRIMARY MONITORING
        ====================================================== */}

        {status ? (
          <ActivityCard
            key={`${status.activity}-${status.soundClass}-${status.lastUpdated}`}
            activity={status.activity}
            soundClass={status.soundClass}
            soundConfidence={status.soundConfidence}
            faceAnomaly={status.faceAnomaly}
          />
        ) : (
          <View style={styles.monitoringLoading}>
            <ActivityIndicator size="small" color="#1D9E75" />

            <Text style={styles.monitoringLoadingText}>
              Menghubungkan ke data bayi...
            </Text>
          </View>
        )}

        {/* =====================================================
            DATA FRESHNESS
        ====================================================== */}

        {status?.lastUpdated ? (
          <View
            style={[
              styles.freshnessRow,
              isStatusStale && styles.freshnessRowStale,
            ]}
          >
            <View
              style={[
                styles.freshnessDot,
                {
                  backgroundColor: isStatusStale ? Colors.warning : Colors.success,
                },
              ]}
            />

            <Text
              style={[
                styles.lastUpdated,
                isStatusStale && styles.lastUpdatedStale,
              ]}
            >
              {isStatusStale
                ? `Data mungkin sudah tidak terbaru · diperbarui ${formatRelativeTime(
                    status.lastUpdated,
                  )}`
                : `Diperbarui ${formatRelativeTime(status.lastUpdated)}`}
            </Text>
          </View>
        ) : (
          <Text style={styles.lastUpdated}>Belum ada waktu pembaruan data</Text>
        )}

        {/* =====================================================
            ALERTS
        ====================================================== */}

        {visibleAlerts.length > 0 ? (
          <View style={styles.alertSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Perlu perhatian</Text>

              <Text style={styles.alertCount}>{visibleAlerts.length}</Text>
            </View>

            <View style={styles.alertList}>
              {visibleAlerts.map((alert) => (
                <AlertBanner
                  key={alert.id}
                  message={alert.message}
                  severity={alert.severity}
                  time={new Date(alert.timestamp).toLocaleTimeString("id-ID")}
                  onDismiss={async () => {
                    try {
                      await acknowledgeAlert(alert.id);
                    } catch {
                      Alert.alert(
                        "Gagal",
                        "Peringatan belum dapat ditandai sebagai sudah ditangani.",
                      );
                    }
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* =====================================================
            FACE ANOMALY
        ====================================================== */}

        <FaceAnomalyBanner
          visible={showFaceAnomaly}
          onDismiss={() => setFaceAnomalyDismissed(true)}
        />

        {/* =====================================================
            CAMERA CTA
        ====================================================== */}

        <TouchableOpacity
          style={styles.cameraButton}
          activeOpacity={0.85}
          onPress={() => router.push("/(parent)/camera")}
          accessibilityRole="button"
          accessibilityLabel="Lihat kamera bayi"
          accessibilityHint="Membuka pemantauan kamera secara langsung"
        >
          <View style={styles.cameraButtonIcon}>
            <Text style={styles.cameraButtonIconText}>●</Text>
          </View>

          <View style={styles.cameraButtonContent}>
            <Text style={styles.cameraButtonTitle}>Lihat Kamera</Text>

            <Text style={styles.cameraButtonSubtitle}>
              Pantau kondisi bayi secara langsung
            </Text>
          </View>

          <Text style={styles.cameraButtonArrow}>›</Text>
        </TouchableOpacity>

        {/* =====================================================
            DAILY SUMMARY
        ====================================================== */}

        <View style={styles.todaySection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Ringkasan Hari Ini</Text>

              <Text style={styles.sectionSubtitle}>
                Aktivitas bayi hari ini
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(parent)/report")}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Lihat laporan aktivitas bayi"
            >
              <Text style={styles.seeAllText}>Lihat laporan</Text>
            </TouchableOpacity>
          </View>

          {isReportLoading ? (
            <View style={styles.reportLoading}>
              <ActivityIndicator size="small" color="#1D9E75" />

              <Text style={styles.reportLoadingText}>Memuat ringkasan...</Text>
            </View>
          ) : (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {formatDuration(todaySleepMinutes)}
                </Text>

                <Text style={styles.summaryLabel}>Tidur</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {formatDuration(todayAwakeMinutes)}
                </Text>

                <Text style={styles.summaryLabel}>Bangun</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{todayCryingEvents}x</Text>

                <Text style={styles.summaryLabel}>Menangis</Text>
              </View>
            </View>
          )}
        </View>

        {/* =====================================================
            BABY INFORMATION — SECONDARY
        ====================================================== */}

        {isProfileLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#1D9E75" />

            <Text style={styles.loadingText}>Memuat informasi bayi...</Text>
          </View>
        ) : profileError || !babyProfile ? (
          <View style={styles.loadingBox}>
            <Text style={styles.profileErrorTitle}>
              Informasi bayi belum dapat dimuat
            </Text>

            <Text style={styles.loadingText}>
              Periksa koneksi aplikasi, lalu coba muat ulang informasi bayi.
            </Text>

            <ActionButton
              variant="parent"
              style={styles.retryButton}
              onPress={fetchBabyProfile}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Coba muat ulang informasi bayi"
            >
              <Text style={styles.retryButtonText}>Coba Lagi</Text>
            </ActionButton>
          </View>
        ) : (
          <View style={styles.identityCard}>
            <Text style={styles.cardTitle}>Informasi Bayi</Text>

            <View style={styles.divider} />

            <View style={styles.compactIdentity}>
              <View style={styles.compactIdentityItem}>
                <Text style={styles.infoLabel}>Nama</Text>

                <Text style={styles.infoValue}>{babyProfile.name}</Text>
              </View>

              <View style={styles.compactIdentityItem}>
                <Text style={styles.infoLabel}>Tempat tidur</Text>

                <Text style={styles.infoValue}>{babyProfile.bed_number}</Text>
              </View>
            </View>

            {isExpanded ? (
              <View style={styles.expandedContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tanggal Lahir</Text>

                  <Text style={styles.infoValue}>
                    {new Date(babyProfile.date_of_birth).toLocaleDateString(
                      "id-ID",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nama Orang Tua</Text>

                  <Text style={styles.infoValue}>
                    {babyProfile.parent_name}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Kode Unik Akses</Text>

                  <View style={styles.accessCodeValueContainer}>
                    <Text style={[styles.infoValue, styles.monoText]}>
                      {babyProfile.unique_code}
                    </Text>

                    <TouchableOpacity
                      style={styles.copyCodeButton}
                      onPress={copyParentAccessCode}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Salin kode akses orang tua"
                    >
                      <Text style={styles.copyCodeButtonText}>Salin</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Terdaftar</Text>

                  <Text style={styles.infoValue}>
                    {new Date(babyProfile.created_at).toLocaleDateString(
                      "id-ID",
                    )}
                  </Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setIsExpanded((previous) => !previous)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                isExpanded ? "Sembunyikan detail bayi" : "Lihat detail bayi"
              }
            >
              <Text style={styles.expandButtonText}>
                {isExpanded ? "Sembunyikan detail" : "Lihat detail bayi"}
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
                style={{
                  transform: [
                    {
                      rotate: isExpanded ? "180deg" : "0deg",
                    },
                  ],
                }}
              >
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F0F9F5",
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },

  /* Header */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },

  headerLeft: {
    flex: 1,
    gap: 2,
  },

  greeting: {
    fontSize: 13,
    color: "#0F6E56",
    fontWeight: "500",
  },

  babyName: {
    fontSize: 24,
    color: "#085041",
    fontWeight: "700",
  },

  bedNumber: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  headerRight: {
    alignItems: "flex-end",
    gap: 8,
  },

  deviceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  deviceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  deviceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  logoutBtn: {
    backgroundColor: Colors.criticalLight,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: ControlSize.minTouchTarget,
    justifyContent: "center",
  },

  logoutText: {
    fontSize: 11,
    color: "#B91C1C",
    fontWeight: "600",
  },

  /* Monitoring */

  monitoringHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  monitoringHeaderText: {
    flex: 1,
  },

  monitoringTitle: {
    ...Typography.h2,
    color: "#085041",
  },

  monitoringSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },

  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.successLight,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  liveText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.success,
  },

  monitoringLoading: {
    minHeight: 150,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 24,
  },

  monitoringLoadingText: {
    fontSize: 13,
    color: "#6B7280",
  },

  /* Freshness */

  freshnessRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    minHeight: 24,
  },

  freshnessRowStale: {
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    paddingHorizontal: 8,
  },

  freshnessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  lastUpdated: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },

  lastUpdatedStale: {
    color: "#92400E",
  },

  /* Alerts */

  alertSection: {
    gap: 8,
  },

  alertList: {
    gap: 8,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    ...Typography.h3,
    color: "#085041",
  },

  sectionSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: "#6B7280",
  },

  alertCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.criticalLight,
    color: Colors.criticalDark,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingTop: Platform.OS === "android" ? 4 : 0,
  },

  /* Camera */

  cameraButton: {
    minHeight: 68,
    borderRadius: Radii.card,
    backgroundColor: "#085041",
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  cameraButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  cameraButtonIconText: {
    color: "#86EFAC",
    fontSize: 18,
  },

  cameraButtonContent: {
    flex: 1,
  },

  cameraButtonTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  cameraButtonSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: "#D1FAE5",
  },

  cameraButtonArrow: {
    fontSize: 28,
    fontWeight: "300",
    color: "#FFFFFF",
    marginLeft: 8,
  },

  /* Daily summary */

  todaySection: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    gap: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  seeAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F6E56",
  },

  reportLoading: {
    minHeight: 70,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  reportLoadingText: {
    fontSize: 12,
    color: "#6B7280",
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },

  summaryItem: {
    flex: 1,
    backgroundColor: "#F0F9F5",
    borderRadius: 12,
    padding: 12,
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#085041",
  },

  summaryLabel: {
    marginTop: 3,
    fontSize: 11,
    color: "#6B7280",
  },

  /* Profile */

  loadingBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  loadingText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  profileErrorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },

  retryButton: {
    marginTop: 4,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  identityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radii.card,
    padding: Spacing.cardPadding,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  cardTitle: {
    ...Typography.h3,
    color: "#085041",
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  compactIdentity: {
    flexDirection: "row",
    gap: 12,
  },

  compactIdentityItem: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 11,
  },

  infoLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },

  infoValue: {
    marginTop: 4,
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },

  expandedContent: {
    gap: 10,
    marginTop: 2,
  },

  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },

  expandButtonText: {
    fontSize: 12,
    color: "#0F6E56",
    fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif-medium",
    fontWeight: "600",
  },

  monoText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#0F6E56",
    letterSpacing: 0.5,
  },
  accessCodeValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flex: 1,
    marginLeft: 16,
  },

  copyCodeButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#E1F5EE",
    justifyContent: "center",
    alignItems: "center",
  },

  copyCodeButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F6E56",
  },
});
