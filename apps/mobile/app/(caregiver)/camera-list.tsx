import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

type PairableBaby = {
  id: string;
  name: string;
  bed_number: string;
  devices?: Array<{ id: string }> | { id: string } | null;
};

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
  const [pairingCameraId, setPairingCameraId] = useState<string | null>(null);
  const [pairableBabies, setPairableBabies] = useState<PairableBaby[]>([]);
  const [isLoadingBabies, setIsLoadingBabies] = useState(false);
  const [editingDevice, setEditingDevice] = useState<ManagedDevice | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

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

  const counts = useMemo(
    () => ({
      total: devices.length,
      available: devices.filter((device) => !device.baby_id).length,
      used: devices.filter((device) => Boolean(device.baby_id)).length,
    }),
    [devices],
  );

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

  const openNameEditor = (device: ManagedDevice) => {
    setEditedName(device.name ?? "");
    setEditNameError("");
    setEditingDevice(device);
  };

  const saveDeviceName = async () => {
    const name = editedName.trim();
    if (!name) {
      setEditNameError("Nama kamera wajib diisi.");
      return;
    }
    if (name.length > 40) {
      setEditNameError("Maksimal 40 karakter.");
      return;
    }
    if (!editingDevice) return;

    setIsSavingName(true);
    setEditNameError("");
    try {
      await deviceService.updateDeviceName(editingDevice.id, name);
      setDevices((current) =>
        current.map((device) =>
          device.id === editingDevice.id ? { ...device, name } : device,
        ),
      );
      setEditingDevice(null);
      setFeedback("Nama kamera diperbarui.");
      setFeedbackIsError(false);
    } catch (err: any) {
      setEditNameError(err.response?.data?.error || "Nama kamera gagal disimpan.");
    } finally {
      setIsSavingName(false);
    }
  };

  const toggleBabyPicker = async (deviceId: string) => {
    if (pairingCameraId === deviceId) {
      setPairingCameraId(null);
      return;
    }

    setPairingCameraId(deviceId);
    setPairableBabies([]);
    setIsLoadingBabies(true);
    setFeedback("");
    try {
      const babies = (await babyService.getBabies()) as PairableBaby[];
      setPairableBabies(
        babies.filter((baby) => {
          const linkedDevices = Array.isArray(baby.devices)
            ? baby.devices
            : baby.devices
              ? [baby.devices]
              : [];
          return linkedDevices.length === 0;
        }),
      );
    } catch (err: any) {
      setFeedback(err.response?.data?.error || "Daftar bayi gagal dimuat.");
      setFeedbackIsError(true);
      setPairingCameraId(null);
    } finally {
      setIsLoadingBabies(false);
    }
  };

  const pairCamera = async (device: ManagedDevice, baby: PairableBaby) => {
    setBusyId(device.id);
    setFeedback("");
    try {
      await babyService.pairDevice(baby.id, device.id);
      setPairingCameraId(null);
      await loadDevices(true);
      setFeedback(`Kamera dipasang ke ${baby.name}.`);
      setFeedbackIsError(false);
    } catch (err: any) {
      setFeedback(err.response?.data?.error || "Kamera gagal dipasang.");
      setFeedbackIsError(true);
    } finally {
      setBusyId(null);
    }
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
        setFeedback(
          `Kamera berhasil dilepas dari ${device.baby?.name || "bayi"}.`,
        );
      } else {
        await deviceService.deleteDevice(device.id);
        setDevices((current) =>
          current.filter((item) => item.id !== device.id),
        );
        setFeedback("Kamera berhasil dihapus dari daftar.");
      }
      setFeedbackIsError(false);
    } catch (err: any) {
      setFeedback(
        err.response?.data?.error || "Tindakan gagal. Silakan coba lagi.",
      );
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
          <Icon
            name="arrow-back"
            library="ionicons"
            size={22}
            color={isDark ? "#BFDBFE" : Colors.secondaryDark}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && dark.heading]}>
          Daftar Kamera
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadDevices(true)}
          accessibilityRole="button"
          accessibilityLabel="Muat ulang daftar kamera"
        >
          <Icon
            name="refresh-outline"
            library="ionicons"
            size={20}
            color={isDark ? "#BFDBFE" : Colors.secondaryDark}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isDark && dark.page]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadDevices(true)}
            colors={[Colors.secondary]}
          />
        }
      >
        <Text style={[styles.description, isDark && dark.muted]}>
          Status kamera dan pemasangannya.
        </Text>

        {feedback ? (
          <Text
            style={[
              styles.feedback,
              feedbackIsError ? styles.errorFeedback : styles.successFeedback,
              isDark && dark.body,
            ]}
          >
            {feedback}
          </Text>
        ) : null}

        <View style={styles.summaryRow}>
          <SummaryCard
            label="Total"
            value={counts.total}
            icon="videocam-outline"
            isDark={isDark}
          />
          <SummaryCard
            label="Tersedia"
            value={counts.available}
            icon="checkmark-circle-outline"
            tone="success"
            isDark={isDark}
          />
          <SummaryCard
            label="Terpasang"
            value={counts.used}
            icon="link-outline"
            tone="info"
            isDark={isDark}
          />
        </View>

        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={Colors.secondary} />
            <Text style={[styles.stateText, isDark && dark.muted]}>
              Memuat daftar kamera…
            </Text>
          </View>
        ) : error ? (
          <View style={[styles.stateCard, isDark && dark.surface]}>
            <Icon
              name="alert-circle-outline"
              library="ionicons"
              size={32}
              color={Colors.critical}
            />
            <Text style={[styles.stateText, isDark && dark.body]}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadDevices()}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Coba lagi</Text>
            </TouchableOpacity>
          </View>
        ) : devices.length === 0 ? (
          <View style={[styles.stateCard, isDark && dark.surface]}>
            <Icon
              name="videocam-off-outline"
              library="ionicons"
              size={34}
              color={Colors.textMuted}
            />
            <Text style={[styles.emptyTitle, isDark && dark.heading]}>
              Belum ada kamera
            </Text>
            <Text style={[styles.stateText, isDark && dark.muted]}>
              Daftarkan kamera untuk mulai.
            </Text>
          </View>
        ) : (
          <View style={[styles.table, isDark && dark.surface]}>
            <View style={[styles.tableHeader, isDark && dark.tableDivider]}>
              <Text
                style={[
                  styles.headerCamera,
                  styles.columnHeading,
                  isDark && dark.muted,
                ]}
              >
                Kamera
              </Text>
              <Text
                style={[
                  styles.headerInstall,
                  styles.columnHeading,
                  isDark && dark.muted,
                ]}
              >
                Status
              </Text>
              <Text
                style={[
                  styles.headerOnline,
                  styles.columnHeading,
                  isDark && dark.muted,
                ]}
              >
                Aktif
              </Text>
              <Text
                style={[
                  styles.headerBaby,
                  styles.columnHeading,
                  isDark && dark.muted,
                ]}
              >
                Identitas Bayi
              </Text>
              <Text
                style={[
                  styles.headerAction,
                  styles.columnHeading,
                  isDark && dark.muted,
                ]}
              >
                Aksi
              </Text>
            </View>
            {devices.map((device, index) => {
              const isUsed = Boolean(device.baby_id);
              const isBusy = busyId === device.id;
              return (
                <View key={device.id}>
                  <View
                    style={[
                      styles.tableRow,
                      (index < devices.length - 1 ||
                        pairingCameraId === device.id) &&
                        styles.tableRowDivider,
                      isDark && dark.tableDivider,
                    ]}
                  >
                    <View style={styles.headerCamera}>
                      <View style={styles.cameraNameCell}>
                        <Text
                          style={[styles.deviceName, isDark && dark.heading]}
                          numberOfLines={2}
                        >
                          {device.name || "Kamera"}
                        </Text>
                        <TouchableOpacity
                          style={styles.editNameButton}
                          onPress={() => openNameEditor(device)}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit nama kamera ${device.name || "ini"}`}
                          accessibilityHint="Membuka kolom untuk mengubah nama kamera"
                        >
                          <Icon
                            name="create-outline"
                            library="ionicons"
                            size={14}
                            color={isDark ? "#BFDBFE" : Colors.secondaryDark}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={[styles.headerInstall, styles.centerCell]}>
                      <Text
                        style={[
                          styles.tableValue,
                          isUsed ? styles.usedValue : styles.availableValue,
                          isDark &&
                            (isUsed ? dark.usedValue : dark.availableValue),
                        ]}
                      >
                        {isUsed ? "Terpasang" : "Tersedia"}
                      </Text>
                    </View>
                    <View style={[styles.headerOnline, styles.centerCell]}>
                      <View
                        style={[
                          styles.statusDot,
                          device.is_online
                            ? styles.onlineDot
                            : styles.offlineDot,
                        ]}
                      />
                      <Text
                        style={[
                          styles.tableValue,
                          device.is_online
                            ? styles.onlineLabel
                            : styles.offlineLabel,
                          isDark &&
                            (device.is_online
                              ? dark.onlineLabel
                              : dark.offlineLabel),
                        ]}
                      >
                        {device.is_online ? "Aktif" : "Mati"}
                      </Text>
                    </View>
                    <View style={styles.headerBaby}>
                      {device.baby ? (
                        <>
                          <Text
                            style={[styles.bedNumber, isDark && dark.heading]}
                            numberOfLines={1}
                          >
                            {device.baby.bed_number || "—"}
                          </Text>
                          <Text
                            style={[styles.babyName, isDark && dark.muted]}
                            numberOfLines={2}
                          >
                            {device.baby.name}
                          </Text>
                        </>
                      ) : (
                        <Text style={[styles.unassigned, isDark && dark.muted]}>
                          —
                        </Text>
                      )}
                    </View>
                    <View style={[styles.headerAction, styles.actionStack]}>
                      {isUsed ? (
                        <TouchableOpacity
                          style={[styles.rowAction, styles.unpairButton]}
                          onPress={() => confirmUnpair(device)}
                          disabled={isBusy}
                          accessibilityRole="button"
                          accessibilityLabel={`Lepaskan kamera dari ${device.baby?.name || "bayi"}`}
                        >
                          {isBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={Colors.critical}
                            />
                          ) : null}
                          <Text style={styles.rowActionText}>Lepaskan</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.rowAction, styles.pairButton]}
                            onPress={() => void toggleBabyPicker(device.id)}
                            disabled={isBusy}
                            accessibilityRole="button"
                            accessibilityLabel="Pasang kamera ke bayi"
                            accessibilityHint="Pilih bayi yang belum memiliki kamera"
                          >
                            <Icon
                              name="add-circle-outline"
                              library="ionicons"
                              size={13}
                              color={Colors.secondaryDark}
                            />
                            <Text style={styles.pairText}>Pasang</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.rowAction, styles.deleteButton]}
                            onPress={() => confirmDelete(device)}
                            disabled={isBusy}
                            accessibilityRole="button"
                            accessibilityLabel={`Hapus kamera ${device.name || "ini"}`}
                          >
                            {isBusy ? (
                              <ActivityIndicator
                                size="small"
                                color={Colors.critical}
                              />
                            ) : (
                              <Icon
                                name="trash-outline"
                                library="ionicons"
                                size={13}
                                color={Colors.critical}
                              />
                            )}
                            <Text style={styles.rowActionText}>Hapus</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                  {!isUsed && pairingCameraId === device.id ? (
                    <View
                      style={[styles.babyPicker, isDark && dark.pickerSurface]}
                    >
                      {isLoadingBabies ? (
                        <ActivityIndicator color={Colors.secondary} />
                      ) : pairableBabies.length ? (
                        <>
                          <Text
                            style={[styles.pickerTitle, isDark && dark.heading]}
                          >
                            Pilih bayi
                          </Text>
                          {pairableBabies.map((baby) => (
                            <TouchableOpacity
                              key={baby.id}
                              style={[
                                styles.babyOption,
                                isDark && dark.babyOption,
                              ]}
                              onPress={() => void pairCamera(device, baby)}
                              disabled={isBusy}
                              accessibilityRole="button"
                              accessibilityLabel={`Pasang kamera ke ${baby.name}`}
                            >
                              <View style={styles.babyOptionText}>
                                <Text
                                  style={[
                                    styles.babyOptionName,
                                    isDark && dark.heading,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {baby.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.babyOptionBed,
                                    isDark && dark.muted,
                                  ]}
                                  numberOfLines={1}
                                >
                                  Tempat tidur {baby.bed_number}
                                </Text>
                              </View>
                              {isBusy ? (
                                <ActivityIndicator
                                  size="small"
                                  color={Colors.secondary}
                                />
                              ) : (
                                <Icon
                                  name="chevron-forward"
                                  library="ionicons"
                                  size={18}
                                  color={
                                    isDark ? "#BFDBFE" : Colors.secondaryDark
                                  }
                                />
                              )}
                            </TouchableOpacity>
                          ))}
                        </>
                      ) : (
                        <Text
                          style={[styles.noBabiesText, isDark && dark.muted]}
                        >
                          Semua bayi sudah memiliki kamera.
                        </Text>
                      )}
                    </View>
                  ) : null}
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
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPendingAction(null)}
          />
          <View
            style={[styles.confirmCard, isDark && dark.surface]}
            accessibilityViewIsModal
          >
            <View style={styles.confirmIcon}>
              <Icon
                name={
                  pendingAction?.type === "delete"
                    ? "trash-outline"
                    : "unlink-outline"
                }
                library={
                  pendingAction?.type === "delete" ? "ionicons" : "material"
                }
                size={25}
                color={Colors.critical}
              />
            </View>
            <Text style={[styles.confirmTitle, isDark && dark.heading]}>
              {pendingAction?.type === "delete"
                ? "Hapus kamera?"
                : "Lepaskan kamera?"}
            </Text>
            <Text style={[styles.confirmMessage, isDark && dark.body]}>
              {pendingAction?.type === "delete"
                ? `Perangkat perlu mendaftar kembali untuk digunakan lagi.`
                : `Kamera akan dilepas dari ${pendingAction?.device.baby?.name || "bayi yang terhubung"}.`}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.cancelButton, isDark && dark.cancelButton]}
                onPress={() => setPendingAction(null)}
                disabled={busyId !== null}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelText, isDark && dark.body]}>
                  Batal
                </Text>
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
                    {pendingAction?.type === "delete"
                      ? "Hapus kamera"
                      : "Lepaskan"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(editingDevice)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isSavingName) setEditingDevice(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isSavingName) setEditingDevice(null);
            }}
          />
          <View
            style={[styles.editNameCard, isDark && dark.surface]}
            accessibilityViewIsModal
          >
            <View style={styles.editNameIcon}>
              <Icon
                name="create-outline"
                library="ionicons"
                size={24}
                color={Colors.secondaryDark}
              />
            </View>
            <Text style={[styles.editNameTitle, isDark && dark.heading]}>
              Edit nama kamera
            </Text>
            <TextInput
              style={[styles.editNameInput, isDark && dark.editInput]}
              value={editedName}
              onChangeText={(value) => {
                setEditedName(value.slice(0, 40));
                setEditNameError("");
              }}
              placeholder="Nama kamera"
              placeholderTextColor={isDark ? "#9CA3AF" : Colors.textMuted}
              maxLength={40}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void saveDeviceName()}
              accessibilityLabel="Nama kamera"
            />
            {editNameError ? (
              <Text style={styles.editNameError}>{editNameError}</Text>
            ) : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.cancelButton, isDark && dark.cancelButton]}
                onPress={() => setEditingDevice(null)}
                disabled={isSavingName}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelText, isDark && dark.body]}>
                  Batal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editNameSaveButton}
                onPress={() => void saveDeviceName()}
                disabled={isSavingName || !editedName.trim()}
                accessibilityRole="button"
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.editNameSaveText}>Simpan</Text>
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
  const iconColor =
    tone === "success"
      ? Colors.success
      : tone === "info"
        ? Colors.info
        : Colors.secondaryDark;
  return (
    <View style={[styles.summaryCard, isDark && dark.surface]}>
      <Icon
        name={icon}
        library="ionicons"
        size={18}
        color={isDark ? "#BFDBFE" : iconColor}
      />
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
  tableDivider: { borderBottomColor: "#374151" },
  availableValue: { color: "#86EFAC" },
  usedValue: { color: "#93C5FD" },
  onlineLabel: { color: "#86EFAC" },
  offlineLabel: { color: "#9CA3AF" },
  iconSurface: { backgroundColor: "#263548" },
  babyRow: { backgroundColor: "#263548" },
  pickerSurface: { backgroundColor: "#1F2937", borderColor: "#374151" },
  babyOption: { backgroundColor: "#263548", borderColor: "#374151" },
  editInput: { backgroundColor: "#111827", color: "#F9FAFB", borderColor: "#4B5563" },
  cancelButton: { backgroundColor: "#1F2937", borderColor: "#4B5563" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.secondaryDark,
    flex: 1,
    textAlign: "center",
  },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  description: {
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: {
    flex: 1,
    minHeight: 98,
    padding: 10,
    gap: 5,
    borderRadius: Radii.card,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  summaryValue: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  summaryLabel: {
    fontFamily: Fonts.interMedium,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  table: {
    overflow: "hidden",
    borderRadius: Radii.card,
    backgroundColor: Colors.white,
    elevation: 1,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  tableRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerCamera: { flex: 1.2, minWidth: 0, paddingRight: 2 },
  headerInstall: { flex: 0.98, minWidth: 0, paddingHorizontal: 1 },
  headerOnline: { flex: 0.92, minWidth: 0, paddingHorizontal: 1 },
  headerBaby: { flex: 1.22, minWidth: 0, paddingHorizontal: 2 },
  headerAction: { flex: 1.48, minWidth: 0 },
  columnHeading: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    lineHeight: 12,
    color: Colors.textMuted,
    textAlign: "center",
  },
  centerCell: { alignItems: "center", justifyContent: "center", gap: 4 },
  deviceName: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    lineHeight: 13,
    color: Colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  cameraNameCell: { flexDirection: "row", alignItems: "center", gap: 1 },
  editNameButton: { width: 22, height: 28, alignItems: "center", justifyContent: "center" },
  tableValue: {
    fontFamily: Fonts.interMedium,
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  onlineDot: { backgroundColor: Colors.success },
  offlineDot: { backgroundColor: Colors.offline },
  onlineLabel: { color: Colors.successDark },
  offlineLabel: { color: Colors.offlineDark },
  availableValue: { color: Colors.successDark },
  usedValue: { color: Colors.info },
  bedNumber: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    lineHeight: 13,
    color: Colors.textPrimary,
  },
  babyName: {
    fontFamily: Fonts.interRegular,
    fontSize: 9,
    lineHeight: 12,
    color: Colors.textMuted,
  },
  unassigned: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
  },
  actionStack: { alignItems: "stretch", justifyContent: "center", gap: 4 },
  rowAction: {
    minHeight: 28,
    width: "100%",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  unpairButton: {
    borderColor: Colors.criticalLight,
    backgroundColor: Colors.criticalLight,
  },
  pairButton: {
    borderColor: Colors.secondaryLight,
    backgroundColor: Colors.secondaryLight,
  },
  deleteButton: {
    borderColor: Colors.criticalLight,
    backgroundColor: "#FFF8F7",
  },
  rowActionText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 8,
    lineHeight: 10,
    color: Colors.critical,
    textAlign: "center",
  },
  pairText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 8,
    lineHeight: 10,
    color: Colors.secondaryDark,
    textAlign: "center",
  },
  babyPicker: {
    padding: 10,
    gap: 6,
    backgroundColor: "#F3F7FC",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  babyOption: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  babyOptionText: { flex: 1, gap: 2 },
  babyOptionName: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  babyOptionBed: {
    fontFamily: Fonts.interRegular,
    fontSize: 9,
    color: Colors.textMuted,
  },
  noBabiesText: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  stateBox: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  stateCard: {
    minHeight: 180,
    padding: 24,
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  stateText: {
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
    textAlign: "center",
  },
  emptyTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  retryButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
  },
  retryText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  feedback: { fontFamily: Fonts.interMedium, fontSize: 12 },
  successFeedback: { color: Colors.successDark },
  errorFeedback: { color: Colors.critical },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15,23,42,0.52)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 380,
    padding: 22,
    gap: 12,
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: Colors.white,
    elevation: 10,
  },
  confirmIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.criticalLight,
  },
  confirmTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  confirmMessage: {
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
    textAlign: "center",
  },
  confirmActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  confirmActionButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: Colors.critical,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmActionText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.white,
  },
  editNameCard: {
    width: "100%",
    maxWidth: 380,
    padding: 22,
    gap: 12,
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: Colors.white,
    elevation: 10,
  },
  editNameIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondaryLight,
  },
  editNameTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 17,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  editNameInput: {
    width: "100%",
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  editNameError: {
    alignSelf: "flex-start",
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.critical,
  },
  editNameSaveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondary,
  },
  editNameSaveText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.white,
  },
});
