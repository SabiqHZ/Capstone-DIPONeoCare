import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Animated,
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
  Pressable,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
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
import { useAllBabyStatuses, useActiveAlerts, useBabyContext } from "../../context/BabyContext";
import { ThemeSwitch, useTheme } from "../../context/ThemeContext";

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
  isDark,
}: {
  baby: BabyWithStatus;
  onPress: () => void;
  isDark: boolean;
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
        isDark && { backgroundColor: "#1F2937" },
        { borderTopColor: borderColor, borderTopWidth: 3 },
        !isOnline && styles.cardOffline,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.cardThumb, isDark && { backgroundColor: "#374151" }]}>
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
        <Text style={[styles.cardName, isDark && { color: "#F9FAFB" }]} numberOfLines={1}>
          {baby.name}
        </Text>
        <Text style={[styles.cardBed, isDark && { color: "#9CA3AF" }]}>Tempat tidur {baby.bed_number}</Text>

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
  const { isDark, toggleMode } = useTheme();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const [babies, setBabies] = useState<BabyWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [isAlertsVisible, setIsAlertsVisible] = useState(false);
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<BabyListFilter>("all");
  const menuIconProgress = useRef(new Animated.Value(0)).current;
  const searchExpansion = useRef(new Animated.Value(0)).current;
  const activeAlerts = useActiveAlerts();
  const { acknowledgeAlert } = useBabyContext();

  useEffect(() => {
    Animated.timing(menuIconProgress, {
      toValue: isMenuVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isMenuVisible, menuIconProgress]);

  useEffect(() => {
    Animated.timing(searchExpansion, {
      toValue: isSearchExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isSearchExpanded, searchExpansion]);

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

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/(auth)/code-entry");
    } catch (error) {
      console.error("[NurseDashboard] Gagal keluar dari akun:", error);
      setIsLogoutConfirmVisible(false);
      Alert.alert("Gagal keluar", "Tidak dapat keluar dari akun. Coba lagi.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    setIsLogoutConfirmVisible(true);
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
    <SafeAreaView style={[styles.safe, isDark && { backgroundColor: "#111827" }]}>
      <View style={[styles.header, isDark && { backgroundColor: "#1F2937", borderBottomColor: "#374151" }]}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => setIsMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Buka menu pengasuh"
          accessibilityState={{ expanded: isMenuVisible }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: menuIconProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "90deg"],
                  }),
                },
              ],
            }}
          >
          <Icon name="menu" size={24} color={isDark ? "#F9FAFB" : Colors.textPrimary} />
          </Animated.View>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.headerSearchBox,
            {
              width: searchExpansion.interpolate({
                inputRange: [0, 1],
                outputRange: [40, Math.max(120, Math.min(240, width - 190))],
              }),
              backgroundColor: searchExpansion.interpolate({
                inputRange: [0, 1],
                outputRange: ["rgba(230, 241, 251, 0)", isDark ? "#263548" : Colors.secondaryLight],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.headerSearchIconButton}
            onPress={() => setIsSearchExpanded((expanded) => !expanded)}
            accessibilityRole="button"
            accessibilityLabel={isSearchExpanded ? "Tutup pencarian" : "Buka pencarian"}
            accessibilityState={{ expanded: isSearchExpanded }}
          >
            <Icon name="search-outline" size={23} color={Colors.textMuted} />
          </TouchableOpacity>
          {isSearchExpanded ? (
            <Animated.View
              style={[
                styles.headerSearchInputWrap,
                { opacity: searchExpansion },
              ]}
            >
              <TextInput
                accessibilityLabel="Cari bayi berdasarkan nama atau nomor tempat tidur"
                placeholder="Cari bayi..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.headerSearchInput}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity
                  style={styles.headerSearchClear}
                  onPress={() => setSearchQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus pencarian"
                >
                  <Icon name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => setIsAlertsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Notifikasi${activeAlerts.length ? `, ${activeAlerts.length} belum ditangani` : ""}`}
        >
          <Icon name="notifications-outline" size={23} color={isDark ? "#F9FAFB" : Colors.textPrimary} />
          {activeAlerts.length > 0 ? <View style={styles.bellDot} /> : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileTrigger}
          onPress={() => setIsProfileMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Buka menu profil pengasuh"
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>{user.name?.trim()?.[0]?.toUpperCase() ?? "P"}</Text>
          </View>
          <Icon name="chevron-down" size={16} color={isDark ? "#9CA3AF" : Colors.textMuted} />
        </TouchableOpacity>
        <ThemeSwitch />
      </View>

      <View style={[styles.summaryBar, isDark && { backgroundColor: "#1F2937", borderBottomColor: "#374151" }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, isDark && { color: "#F9FAFB" }]}>{babies.length}</Text>
          <Text style={[styles.summaryLabel, isDark && { color: "#9CA3AF" }]}>Total Bayi</Text>
        </View>
        <View style={[styles.summaryDivider, isDark && { backgroundColor: "#374151" }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.success }]}>
            {onlineCount}
          </Text>
          <Text style={[styles.summaryLabel, isDark && { color: "#9CA3AF" }]}>Kamera aktif</Text>
        </View>
        <View style={[styles.summaryDivider, isDark && { backgroundColor: "#374151" }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.critical }]}>
            {cryingCount}
          </Text>
          <Text style={[styles.summaryLabel, isDark && { color: "#9CA3AF" }]}>Menangis</Text>
        </View>
        <View style={[styles.summaryDivider, isDark && { backgroundColor: "#374151" }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.warningDark }]}>
            {faceAnomalyCount}
          </Text>
          <Text style={[styles.summaryLabel, isDark && { color: "#9CA3AF" }]}>Perlu diperiksa</Text>
        </View>
      </View>

      {!isLoading && !error && babies.length > 0 ? (
        <View style={[styles.listControls, isDark && { backgroundColor: "#111827" }]}>
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
                  style={[styles.filterChip, isDark && { backgroundColor: "#1F2937", borderColor: "#4B5563" }, selected && styles.filterChipActive]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isDark && { color: "#D1D5DB" },
                      selected && styles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={[styles.loadingText, isDark && { color: "#D1D5DB" }]}>Memuat data bayi...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Icon
            name="wifi-off"
            library="material"
            size={48}
            color={Colors.textDisabled}
          />
          <Text style={[styles.errorText, isDark && { color: "#D1D5DB" }]}>{error}</Text>
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
          <Text style={[styles.emptyTitle, isDark && { color: "#F9FAFB" }]}>Belum Ada Bayi</Text>
          <Text style={[styles.emptyText, isDark && { color: "#9CA3AF" }]}>
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
                isDark={isDark}
                onPress={() => router.push(`/(caregiver)/baby/${baby.id}`)}
              />
            ))
          ) : (
          <View style={[styles.filterEmptyBox, isDark && { backgroundColor: "#111827" }]}>
              <Icon
                name="search-outline"
                library="ionicons"
                size={36}
                color={Colors.textDisabled}
              />
              <Text style={[styles.emptyTitle, isDark && { color: "#F9FAFB" }]}>Bayi tidak ditemukan</Text>
              <Text style={[styles.emptyText, isDark && { color: "#9CA3AF" }]}>
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
              <View style={[styles.dropdownMenu, isDark && { backgroundColor: "#1F2937" }]}>
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
                    <Text style={[styles.dropdownTitle, isDark && { color: "#F9FAFB" }]}>Daftarkan Bayi</Text>
                    <Text style={[styles.dropdownDesc, isDark && { color: "#9CA3AF" }]}>
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
                      { backgroundColor: isDark ? "#26372F" : Colors.primaryLight },
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
                    <Text style={[styles.dropdownTitle, isDark && { color: "#F9FAFB" }]}>
                      Konfigurasi Perangkat
                    </Text>
                    <Text style={[styles.dropdownDesc, isDark && { color: "#9CA3AF" }]}>Atur kamera baru</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Modal
        visible={isProfileMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProfileMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsProfileMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.profileDropdown, isDark && { backgroundColor: "#1F2937" }]}>
                <Text style={[styles.profileDropdownName, isDark && { color: "#F9FAFB" }]}>{user.name}</Text>
                <Text style={[styles.profileDropdownRole, isDark && { color: "#9CA3AF" }]}>Pengasuh</Text>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity
                  style={styles.profileOption}
                  onPress={() => {
                    setIsProfileMenuVisible(false);
                    router.push("/(caregiver)/profile");
                  }}
                  accessibilityRole="button"
                >
                  <Icon name="person-outline" size={19} color={Colors.textSecondary} />
                  <Text style={[styles.profileOptionText, isDark && { color: "#F3F4F6" }]}>Profil</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileOption}
                  onPress={() => {
                    setIsProfileMenuVisible(false);
                    handleLogout();
                  }}
                  accessibilityRole="button"
                >
                  <Icon name="log-out-outline" size={19} color={Colors.critical} />
                  <Text style={[styles.profileOptionText, { color: Colors.critical }]}>Keluar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Modal
        visible={isAlertsVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsAlertsVisible(false)}
      >
        <View style={styles.logoutOverlay}>
          <BlurView
            intensity={85}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.logoutScrim]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup notifikasi"
            style={StyleSheet.absoluteFill}
            onPress={() => setIsAlertsVisible(false)}
          />
              <View style={[styles.alertsCard, isDark && { backgroundColor: "#1F2937" }]} accessibilityViewIsModal>
            <View style={styles.alertsHeader}>
              <View style={styles.alertsHeading}>
                <Text style={styles.logoutTitle}>Notifikasi</Text>
                <Text style={styles.logoutMessage}>{activeAlerts.length} perlu ditangani</Text>
              </View>
              <View style={styles.alertsHeaderActions}>
                <MuteToggle />
                <TouchableOpacity
                  style={styles.alertsCloseButton}
                  onPress={() => setIsAlertsVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Tutup notifikasi"
                >
                  <Icon name="close" size={26} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            {activeAlerts.length === 0 ? (
              <View style={styles.alertsEmpty}>
                <Icon name="notifications-off-outline" size={30} color={Colors.textDisabled} />
                <Text style={styles.alertsEmptyText}>Tidak ada notifikasi baru</Text>
              </View>
            ) : (
              <ScrollView style={styles.alertsList} showsVerticalScrollIndicator={false}>
                {activeAlerts.map((alert) => (
                  <View key={alert.id} style={styles.alertRow}>
                    <View style={[styles.alertSeverityDot, { backgroundColor: alert.severity === "critical" ? Colors.critical : Colors.warning }]} />
                    <TouchableOpacity
                      style={styles.alertCopy}
                      onPress={() => {
                        setIsAlertsVisible(false);
                        router.push(`/(caregiver)/baby/${alert.babyId}`);
                      }}
                    >
                      <Text style={styles.alertBabyName}>{alert.babyName}</Text>
                      <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>
                      <Text style={styles.alertTimestamp}>{new Date(alert.timestamp).toLocaleString("id-ID")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.alertAcknowledge}
                      onPress={() => void acknowledgeAlert(alert.id).catch(() => Alert.alert("Gagal", "Notifikasi belum dapat ditandai."))}
                      accessibilityRole="button"
                      accessibilityLabel={`Tandai notifikasi ${alert.babyName} sudah ditangani`}
                    >
                      <Icon name="checkmark-circle-outline" size={22} color={Colors.success} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={isLogoutConfirmVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isLoggingOut) setIsLogoutConfirmVisible(false);
        }}
      >
        <View style={styles.logoutOverlay}>
          <BlurView
            intensity={85}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.logoutScrim]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup konfirmasi keluar"
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isLoggingOut) setIsLogoutConfirmVisible(false);
            }}
          />
          <View
            style={styles.logoutCard}
            accessibilityViewIsModal
            accessibilityLabel="Konfirmasi keluar akun"
          >
            <View style={styles.logoutTopRow}>
              <View style={styles.logoutIcon}>
                <Icon name="log-out-outline" library="ionicons" size={24} color={Colors.critical} />
              </View>
              <TouchableOpacity
                style={styles.logoutCloseButton}
                onPress={() => setIsLogoutConfirmVisible(false)}
                disabled={isLoggingOut}
                accessibilityRole="button"
                accessibilityLabel="Tutup konfirmasi keluar"
              >
                <Icon name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.logoutTitle}>Keluar dari akun?</Text>
            <Text style={styles.logoutMessage}>
              Apakah Anda yakin ingin keluar dari akun?
            </Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity
                style={styles.logoutCancelButton}
                onPress={() => setIsLogoutConfirmVisible(false)}
                disabled={isLoggingOut}
                accessibilityRole="button"
              >
                <Text style={styles.logoutCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutConfirmButton}
                onPress={() => void confirmLogout()}
                disabled={isLoggingOut}
                accessibilityRole="button"
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.logoutConfirmText}>Keluar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIconButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  headerSearchBox: { minWidth: 40, height: 42, flexDirection: "row", alignItems: "center", borderRadius: 24, overflow: "hidden" },
  headerSearchIconButton: { width: 40, height: 42, alignItems: "center", justifyContent: "center" },
  headerSearchInputWrap: { flex: 1, minWidth: 0, height: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 },
  headerSearchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontFamily: Fonts.interRegular, fontSize: 13, color: Colors.textPrimary },
  headerSearchClear: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.critical, borderWidth: 1, borderColor: Colors.white },
  profileTrigger: { minHeight: 44, marginLeft: "auto", marginRight: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  profileAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: Colors.secondaryLight },
  profileInitial: { fontFamily: Fonts.nunitoBold, fontSize: 16, color: Colors.secondaryDark },
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
  logoutOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logoutScrim: {
    backgroundColor: "rgba(218, 223, 233, 0.3)",
  },
  logoutCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: "stretch",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  logoutTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logoutCloseButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: -8, marginRight: -8 },
  logoutIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.criticalLight,
  },
  logoutTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: "left",
  },
  logoutMessage: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: "left",
  },
  logoutActions: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  logoutCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutCancelText: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  logoutConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.critical,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutConfirmText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.white,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
  dropdownMenu: {
    position: "absolute",
    top: 70,
    left: 12,
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
  profileDropdown: { position: "absolute", top: 72, right: 16, width: 230, backgroundColor: Colors.white, borderRadius: 16, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 8 },
  profileDropdownName: { ...Typography.bodyStrong, color: Colors.textPrimary },
  profileDropdownRole: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  profileOption: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 6 },
  profileOptionText: { ...Typography.body, color: Colors.textPrimary },
  centeredModalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15,23,42,0.38)" },
  profileCard: { width: "100%", maxWidth: 360, alignItems: "center", padding: 24, borderRadius: 20, backgroundColor: Colors.white, gap: 8 },
  profileAvatarLarge: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: Colors.secondaryLight, marginBottom: 4 },
  profileInitialLarge: { fontFamily: Fonts.nunitoBold, fontSize: 28, color: Colors.secondaryDark },
  profileCardName: { ...Typography.h2, color: Colors.textPrimary },
  profileCardRole: { ...Typography.body, color: Colors.textMuted },
  profileInfoRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  profileInfoLabel: { ...Typography.body, color: Colors.textMuted },
  profileInfoValue: { ...Typography.bodyStrong, color: Colors.textPrimary },
  profileDoneButton: { width: "100%", minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: Radii.control, backgroundColor: Colors.secondary, marginTop: 4 },
  profileDoneText: { ...Typography.bodyStrong, color: Colors.white },
  alertsCard: { width: "100%", maxWidth: 380, maxHeight: "80%", padding: 24, borderRadius: 18, backgroundColor: Colors.white, gap: 12, shadowColor: "#000000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  alertsHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  alertsHeading: { flex: 1, gap: 4, paddingTop: 4 },
  alertsHeaderActions: { flexDirection: "row", alignItems: "center" },
  alertsCloseButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  alertsList: { flexGrow: 0 },
  alertRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  alertSeverityDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  alertCopy: { flex: 1, gap: 3 },
  alertBabyName: { ...Typography.bodyStrong, color: Colors.textPrimary },
  alertMessage: { ...Typography.body, color: Colors.textSecondary, lineHeight: 19 },
  alertTimestamp: { ...Typography.caption, color: Colors.textMuted },
  alertAcknowledge: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  alertsEmpty: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 10 },
  alertsEmptyText: { ...Typography.body, color: Colors.textMuted },
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
