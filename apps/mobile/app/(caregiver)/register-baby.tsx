import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
} from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { Icon } from "../../components/ui/Icon";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";
import { ControlSize, Radii, Spacing } from "../../constants/ui";
import { babyService } from "../../services/baby.service";
import api from "../../services/api"; // Pastikan path ini benar sesuai strukturmu
import { RegisteredBaby } from "../../types";
import { SuccessModal } from "../../components/ui/SuccessModal";
import { useTheme } from "../../context/ThemeContext";

interface BabyForm {
  name: string;
  bedNumber: string;
  dateOfBirth: string;
  parentName: string;
  deviceId: string; // Tambahan state untuk kamera
}

interface Device {
  id: string;
  mac_address: string;
  name: string;
}
const formatDateInput = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${date.getFullYear()}`;
};

const parseDateInput = (value: string): Date | null => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const isValidJakartaDate = (value: string): boolean => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (year < 1900 || year > new Date().getFullYear()) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const dateInputToApiDate = (value: string): string => {
  const [day, month, year] = value.split("/");

  return `${year}-${month}-${day}`;
};

export default function RegisterBabyScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [form, setForm] = useState<BabyForm>({
    name: "",
    bedNumber: "A-00",
    dateOfBirth: "",
    parentName: "",
    deviceId: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [registeredBaby, setRegisteredBaby] = useState<RegisteredBaby | null>(
    null,
  );
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<"date" | "camera" | null>(null);

  // State untuk Dropdown Kamera
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch daftar kamera yang nganggur saat halaman dimuat
  useEffect(() => {
    fetchAvailableDevices();
  }, []);

  const fetchAvailableDevices = async () => {
    setIsLoadingDevices(true);
    try {
      const response = await api.get("/devices/available");
      if (response.data.success) {
        setAvailableDevices(response.data.data);
      }
    } catch (error) {
      console.error("Gagal mengambil daftar kamera:", error);
      Alert.alert("Gagal", "Tidak dapat memuat daftar kamera.");
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchAvailableDevices();
    } finally {
      setIsRefreshing(false);
    }
  };

  const update = (key: keyof BabyForm, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const updateBedPart = (part: 0 | 1 | 2, value: string) =>
    setForm((current) => {
      const [letter = "", digits = ""] = current.bedNumber.split("-");
      const digitParts = [digits[0] ?? "", digits[1] ?? ""];

      if (part === 0) {
        return {
          ...current,
          bedNumber: `${value.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase()}-${digits}`,
        };
      }

      digitParts[part - 1] = value.replace(/\D/g, "").slice(-1);
      return { ...current, bedNumber: `${letter}-${digitParts.join("")}` };
    });

  const openDatePicker = () => {
    const initialDate = parseDateInput(form.dateOfBirth) ?? new Date();
    const maximumDate = new Date();
    setPickerDate(initialDate);
    setFocusedField("date");

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: "date",
        display: "calendar",
        minimumDate: new Date(1900, 0, 1),
        maximumDate,
        firstDayOfWeek: 1,
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            update("dateOfBirth", formatDateInput(selectedDate));
          }
          setFocusedField(null);
        },
      });
      return;
    }

    setIsDatePickerVisible(true);
  };

  const isValid =
    form.name.trim() !== "" &&
    /^[A-Z]-\d{2}$/.test(form.bedNumber) &&
    form.dateOfBirth.trim() !== "" &&
    form.parentName.trim() !== "" &&
    form.deviceId !== ""; // Wajib pilih kamera

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert(
        "Lengkapi Data",
        "Semua data termasuk pilihan kamera wajib diisi.",
      );
      return;
    }

    if (!isValidJakartaDate(form.dateOfBirth)) {
      Alert.alert(
        "Tanggal Tidak Valid",
        "Masukkan tanggal lahir yang valid dengan format DD/MM/YYYY.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const apiDate = dateInputToApiDate(form.dateOfBirth);

      // 1. Daftarkan Bayi
      const baby = await babyService.registerBaby({
        name: form.name.trim(),
        bedNumber: form.bedNumber.trim(),
        dateOfBirth: apiDate,
        parentName: form.parentName.trim(),
      });

      // 2. Pair Perangkat secara otomatis
      await babyService.pairDevice(baby.id, form.deviceId);

      // Tandai sukses
      setRegisteredBaby(baby);
      setIsSuccessModalVisible(true);
    } catch {
      Alert.alert(
        "Gagal mendaftarkan bayi",
        "Periksa kembali data dan koneksi Anda, lalu coba lagi.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Tampilan sukses ───────────────────────────────────────────────
  if (registeredBaby) {
    return (
      <SafeAreaView style={[styles.safe, isDark && { backgroundColor: "#111827" }]}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successIconWrapper}>
            <Icon
              name="checkmark-circle"
              library="ionicons"
              size={72}
              color={Colors.primary}
            />
          </View>

          <Text style={[styles.successTitle, isDark && { color: "#A7F3D0" }]}>Bayi & Kamera Tersambung!</Text>
          <Text style={[styles.successSub, isDark && { color: "#9CA3AF" }]}>
            Sistem pemantauan aktif. Berikan kode berikut kepada orang tua.
          </Text>

          <View style={[styles.codeBox, isDark && { backgroundColor: "#26372F" }]}>
            <Text style={styles.codeLabel}>KODE AKSES ORANG TUA</Text>
            <Text style={styles.codeValue}>{registeredBaby.uniqueCode}</Text>
            <Text style={styles.codeNote}>
              Kode berlaku selama pasien dirawat
            </Text>
          </View>

          <View style={[styles.babyInfoBox, isDark && { backgroundColor: "#1F2937", borderColor: "#374151" }]}>
            <View style={styles.babyInfoRow}>
              <Icon
                name="baby-face-outline"
                library="material"
                size={20}
                color={Colors.textMuted}
              />
              <Text style={[styles.babyInfoText, isDark && { color: "#F3F4F6" }]}>{registeredBaby.name}</Text>
            </View>
            <View style={styles.babyInfoRow}>
              <Icon
                name="bed"
                library="ionicons"
                size={20}
                color={Colors.textMuted}
              />
              <Text style={[styles.babyInfoText, isDark && { color: "#F3F4F6" }]}>
                Tempat Tidur {registeredBaby.bedNumber}
              </Text>
            </View>
            <View style={styles.babyInfoRow}>
              <Icon
                name="videocam-outline"
                library="ionicons"
                size={20}
                color={Colors.textMuted}
              />
              <Text style={[styles.babyInfoText, isDark && { color: "#F3F4F6" }]}>
                {availableDevices.find((d) => d.id === form.deviceId)?.name ||
                  "Kamera Terhubung"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addAnotherBtn}
            onPress={() => {
              setRegisteredBaby(null);
              setForm({
                name: "",
                bedNumber: "A-00",
                dateOfBirth: "",
                parentName: "",
                deviceId: "",
              });
              fetchAvailableDevices(); // Refresh list kamera
            }}
          >
            <Icon
              name="add-circle-outline"
              library="ionicons"
              size={18}
              color={Colors.secondary}
            />
            <Text style={styles.addAnotherText}>Daftarkan Bayi Lain</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToDashBtn}
            onPress={() => router.replace("/(caregiver)/dashboard")}
          >
            <Text style={styles.backToDashText}>Kembali ke Beranda</Text>
          </TouchableOpacity>
        </ScrollView>
        <SuccessModal
          visible={isSuccessModalVisible}
          title="Bayi dan kamera berhasil ditambahkan"
          message="Data bayi telah disimpan dan kamera berhasil dihubungkan ke sistem."
          buttonLabel="Lihat detail"
          onClose={() => setIsSuccessModalVisible(false)}
        />
      </SafeAreaView>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, isDark && { backgroundColor: "#111827" }]}>
      <View style={[styles.header, isDark && { backgroundColor: "#1F2937", borderBottomColor: "#374151" }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBack}
        >
          <Icon
            name="arrow-back"
            library="ionicons"
            size={22}
            color={isDark ? "#BFDBFE" : Colors.secondaryDark}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && { color: "#BFDBFE" }]}>Daftarkan Bayi Baru</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.secondary]}
            tintColor={Colors.secondary}
          />
        }
      >
        <View style={[styles.infoBox, isDark && { backgroundColor: "#1E3448" }]}>
          <Icon
            name="information-circle-outline"
            library="ionicons"
            size={18}
            color={Colors.secondary}
          />
          <Text style={[styles.infoText, isDark && { color: "#BFDBFE" }]}>
            Pilih kamera yang belum terpakai untuk memantau bayi secara
            otomatis.
          </Text>
        </View>

        <View style={[styles.formCard, isDark && { backgroundColor: "#1F2937" }]}>
          <Field
            label="Nama Bayi"
            placeholder="contoh: Bayi Budi Santoso"
            value={form.name}
            onChangeText={(v) => update("name", v)}
            icon="baby-face-outline"
            iconLibrary="material"
            isDark={isDark}
          />
          <View style={styles.divider} />
          <BedNumberField
            value={form.bedNumber}
            onChangePart={updateBedPart}
            isDark={isDark}
          />
          <View style={styles.divider} />
          <View style={fieldStyles.wrapper}>
            <Text style={[fieldStyles.label, { color: focusedField === "date" ? Colors.secondary : isDark ? "#4B5563" : Colors.border, backgroundColor: isDark ? "#111827" : Colors.white }]}>Tanggal Lahir</Text>
            <TouchableOpacity
              style={[fieldStyles.inputRow, { borderColor: focusedField === "date" ? Colors.secondary : isDark ? "#4B5563" : Colors.border, borderWidth: focusedField === "date" ? 2 : 1 }, isDark && { backgroundColor: "#111827" }]}
              onPress={openDatePicker}
              accessibilityRole="button"
              accessibilityLabel="Pilih tanggal lahir dari kalender"
              accessibilityHint="Membuka pemilih tanggal lahir"
            >
              <Icon
                name="calendar-outline"
                library="ionicons"
                size={18}
                color={Colors.textMuted}
              />
              <Text
                style={[
                  fieldStyles.input,
                  isDark && { color: form.dateOfBirth ? "#F9FAFB" : "#9CA3AF" },
                  !form.dateOfBirth && fieldStyles.datePlaceholder,
                ]}
              >
                {form.dateOfBirth || "Pilih tanggal lahir"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <Field
            label="Nama Orang Tua"
            placeholder="contoh: Budi Santoso"
            value={form.parentName}
            onChangeText={(v) => update("parentName", v)}
            icon="person-outline"
            iconLibrary="ionicons"
            isDark={isDark}
          />
          <View style={styles.divider} />

          {/* Custom Dropdown untuk Pilih Kamera */}
          <View style={fieldStyles.wrapper}>
            <Text style={[fieldStyles.label, { color: isDeviceDropdownOpen ? Colors.secondary : isDark ? "#4B5563" : Colors.border, backgroundColor: isDark ? "#111827" : Colors.white }]}>Pilih Kamera Pemantau</Text>
            <TouchableOpacity
              style={[fieldStyles.dropdownButton, { borderColor: isDeviceDropdownOpen ? Colors.secondary : isDark ? "#4B5563" : Colors.border, borderWidth: isDeviceDropdownOpen ? 2 : 1 }, isDark && { backgroundColor: "#111827" }]}
              onPress={() => setIsDeviceDropdownOpen((open) => !open)}
              disabled={isLoadingDevices}
              accessibilityRole="button"
              accessibilityState={{ expanded: isDeviceDropdownOpen, disabled: isLoadingDevices }}
            >
              <Icon
                name="videocam-outline"
                library="ionicons"
                size={18}
                color={Colors.textMuted}
              />
              <Text
                style={
                  form.deviceId
                    ? [fieldStyles.dropdownSelectedText, isDark && { color: "#F9FAFB" }]
                    : [fieldStyles.dropdownPlaceholder, isDark && { color: "#9CA3AF" }]
                }
              >
                {isLoadingDevices
                  ? "Memuat kamera..."
                  : form.deviceId
                    ? availableDevices.find((d) => d.id === form.deviceId)?.name
                    : availableDevices.length === 0
                      ? "Tidak ada kamera tersedia"
                      : "Pilih Kamera..."}
              </Text>
              <Icon
                name={isDeviceDropdownOpen ? "chevron-up" : "chevron-down"}
                library="ionicons"
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
            {isDeviceDropdownOpen ? (
              <ScrollView
                style={[fieldStyles.dropdownMenu, isDark && { backgroundColor: "#111827", borderColor: "#4B5563" }]}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {availableDevices.length === 0 ? (
                  <Text style={[fieldStyles.dropdownEmpty, isDark && { color: "#9CA3AF" }]}>
                    Semua kamera sedang digunakan. Tambahkan perangkat baru terlebih dahulu.
                  </Text>
                ) : (
                  availableDevices.map((device) => (
                    <TouchableOpacity
                      key={device.id}
                      style={[fieldStyles.dropdownOption, isDark && { borderBottomColor: "#374151" }]}
                      onPress={() => {
                        update("deviceId", device.id);
                        setIsDeviceDropdownOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Pilih kamera ${device.name}`}
                    >
                      <Icon name="videocam-outline" library="ionicons" size={18} color={Colors.secondary} />
                      <View style={fieldStyles.dropdownOptionText}>
                        <Text style={[fieldStyles.dropdownSelectedText, isDark && { color: "#F9FAFB" }]}>{device.name}</Text>
                        <Text style={[fieldStyles.dropdownMac, isDark && { color: "#9CA3AF" }]}>{device.mac_address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            !isValid || isLoading ? styles.submitBtnDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Icon
                name="save-outline"
                library="ionicons"
                size={20}
                color={Colors.white}
              />
              <Text style={styles.submitBtnText}>
                Simpan & Hubungkan Kamera
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {Platform.OS === "ios" ? (
        <Modal
          visible={isDatePickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setIsDatePickerVisible(false);
            setFocusedField(null);
          }}
        >
          <View style={styles.datePickerOverlay}>
            <View style={[styles.datePickerModal, isDark && { backgroundColor: "#1F2937" }]}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setIsDatePickerVisible(false);
                    setFocusedField(null);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.datePickerAction}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    update("dateOfBirth", formatDateInput(pickerDate));
                    setIsDatePickerVisible(false);
                    setFocusedField(null);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.datePickerAction}>Pilih</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="inline"
                locale="id-ID"
                themeVariant={isDark ? "dark" : "light"}
                minimumDate={new Date(1900, 0, 1)}
                maximumDate={new Date()}
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setPickerDate(selectedDate);
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

// ── Field component ───────────────────────────────────────────────────

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  icon: string;
  iconLibrary?: "ionicons" | "material" | "feather";
  keyboardType?: "default" | "numeric";
  isDark?: boolean;
  maxLength?: number;
}

function BedNumberField({
  value,
  onChangePart,
  isDark,
}: {
  value: string;
  onChangePart: (part: 0 | 1 | 2, value: string) => void;
  isDark: boolean;
}) {
  const [letter = "", digits = ""] = value.split("-");
  const [focusedPart, setFocusedPart] = useState<number | null>(null);
  const letterRef = useRef<TextInput>(null);
  const firstDigitRef = useRef<TextInput>(null);
  const secondDigitRef = useRef<TextInput>(null);

  const parts = [
    { index: 0 as const, value: letter, ref: letterRef, label: "Huruf", keyboardType: "default" as const },
    { index: 1 as const, value: digits[0] ?? "", ref: firstDigitRef, label: "Digit pertama", keyboardType: "number-pad" as const },
    { index: 2 as const, value: digits[1] ?? "", ref: secondDigitRef, label: "Digit kedua", keyboardType: "number-pad" as const },
  ];

  return (
    <View style={fieldStyles.bedNumberWrapper}>
      <Text style={[fieldStyles.bedNumberLabel, { color: focusedPart !== null ? Colors.secondary : isDark ? "#4B5563" : Colors.border }]}>
        Nomor Tempat Tidur
      </Text>
      <View style={fieldStyles.bedNumberRow}>
        {parts.map((part) => (
          <View key={part.label} style={fieldStyles.bedNumberPart}>
            {part.index === 1 ? <Text style={[fieldStyles.bedNumberSeparator, isDark && { color: "#9CA3AF" }]}>-</Text> : null}
            <TextInput
              ref={part.ref}
              style={[
                fieldStyles.bedNumberInput,
                {
                  color: isDark ? "#F9FAFB" : Colors.textPrimary,
                  borderColor: focusedPart === part.index ? Colors.secondary : isDark ? "#4B5563" : Colors.border,
                  borderWidth: focusedPart === part.index ? 2 : 1,
                  backgroundColor: isDark ? "#111827" : Colors.white,
                },
              ]}
              value={part.value}
              onChangeText={(text) => {
                const cleaned = part.index === 0
                  ? text.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase()
                  : text.replace(/\D/g, "").slice(-1);
                onChangePart(part.index, cleaned);
                if (cleaned && part.index === 0) {
                  firstDigitRef.current?.focus();
                } else if (cleaned && part.index === 1) {
                  secondDigitRef.current?.focus();
                }
              }}
              onFocus={() => setFocusedPart(part.index)}
              onBlur={() => setFocusedPart(null)}
              keyboardType={part.keyboardType}
              autoCapitalize={part.index === 0 ? "characters" : "none"}
              maxLength={1}
              selectTextOnFocus
              accessibilityLabel={part.label}
              returnKeyType={part.index < 2 ? "next" : "done"}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  iconLibrary = "material",
  keyboardType = "default",
  maxLength,
  isDark = false,
}: FieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = isFocused ? Colors.secondary : isDark ? "#4B5563" : Colors.border;

  return (
    <View style={fieldStyles.wrapper}>
      <Text style={[fieldStyles.label, { color: borderColor, backgroundColor: isDark ? "#111827" : Colors.white }]}>{label}</Text>
      <View style={[fieldStyles.inputRow, { borderColor, borderWidth: isFocused ? 2 : 1 }, isDark && { backgroundColor: "#111827" }]}>
        <Icon
          name={icon}
          library={iconLibrary}
          size={18}
          color={isDark ? "#9CA3AF" : Colors.textMuted}
        />
        <TextInput
          style={[fieldStyles.input, isDark && { color: "#F9FAFB" }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDisabled}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize="words"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const fieldStyles = StyleSheet.create({
  wrapper: { position: "relative", paddingTop: 6, paddingBottom: 2 },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    position: "absolute",
    zIndex: 1,
    top: 0,
    left: 12,
    paddingHorizontal: 4,
    backgroundColor: Colors.white,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderColor: Colors.border,
    borderRadius: Radii.control,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
  },
  bedNumberWrapper: { gap: 6, paddingVertical: 2 },
  bedNumberLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    marginLeft: 2,
  },
  bedNumberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bedNumberPart: { flexDirection: "row", alignItems: "center", gap: 8 },
  bedNumberInput: {
    width: 52,
    height: 48,
    borderRadius: Radii.control,
    borderColor: Colors.border,
    textAlign: "center",
    fontFamily: Fonts.interSemiBold,
    fontSize: 18,
    padding: 0,
  },
  bedNumberSeparator: { fontFamily: Fonts.interSemiBold, fontSize: 18, color: Colors.textMuted },
  input: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 8,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderColor: Colors.border,
    borderRadius: Radii.control,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
  },
  dropdownMenu: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.control,
    backgroundColor: Colors.white,
    overflow: "hidden",
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownOptionText: { flex: 1 },
  dropdownMac: { ...Typography.caption, color: Colors.textMuted },
  dropdownEmpty: { ...Typography.caption, color: Colors.textMuted, padding: 12 },
  dropdownPlaceholder: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 15,
    color: Colors.textDisabled,
  },
  dropdownSelectedText: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  datePlaceholder: { color: Colors.textDisabled },
});

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
  headerBack: { padding: 4 },
  headerTitle: {
    ...Typography.h2,
    color: Colors.secondaryDark,
  },
  content: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: 40, alignItems: "center" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    width: "100%",
    maxWidth: 440,
    backgroundColor: Colors.secondaryLight,
    borderRadius: Radii.control,
    padding: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontFamily: Fonts.interRegular,
    fontSize: 13,
    color: Colors.secondaryMid,
    lineHeight: 20,
  },
  formCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: Colors.border },
  submitBtn: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.secondary,
    borderRadius: Radii.control,
    minHeight: ControlSize.minTouchTarget,
  },
  submitBtnDisabled: { backgroundColor: "#B5D4F4" },
  submitBtnText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: 16,
    color: Colors.white,
  },
  successContainer: {
    padding: 24,
    alignItems: "center",
    gap: 16,
    paddingBottom: 40,
  },
  successIconWrapper: { marginTop: 16, marginBottom: 8 },
  successTitle: {
    ...Typography.h1,
    color: Colors.primaryDark,
    textAlign: "center",
  },
  successSub: {
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
  },
  codeBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    width: "100%",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  codeLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.primaryMid,
    letterSpacing: 1.5,
  },
  codeValue: {
    fontFamily: Fonts.nunitoExtraBold,
    fontSize: 38,
    color: Colors.primaryDark,
    letterSpacing: 6,
  },
  codeNote: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  babyInfoBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  babyInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  babyInfoText: {
    fontFamily: Fonts.interMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  addAnotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    width: "100%",
  },
  addAnotherText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.secondary,
  },
  backToDashBtn: {
    paddingVertical: 8,
  },
  backToDashText: {
    fontFamily: Fonts.interMedium,
    fontSize: 14,
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },

  datePickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  datePickerModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  datePickerAction: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 16,
    color: Colors.secondary,
  },
});
