import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../stores/auth.store";
import { Icon } from "../../components/ui/Icon";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";
import { ControlSize, Radii, Spacing } from "../../constants/ui";
import { babyService } from "../../services/baby.service";
import { Baby } from "../../types";
import { MuteToggle } from "../../components/ui/MuteToggle";
import { ActionButton } from "../../components/ui/ActionButton";
// INJEKSI REALTIME: Import context
import { useAllBabyStatuses } from "../../context/BabyContext";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

type BabyListFilter = "all" | "crying" | "anomaly" | "offline";

const BABY_LIST_FILTERS: { key: BabyListFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "crying", label: "Menangis" },
  { key: "anomaly", label: "Perlu diperiksa" },
  { key: "offline", label: "Tidak aktif" },
];

interface BabyWithStatus extends Baby {
  baby_statuses?: {
    is_crying: boolean;
    crying_duration_sec: number;
    alert_level: string;
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
  sleeping: "Tidur",
  awake: "Bangun",
  crying: "Menangis",
  unknown: "Menunggu hasil pemantauan",
};
const activityColor: Record<string, string> = {
  sleeping: Colors.success,
  awake: Colors.info,
  crying: Colors.critical,
  unknown: Colors.neutral,
};

function BabyCard({
  baby,
  onPress,
}: {
  baby: BabyWithStatus;
  onPress: () => void;
}) {
  // INJEKSI REALTIME: Membaca status real-time dari context, fallback ke data statis jika context kosong
  const realtimeStatuses = useAllBabyStatuses();
  const activeStatus = realtimeStatuses[baby.id];

  const isOnline = activeStatus
    ? activeStatus.deviceOnline
    : (baby.devices?.is_online ?? false);

  const isCrying =
    activeStatus?.isCrying ?? baby.baby_statuses?.is_crying ?? null;

  const activity =
    activeStatus?.activity ?? baby.baby_statuses?.activity ?? null;

  const faceAnomaly =
    activeStatus?.faceAnomaly ?? baby.baby_statuses?.face_anomaly ?? null;

  const faceCovered = faceAnomaly != null && faceAnomaly !== "none";

  const cryingSec =
    activeStatus?.cryingDurationSec ??
    baby.baby_statuses?.crying_duration_sec ??
    null;

  const activityKey = activity ?? "unknown";

  const borderColor = faceCovered
    ? Colors.warning
    : isCrying
      ? Colors.critical
      : Colors.success;

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
          <View style={[styles.nvPill, { backgroundColor: Colors.warningDark }]}>
            <Icon
              name="eye-off-outline"
              library="ionicons"
              size={10}
              color="#fff"
            />
            <Text style={[styles.nvText, { color: "#fff" }]}>Wajah</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.onlinePill,
            { backgroundColor: isOnline ? Colors.successLight : Colors.offlineLight },
          ]}
        >
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: isOnline ? Colors.success : Colors.offline },
            ]}
          />
          <Text
            style={[
              styles.onlinePillText,
              { color: isOnline ? Colors.successDark : Colors.offlineDark },
            ]}
          >
            {isOnline ? "Aktif" : "Tidak aktif"}
          </Text>
        </View>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {baby.name}
        </Text>
        <Text style={styles.cardBed}>Tempat tidur {baby.bed_number}</Text>

        <View
          style={[
            styles.alertBadge,
            {
              backgroundColor: activityColor[activityKey] + "22",
            },
          ]}
        >
          <Text
            style={[
              styles.alertBadgeText,
              { color: activityColor[activityKey] },
            ]}
          >
            {activityLabel[activityKey]}
          </Text>
        </View>

        {isCrying ? (
          <View style={styles.statItem}>
            <Icon
              name="emoticon-cry-outline"
              library="material"
              size={12}
              color={Colors.critical}
            />
            <Text style={[styles.statText, { color: Colors.critical }]}>
              Menangis
              {cryingSec != null ? ` ${cryingSec}s` : ""}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<BabyListFilter>("all");

  // INJEKSI REALTIME: Untuk Summary Bar
  const realtimeStatuses = useAllBabyStatuses();

  const fetchBabies = useCallback(async () => {
    try {
      setError(null);
      const data = await babyService.getBabies();
      setBabies(data as BabyWithStatus[]);
    } catch {
      setError("Tidak dapat memuat daftar bayi. Periksa koneksi lalu coba lagi.");
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
    router.replace("/(auth)/code-entry");
  };

  // INJEKSI REALTIME: Menghitung rekapitulasi berdasarkan data real-time jika tersedia
  const { cryingCount, faceAnomalyCount, onlineCount } = useMemo(() => {
    let cry = 0;
    let face = 0;
    let online = 0;

    babies.forEach((baby) => {
      const rtStatus = realtimeStatuses[baby.id];
      const isCry = rtStatus
        ? rtStatus.isCrying
        : (baby.baby_statuses?.is_crying ?? false);
      const isFace = rtStatus
        ? rtStatus.faceAnomaly !== "none"
        : Boolean(
            baby.baby_statuses?.face_anomaly &&
            baby.baby_statuses.face_anomaly !== "none",
          );
      const isOn = rtStatus
        ? rtStatus.deviceOnline
        : (baby.devices?.is_online ?? false);

      if (isCry) cry++;
      if (isFace) face++;
      if (isOn) online++;
    });

    return { cryingCount: cry, faceAnomalyCount: face, onlineCount: online };
  }, [babies, realtimeStatuses]);

  // Pencarian dan filter hanya mengubah daftar yang terlihat; data sumber tidak diubah.
  const filteredBabies = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();

    const matchingBabies = babies.filter((baby) => {
      const babyName = (baby.name ?? "").toLocaleLowerCase();
      const bedNumber = String(baby.bed_number ?? "").toLocaleLowerCase();
      const matchesSearch =
        !query ||
        babyName.includes(query) ||
        bedNumber.includes(query) ||
        `bed ${bedNumber}`.includes(query);

      if (!matchesSearch) return false;
      if (activeFilter === "all") return true;

      const rtStatus = realtimeStatuses[baby.id];
      const isCrying =
        rtStatus?.isCrying ?? baby.baby_statuses?.is_crying ?? false;
      const faceAnomaly =
        rtStatus?.faceAnomaly ?? baby.baby_statuses?.face_anomaly ?? null;
      const isFaceAnomaly =
        faceAnomaly != null && faceAnomaly !== "none";
      const isOnline = rtStatus
        ? rtStatus.deviceOnline
        : (baby.devices?.is_online ?? false);

      if (activeFilter === "crying") return Boolean(isCrying);
      if (activeFilter === "anomaly") return isFaceAnomaly;
      if (activeFilter === "offline") return !isOnline;
      return true;
    });

    // Urutkan bayi yang paling membutuhkan perhatian terlebih dahulu.
    // Tingkat prioritas: menangis + anomali, menangis, anomali, lalu kondisi lain.
    // Urutan awal dipertahankan jika tingkat prioritas sama.
    return matchingBabies
      .map((baby, originalIndex) => {
        const rtStatus = realtimeStatuses[baby.id];
        const isCrying = Boolean(
          rtStatus?.isCrying ?? baby.baby_statuses?.is_crying ?? false,
        );
        const faceAnomaly =
          rtStatus?.faceAnomaly ?? baby.baby_statuses?.face_anomaly ?? null;
        const hasFaceAnomaly =
          faceAnomaly != null && faceAnomaly !== "none";
        const priority = isCrying && hasFaceAnomaly
          ? 3
          : isCrying
            ? 2
            : hasFaceAnomaly
              ? 1
              : 0;

        return { baby, originalIndex, priority };
      })
      .sort(
        (a, b) =>
          b.priority - a.priority || a.originalIndex - b.originalIndex,
      )
      .map(({ baby }) => baby);
  }, [babies, searchQuery, activeFilter, realtimeStatuses]);

  if (!user || user.role !== "caregiver") return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Beranda</Text>
          <Text style={styles.headerSub}>{user.name}</Text>
        </View>

        <View style={styles.headerRight}>
          <MuteToggle />

          {cryingCount > 0 || faceAnomalyCount > 0 ? (
            <View style={styles.criticalBadge}>
              <Icon
                name="alert-circle"
                library="ionicons"
                size={14}
                color={Colors.white}
              />
              <Text style={styles.criticalBadgeText}>
                {String(cryingCount + faceAnomalyCount)}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Tambah bayi atau kamera"
            accessibilityHint="Membuka menu pendaftaran bayi dan konfigurasi kamera"
          >
            <Icon
              name="add-circle"
              library="ionicons"
              size={30}
              color={Colors.secondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Keluar dari akun"
            accessibilityHint="Mengakhiri sesi pengasuh"
          >
            <Icon
              name="log-out-outline"
              library="ionicons"
              size={24}
              color={Colors.textMuted}
            />
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
          <Text style={[styles.summaryNum, { color: Colors.success }]}>
            {onlineCount}
          </Text>
          <Text style={styles.summaryLabel}>Kamera aktif</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.critical }]}>
            {cryingCount}
          </Text>
          <Text style={styles.summaryLabel}>Menangis</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.warningDark }]}>
            {faceAnomalyCount}
          </Text>
          <Text style={styles.summaryLabel}>Perlu diperiksa</Text>
        </View>
      </View>

      {!isLoading && !error && babies.length > 0 ? (
        <View style={styles.listControls}>
          <View style={styles.searchBox}>
            <Icon
              name="search-outline"
              library="ionicons"
              size={18}
              color={Colors.textMuted}
            />
            <TextInput
              accessibilityLabel="Cari bayi berdasarkan nama atau nomor tempat tidur"
              placeholder="Cari nama atau nomor tempat tidur..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                accessibilityRole="button"
                accessibilityLabel="Hapus pencarian"
                accessibilityHint="Mengosongkan kata pencarian bayi"
                onPress={() => setSearchQuery("")}
              >
                <Icon
                  name="close-circle"
                  library="ionicons"
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {BABY_LIST_FILTERS.map((filter) => {
              const selected = activeFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveFilter(filter.key)}
                  style={[styles.filterChip, selected && styles.filterChipActive]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.priorityHint}>
            Bayi yang menangis atau memiliki kondisi wajah yang perlu diperiksa ditampilkan lebih dahulu.
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Memuat data bayi...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Icon
            name="wifi-off"
            library="material"
            size={48}
            color={Colors.textDisabled}
          />
          <Text style={styles.errorText}>{error}</Text>
          <ActionButton
            variant="caregiver"
            style={styles.retryBtn}
            onPress={fetchBabies}
          >
            <Text style={styles.retryText}>Coba Lagi</Text>
          </ActionButton>
        </View>
      ) : babies.length === 0 ? (
        <View style={styles.centerBox}>
          <Icon
            name="baby-face-outline"
            library="material"
            size={64}
            color={Colors.textDisabled}
          />
          <Text style={styles.emptyTitle}>Belum Ada Bayi</Text>
          <Text style={styles.emptyText}>
            Tap tombol + untuk mendaftarkan bayi baru
          </Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            onPress={() => router.push("/(caregiver)/register-baby")}
          >
            <Icon
              name="add-circle-outline"
              library="ionicons"
              size={18}
              color={Colors.white}
            />
            <Text style={styles.addFirstBtnText}>Daftarkan Bayi Pertama</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            filteredBabies.length > 0 ? styles.grid : styles.resultsEmptyContainer
          }
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
          {filteredBabies.length > 0 ? (
            filteredBabies.map((baby) => (
              <BabyCard
                key={baby.id}
                baby={baby}
                onPress={() => router.push(`/(caregiver)/baby/${baby.id}`)}
              />
            ))
          ) : (
            <View style={styles.filterEmptyBox}>
              <Icon
                name="search-outline"
                library="ionicons"
                size={36}
                color={Colors.textDisabled}
              />
              <Text style={styles.emptyTitle}>Bayi tidak ditemukan</Text>
              <Text style={styles.emptyText}>
                Coba ubah kata pencarian atau pilih filter lain.
              </Text>
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setSearchQuery("");
                  setActiveFilter("all");
                }}
              >
                <Text style={styles.retryText}>Hapus Pencarian dan Filter</Text>
              </TouchableOpacity>
            </View>
          )}
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
                    router.push("/(caregiver)/register-baby");
                  }}
                >
                  <View style={styles.dropdownIconBox}>
                    <Icon
                      name="person-add-outline"
                      library="ionicons"
                      size={20}
                      color={Colors.secondaryDark}
                    />
                  </View>
                  <View>
                    <Text style={styles.dropdownTitle}>Daftarkan Bayi</Text>
                    <Text style={styles.dropdownDesc}>
                      Tambah profil bayi baru
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.dropdownDivider} />

                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setIsMenuVisible(false);
                    router.push("/(caregiver)/device-setup");
                  }}
                >
                  <View
                    style={[
                      styles.dropdownIconBox,
                      { backgroundColor: Colors.primaryLight },
                    ]}
                  >
                    <Icon
                      name="hardware-chip-outline"
                      library="ionicons"
                      size={20}
                      color={Colors.primaryDark}
                    />
                  </View>
                  <View>
                    <Text style={styles.dropdownTitle}>
                      Konfigurasi Perangkat
                    </Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.secondaryDark,
  },
  headerSub: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  criticalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.critical,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  criticalBadgeText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  addBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  logoutBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  clearSearchBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  summaryBar: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryNum: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  summaryLabel: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textMuted,
  },
  summaryDivider: {
    width: 1,
    height: "80%",
    backgroundColor: Colors.border,
    alignSelf: "center",
  },
  listControls: {
    backgroundColor: Colors.backgroundNurse,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchBox: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    minHeight: ControlSize.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  filterChipText: {
    fontFamily: Fonts.interMedium,
    fontSize: 12,
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  priorityHint: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
    paddingBottom: 2,
  },
  resultsEmptyContainer: {
    flexGrow: 1,
  },
  filterEmptyBox: {
    flex: 1,
    minHeight: 220,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  resetFilterBtn: {
    backgroundColor: Colors.secondary,
    minHeight: ControlSize.minTouchTarget,
    justifyContent: "center",
    borderRadius: Radii.control,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 16, gap: 16 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  faceWarning: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    color: Colors.warningDark,
  },
  cardOffline: { opacity: 0.6 },
  cardThumb: {
    height: 110,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  nvPill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1a1a2e",
    borderRadius: Radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  nvText: { fontFamily: Fonts.interMedium, fontSize: 9, color: "#a78bfa" },
  onlinePill: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlinePillText: { fontFamily: Fonts.interMedium, fontSize: 9 },
  cardInfo: { padding: Spacing.md, gap: Spacing.sm },
  cardName: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  cardBed: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  alertBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  alertBadgeText: { fontFamily: Fonts.interSemiBold, fontSize: 10 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: {
    fontFamily: Fonts.interMedium,
    fontSize: 11,
    color: Colors.textMuted,
  },
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
    alignSelf: "center",
    marginTop: 8,
  },
  retryText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.white,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
  },
  addFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  addFirstBtnText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 14,
    color: Colors.white,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
  dropdownMenu: {
    position: "absolute",
    top: 70,
    right: 20,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 8,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
  },
  dropdownIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.secondaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  dropdownDesc: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textMuted,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
    marginHorizontal: 8,
  },
});
