import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "../../components/ui/Icon";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";
import { Radii, Spacing } from "../../constants/ui";
import { babyService } from "../../services/baby.service";
import { deviceService, ManagedDevice } from "../../services/device.service";
import { useTheme } from "../../context/ThemeContext";

export default function CameraListScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "unpair" | "delete";
    device: ManagedDevice;
  } | null>(null);

  const loadDevices = useCallback(async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setError("");
    try {
      setDevices(await deviceService.getManagedDevices());
    } catch (err: any) {
      setError(err.response?.data?.error || "Daftar kamera gagal dimuat.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const counts = useMemo(() => ({
    total: devices.length,
    available: devices.filter((device) => !device.baby_id).length,
    used: devices.filter((device) => Boolean(device.baby_id)).length,
  }), [devices]);

  const confirmUnpair = (device: ManagedDevice) => {
    if (!device.baby_id) return;
    setFeedback("");
    setFeedbackIsError(false);
    setPendingAction({ type: "unpair", device });
  };

  const confirmDelete = (device: ManagedDevice) => {
    if (device.baby_id) {
      return;
    }
    setFeedback("");
    setFeedbackIsError(false);
    setPendingAction({ type: "delete", device });
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    const { type, device } = pendingAction;
    setBusyId(device.id);
    setFeedback("");
    try {
      if (type === "unpair" && device.baby_id) {
        await babyService.unpairDevice(device.baby_id, device.id);
        await loadDevices(true);
        setFeedback(`Kamera berhasil dilepas dari ${device.baby?.name || "bayi"}.`);
      } else {
        await deviceService.deleteDevice(device.id);
        setDevices((current) => current.filter((item) => item.id !== device.id));
        setFeedback("Kamera berhasil dihapus dari daftar.");
      }
      setFeedbackIsError(false);
    } catch (err: any) {
      setFeedback(err.response?.data?.error || "Tindakan gagal. Silakan coba lagi.");
      setFeedbackIsError(true);
    } finally {
      setBusyId(null);
      setPendingAction(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, isDark && dark.safe]}>
      <View style={[styles.header, isDark && dark.surface]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali ke dashboard"
        >
          <Icon name="arrow-back" library="ionicons" size={22} color={isDark ? "#BFDBFE" : Colors.secondaryDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && dark.heading]}>Daftar Kamera</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadDevices(true)}
          accessibilityRole="button"
          accessibilityLabel="Muat ulang daftar kamera"
        >
          <Icon name="refresh-outline" library="ionicons" size={20} color={isDark ? "#BFDBFE" : Colors.secondaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isDark && dark.page]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void loadDevices(true)} colors={[Colors.secondary]} />
        }
      >
        <Text style={[styles.description, isDark && dark.muted]}>Pantau kamera yang tersedia dan kamera yang sedang terpasang pada bayi.</Text>

        {feedback ? <Text style={[styles.feedback, feedbackIsError ? styles.errorFeedback : styles.successFeedback, isDark && dark.body]}>{feedback}</Text> : null}

        <View style={styles.summaryRow}>
          <SummaryCard label="Jumlah kamera" value={counts.total} icon="videocam-outline" isDark={isDark} />
          <SummaryCard label="Tersedia" value={counts.available} icon="checkmark-circle-outline" tone="success" isDark={isDark} />
          <SummaryCard label="Terpakai" value={counts.used} icon="link-outline" tone="info" isDark={isDark} />
        </View>

        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={Colors.secondary} />
            <Text style={[styles.stateText, isDark && dark.muted]}>Memuat daftar kamera…</Text>
          </View>
        ) : error ? (
          <View style={[styles.stateCard, isDark && dark.surface]}>
            <Icon name="alert-circle-outline" library="ionicons" size={32} color={Colors.critical} />
            <Text style={[styles.stateText, isDark && dark.body]}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void loadDevices()} accessibilityRole="button">
              <Text style={styles.retryText}>Coba lagi</Text>
            </TouchableOpacity>
          </View>
        ) : devices.length === 0 ? (
          <View style={[styles.stateCard, isDark && dark.surface]}>
            <Icon name="videocam-off-outline" library="ionicons" size={34} color={Colors.textMuted} />
            <Text style={[styles.emptyTitle, isDark && dark.heading]}>Belum ada kamera</Text>
            <Text style={[styles.stateText, isDark && dark.muted]}>Kamera yang terdaftar akan muncul di sini.</Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map((device) => {
              const isUsed = Boolean(device.baby_id);
              const isBusy = busyId === device.id;
              return (
                <View key={device.id} style={[styles.deviceCard, isDark && dark.surface]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.cameraIcon, isDark && dark.iconSurface]}>
                      <Icon name="videocam-outline" library="ionicons" size={21} color={isDark ? "#BFDBFE" : Colors.secondaryDark} />
                    </View>
                    <View style={styles.deviceIdentity}>
                      <Text style={[styles.deviceName, isDark && dark.heading]} numberOfLines={1}>{device.name || "Kamera"}</Text>
                      <Text style={[styles.macAddress, isDark && dark.muted]}>{device.mac_address}</Text>
                    </View>
                    <View style={[styles.onlineBadge, device.is_online ? styles.online : styles.offline]}>
                      <View style={[styles.statusDot, device.is_online ? styles.onlineDot : styles.offlineDot]} />
                      <Text style={[styles.onlineText, device.is_online ? styles.onlineLabel : styles.offlineLabel]}>{device.is_online ? "Aktif" : "Tidak aktif"}</Text>
                    </View>
                  </View>

                  <View style={[styles.statusRow, isDark && dark.divider]}>
                    <Text style={[styles.statusLabel, isDark && dark.muted]}>Status pemasangan</Text>
                    <Text style={[styles.statusValue, isUsed ? styles.usedValue : styles.availableValue]}>{isUsed ? "Terpakai" : "Tersedia"}</Text>
                  </View>

                  {isUsed ? (
                    <View style={[styles.babyRow, isDark && dark.babyRow]}>
                      <Icon name="happy-outline" library="ionicons" size={18} color={isDark ? "#BFDBFE" : Colors.secondaryDark} />
                      <View style={styles.babyInfo}>
                        <Text style={[styles.babyLabel, isDark && dark.muted]}>Terpasang pada</Text>
                        <Text style={[styles.babyName, isDark && dark.heading]}>{device.baby?.name || "Bayi tidak diketahui"}{device.baby?.bed_number ? ` · Tempat tidur ${device.baby.bed_number}` : ""}</Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    {isUsed ? (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.unpairButton]}
                        onPress={() => confirmUnpair(device)}
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Lepaskan kamera dari ${device.baby?.name || "bayi"}`}
                      >
                        {isBusy ? <ActivityIndicator size="small" color={Colors.critical} /> : <Icon name="unlink-outline" library="material" size={17} color={Colors.critical} />}
                        <Text style={styles.unpairText}>Lepaskan dari bayi</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton, isUsed && styles.disabledDelete]}
                      onPress={() => confirmDelete(device)}
                      disabled={isBusy || isUsed}
                      accessibilityRole="button"
                      accessibilityLabel={isUsed ? "Lepaskan kamera dari bayi sebelum menghapus" : "Hapus kamera"}
                    >
                      <Icon name="trash-outline" library="ionicons" size={17} color={isUsed ? Colors.textDisabled : Colors.critical} />
                      <Text style={[styles.deleteText, isUsed && styles.disabledDeleteText]}>Hapus kamera</Text>
                    </TouchableOpacity>
                  </View>
                  {isUsed ? <Text style={[styles.deleteHint, isDark && dark.muted]}>Lepaskan kamera dari bayi sebelum menghapusnya.</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <Modal
        visible={Boolean(pendingAction)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPendingAction(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPendingAction(null)} />
          <View style={[styles.confirmCard, isDark && dark.surface]} accessibilityViewIsModal>
            <View style={styles.confirmIcon}>
              <Icon
                name={pendingAction?.type === "delete" ? "trash-outline" : "unlink-outline"}
                library={pendingAction?.type === "delete" ? "ionicons" : "material"}
                size={25}
                color={Colors.critical}
              />
            </View>
            <Text style={[styles.confirmTitle, isDark && dark.heading]}>
              {pendingAction?.type === "delete" ? "Hapus kamera?" : "Lepaskan kamera?"}
            </Text>
            <Text style={[styles.confirmMessage, isDark && dark.body]}>
              {pendingAction?.type === "delete"
                ? `Kamera ${pendingAction.device.name || pendingAction.device.mac_address} akan dihapus dari daftar. Data audio yang terhubung ikut terhapus dan perangkat perlu mendaftar kembali untuk digunakan lagi.`
                : `Kamera akan dilepas dari ${pendingAction?.device.baby?.name || "bayi yang terhubung"}.`}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.cancelButton, isDark && dark.cancelButton]}
                onPress={() => setPendingAction(null)}
                disabled={busyId !== null}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelText, isDark && dark.body]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmActionButton}
                onPress={() => void runPendingAction()}
                disabled={busyId !== null}
                accessibilityRole="button"
              >
                {busyId ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmActionText}>
                    {pendingAction?.type === "delete" ? "Hapus kamera" : "Lepaskan"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = "neutral",
  isDark,
}: {
  label: string;
  value: number;
  icon: string;
  tone?: "neutral" | "success" | "info";
  isDark: boolean;
}) {
  const iconColor = tone === "success" ? Colors.success : tone === "info" ? Colors.info : Colors.secondaryDark;
  return (
    <View style={[styles.summaryCard, isDark && dark.surface]}>
      <Icon name={icon} library="ionicons" size={18} color={isDark ? "#BFDBFE" : iconColor} />
      <Text style={[styles.summaryValue, isDark && dark.heading]}>{value}</Text>
      <Text style={[styles.summaryLabel, isDark && dark.muted]}>{label}</Text>
    </View>
  );
}

const dark = StyleSheet.create({
  safe: { backgroundColor: "#111827" },
  page: { backgroundColor: "#111827" },
  surface: { backgroundColor: "#1F2937", borderColor: "#374151" },
  heading: { color: "#F9FAFB" },
  body: { color: "#D1D5DB" },
  muted: { color: "#9CA3AF" },
  divider: { borderTopColor: "#374151" },
  iconSurface: { backgroundColor: "#263548" },
  babyRow: { backgroundColor: "#263548" },
  cancelButton: { backgroundColor: "#1F2937", borderColor: "#4B5563" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  refreshButton: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  headerTitle: { ...Typography.h3, color: Colors.secondaryDark, flex: 1, textAlign: "center" },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  description: { fontFamily: Fonts.interRegular, fontSize: 13, lineHeight: 19, color: Colors.textMuted },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, minHeight: 98, padding: 10, gap: 5, borderRadius: Radii.card, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", elevation: 1 },
  summaryValue: { fontFamily: Fonts.nunitoBold, fontSize: 20, color: Colors.textPrimary },
  summaryLabel: { fontFamily: Fonts.interMedium, fontSize: 10, color: Colors.textMuted, textAlign: "center" },
  deviceList: { gap: 12 },
  deviceCard: { backgroundColor: Colors.white, borderRadius: Radii.card, padding: 16, gap: 14, elevation: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cameraIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center" },
  deviceIdentity: { flex: 1, minWidth: 0, gap: 3 },
  deviceName: { fontFamily: Fonts.interSemiBold, fontSize: 14, color: Colors.textPrimary },
  macAddress: { fontFamily: Fonts.interRegular, fontSize: 11, color: Colors.textMuted },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  online: { backgroundColor: Colors.successLight },
  offline: { backgroundColor: Colors.offlineLight },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  onlineDot: { backgroundColor: Colors.success },
  offlineDot: { backgroundColor: Colors.offline },
  onlineText: { fontFamily: Fonts.interSemiBold, fontSize: 10 },
  onlineLabel: { color: Colors.successDark },
  offlineLabel: { color: Colors.offlineDark },
  statusRow: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLabel: { fontFamily: Fonts.interRegular, fontSize: 12, color: Colors.textMuted },
  statusValue: { fontFamily: Fonts.interSemiBold, fontSize: 12 },
  availableValue: { color: Colors.successDark },
  usedValue: { color: Colors.info },
  babyRow: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 10, padding: 10, backgroundColor: Colors.secondaryLight },
  babyInfo: { flex: 1, gap: 2 },
  babyLabel: { fontFamily: Fonts.interRegular, fontSize: 10, color: Colors.textMuted },
  babyName: { fontFamily: Fonts.interSemiBold, fontSize: 12, color: Colors.textPrimary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingHorizontal: 11, borderWidth: 1 },
  unpairButton: { borderColor: Colors.criticalLight, backgroundColor: Colors.criticalLight },
  unpairText: { fontFamily: Fonts.interSemiBold, fontSize: 11, color: Colors.critical },
  deleteButton: { borderColor: Colors.criticalLight },
  deleteText: { fontFamily: Fonts.interSemiBold, fontSize: 11, color: Colors.critical },
  disabledDelete: { borderColor: Colors.border, backgroundColor: Colors.backgroundNurse },
  disabledDeleteText: { color: Colors.textDisabled },
  deleteHint: { marginTop: -8, fontFamily: Fonts.interRegular, fontSize: 10, color: Colors.textMuted },
  stateBox: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10 },
  stateCard: { minHeight: 180, padding: 24, backgroundColor: Colors.white, borderRadius: Radii.card, alignItems: "center", justifyContent: "center", gap: 10 },
  stateText: { fontFamily: Fonts.interRegular, fontSize: 13, lineHeight: 19, color: Colors.textMuted, textAlign: "center" },
  emptyTitle: { fontFamily: Fonts.interSemiBold, fontSize: 15, color: Colors.textPrimary },
  retryButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.secondary },
  retryText: { fontFamily: Fonts.interSemiBold, fontSize: 12, color: Colors.white },
  feedback: { fontFamily: Fonts.interMedium, fontSize: 12 },
  successFeedback: { color: Colors.successDark },
  errorFeedback: { color: Colors.critical },
  modalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15,23,42,0.52)" },
  confirmCard: { width: "100%", maxWidth: 380, padding: 22, gap: 12, alignItems: "center", borderRadius: 22, backgroundColor: Colors.white, elevation: 10 },
  confirmIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: Colors.criticalLight },
  confirmTitle: { fontFamily: Fonts.interSemiBold, fontSize: 18, color: Colors.textPrimary, textAlign: "center" },
  confirmMessage: { fontFamily: Fonts.interRegular, fontSize: 13, lineHeight: 19, color: Colors.textMuted, textAlign: "center" },
  confirmActions: { width: "100%", flexDirection: "row", gap: 10, marginTop: 4 },
  cancelButton: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: Fonts.interSemiBold, fontSize: 13, color: Colors.textSecondary },
  confirmActionButton: { flex: 1, minHeight: 46, backgroundColor: Colors.critical, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmActionText: { fontFamily: Fonts.interSemiBold, fontSize: 13, color: Colors.white },
});
