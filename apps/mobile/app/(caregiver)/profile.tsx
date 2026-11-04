import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import { Icon } from "../../components/ui/Icon";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";
import { Radii, Spacing, ControlSize } from "../../constants/ui";
import { authService } from "../../services/auth.service";
import { useAuthStore } from "../../stores/auth.store";
import { SuccessModal } from "../../components/ui/SuccessModal";
import { useTheme } from "../../context/ThemeContext";

type Profile = { username: string; name: string };

export default function CaregiverProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { isDark } = useTheme();
  const caregiverName = user?.role === "caregiver" ? user.name : "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState(caregiverName);
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveSuccessVisible, setIsSaveSuccessVisible] = useState(false);
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const pendingRemoveAction = useRef<(() => void) | null>(null);
  const [allowRemove, setAllowRemove] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visibleFields, setVisibleFields] = useState([false, false, false]);
  const [errorMessage, setErrorMessage] = useState("");

  const hasUnsavedChanges = useMemo(() => {
    const savedName = profile?.name ?? caregiverName;
    const savedUsername = profile?.username ?? "";
    return (
      name.trim() !== savedName ||
      username.trim() !== savedUsername ||
      Boolean(currentPassword || newPassword || confirmPassword)
    );
  }, [caregiverName, confirmPassword, currentPassword, name, newPassword, profile, username]);

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (!hasUnsavedChanges || allowRemove) return;
    event.preventDefault();
    pendingRemoveAction.current = () => navigation.dispatch(event.data.action);
    setIsConfirmationVisible(true);
  }), [allowRemove, hasUnsavedChanges, navigation]);

  useEffect(() => {
    if (!allowRemove || !pendingRemoveAction.current) return;
    pendingRemoveAction.current();
    pendingRemoveAction.current = null;
    setAllowRemove(false);
  }, [allowRemove]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (navigation.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [navigation, router]);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setProfileError(false);
    try {
      const data = await authService.getCaregiverProfile();
      setProfile(data);
      setName(data.name);
      setUsername(data.username);
    } catch {
      setProfileError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const strength = useMemo(() => {
    if (!newPassword) return 0;
    return [
      newPassword.length >= 8,
      /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword),
      /\d/.test(newPassword),
      /[^a-zA-Z0-9]/.test(newPassword),
    ].filter(Boolean).length;
  }, [newPassword]);

  const strengthLabel = ["", "Lemah", "Cukup", "Baik", "Kuat"][strength];
  const strengthColor = strength < 2 ? Colors.critical : strength < 4 ? Colors.warning : Colors.success;

  const toggleVisibility = (index: number) => {
    setVisibleFields((current) => current.map((value, i) => i === index ? !value : value));
  };

  const handleSaveChanges = async (leaveAfterSave = false) => {
    setErrorMessage("");
    if (!name.trim() || !username.trim()) {
      setErrorMessage("Nama dan username wajib diisi.");
      return;
    }
    const passwordChanged = Boolean(currentPassword || newPassword || confirmPassword);
    if (passwordChanged && (!currentPassword || !newPassword || !confirmPassword)) {
      setErrorMessage("Lengkapi semua kolom sandi.");
      return;
    }
    if (passwordChanged && newPassword.length < 8) {
      setErrorMessage("Sandi baru minimal 8 karakter.");
      return;
    }
    if (passwordChanged && newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi sandi baru belum sama.");
      return;
    }
    if (passwordChanged && currentPassword === newPassword) {
      setErrorMessage("Sandi baru harus berbeda dari sandi saat ini.");
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await authService.updateCaregiverProfile({
        name: name.trim(),
        username: username.trim(),
        ...(passwordChanged ? { currentPassword, newPassword } : {}),
      });
      setProfile(updatedProfile);
      setName(updatedProfile.name);
      setUsername(updatedProfile.username);
      if (user?.role === "caregiver") {
        await setUser({ ...user, name: updatedProfile.name });
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsSaveSuccessVisible(true);
      if (leaveAfterSave) {
        setIsConfirmationVisible(false);
      }
    } catch (error: any) {
      const message = error.response?.data?.error || "Perubahan gagal disimpan. Coba lagi.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const discardChangesAndLeave = () => {
    setName(profile?.name ?? caregiverName);
    setUsername(profile?.username ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsConfirmationVisible(false);
    setAllowRemove(true);
  };

  const closeSaveSuccess = () => {
    setIsSaveSuccessVisible(false);
    router.replace("/(caregiver)/dashboard");
  };

  if (!user || user.role !== "caregiver") return null;

  return (
    <SafeAreaView style={[styles.safe, isDark && { backgroundColor: "#111827" }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, isDark && { backgroundColor: "#1F2937", borderBottomColor: "#374151" }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Kembali ke dashboard">
            <Icon name="arrow-back" size={22} color={isDark ? "#F9FAFB" : Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && { color: "#BFDBFE" }]}>Profil Pengasuh</Text>
          <View style={styles.headerSpace} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.profileCard, isDark && { backgroundColor: "#1F2937" }]}>
            <View style={styles.profileIdentity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{(name || caregiverName).trim().charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.profileName, isDark && { color: "#F9FAFB" }]}>{name || caregiverName}</Text>
              <Text style={[styles.profileRole, isDark && { color: "#9CA3AF" }]}>Pengasuh</Text>
            </View>

            {isLoading ? <ActivityIndicator color={Colors.secondary} style={styles.profileLoader} /> : null}
            {profileError ? (
              <View style={styles.loadError}>
                <Text style={styles.loadErrorText}>Profil gagal dimuat. Periksa koneksi lalu coba lagi.</Text>
                <TouchableOpacity onPress={() => void loadProfile()} accessibilityRole="button">
                  <Text style={styles.loadRetry}>Coba lagi</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TextField isDark={isDark} label="Nama" value={name} onChangeText={setName} editable={!isSaving && !isLoading} />
            <TextField isDark={isDark} label="Username" value={username} onChangeText={setUsername} editable={!isSaving && !isLoading} autoCapitalize="none" />

            <View style={[styles.sectionDivider, isDark && { backgroundColor: "#374151" }]} />
            <Text style={[styles.formTitle, isDark && { color: "#F3F4F6" }]}>Ubah kata sandi</Text>
            <Text style={[styles.formDescription, isDark && { color: "#9CA3AF" }]}>Kosongkan kolom sandi jika tidak ingin mengubahnya.</Text>
            <PasswordField isDark={isDark} label="Sandi saat ini" value={currentPassword} onChangeText={setCurrentPassword} visible={visibleFields[0]} onToggle={() => toggleVisibility(0)} editable={!isSaving && !isLoading} />
            <PasswordField isDark={isDark} label="Sandi baru" value={newPassword} onChangeText={setNewPassword} visible={visibleFields[1]} onToggle={() => toggleVisibility(1)} editable={!isSaving && !isLoading} />

            <View style={styles.strengthBlock}>
              <View style={styles.strengthTopline}>
                <Text style={[styles.strengthLabel, isDark && { color: "#9CA3AF" }]}>Kekuatan sandi</Text>
                <Text style={[styles.strengthValue, { color: strength ? strengthColor : Colors.textMuted }]}>{strengthLabel || "Belum diisi"}</Text>
              </View>
              <View style={styles.strengthTrack}>
                {[0, 1, 2, 3].map((step) => <View key={step} style={[styles.strengthSegment, isDark && { backgroundColor: "#4B5563" }, step < strength && { backgroundColor: strengthColor }]} />)}
              </View>
              <Text style={[styles.minimumRule, isDark && { color: "#9CA3AF" }, newPassword.length >= 8 && styles.minimumRuleMet]}>
                {newPassword.length >= 8 ? "✓" : "•"} Minimal 8 karakter
              </Text>
            </View>

            <PasswordField isDark={isDark} label="Konfirmasi sandi baru" value={confirmPassword} onChangeText={setConfirmPassword} visible={visibleFields[2]} onToggle={() => toggleVisibility(2)} editable={!isSaving && !isLoading} />

            {errorMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text> : null}
            <TouchableOpacity
              style={[styles.saveButton, (isSaving || isLoading || !hasUnsavedChanges) && styles.saveButtonDisabled]}
              onPress={() => void handleSaveChanges()}
              disabled={isSaving || isLoading || !hasUnsavedChanges}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Simpan perubahan</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isConfirmationVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.confirmationOverlay}>
          <BlurView intensity={85} tint="light" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.confirmationScrim]} />
          <Pressable style={StyleSheet.absoluteFill} />
          <View style={[styles.confirmationCard, isDark && { backgroundColor: "#1F2937" }]} accessibilityViewIsModal>
            <Text style={[styles.confirmationTitle, isDark && { color: "#F9FAFB" }]}>Simpan perubahan?</Text>
            <Text style={[styles.confirmationMessage, isDark && { color: "#9CA3AF" }]}>Perubahan yang belum disimpan akan hilang jika Anda kembali.</Text>
            {errorMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text> : null}
            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.confirmationCancelButton}
                onPress={discardChangesAndLeave}
                disabled={isSaving}
                accessibilityRole="button"
              >
                <Text style={[styles.confirmationCancelText, isDark && { color: "#D1D5DB" }]}>Tidak</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmationSaveButton, isSaving && styles.saveButtonDisabled]}
                onPress={() => void handleSaveChanges(true)}
                disabled={isSaving}
                accessibilityRole="button"
              >
                {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.confirmationSaveText}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <SuccessModal
        visible={isSaveSuccessVisible}
        title="Perubahan berhasil disimpan"
        message="Profil dan pengaturan kata sandi Anda telah diperbarui."
        onClose={closeSaveSuccess}
      />
    </SafeAreaView>
  );
}

function TextField({ label, value, onChangeText, editable, autoCapitalize = "words", isDark }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  isDark: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = isFocused ? Colors.secondary : isDark ? "#4B5563" : Colors.border;

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: borderColor, backgroundColor: isDark ? "#111827" : Colors.white }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor, borderWidth: isFocused ? 2 : 1 }, isDark && { backgroundColor: "#111827" }]}>
        <TextInput
          style={[styles.input, isDark && { color: "#F9FAFB" }]}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          placeholder={`Masukkan ${label.toLowerCase()}`}
          placeholderTextColor={Colors.textDisabled}
          accessibilityLabel={label}
          returnKeyType="next"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>
    </View>
  );
}

function PasswordField({ label, value, onChangeText, visible, onToggle, editable, isDark }: {
  isDark: boolean;
  label: string; value: string; onChangeText: (value: string) => void; visible: boolean; onToggle: () => void; editable: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = isFocused ? Colors.secondary : isDark ? "#4B5563" : Colors.border;

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: borderColor, backgroundColor: isDark ? "#111827" : Colors.white }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor, borderWidth: isFocused ? 2 : 1 }, isDark && { backgroundColor: "#111827" }]}>
        <TextInput
          style={[styles.input, isDark && { color: "#F9FAFB" }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          placeholder="Masukkan kata sandi"
          placeholderTextColor={Colors.textDisabled}
          accessibilityLabel={label}
          returnKeyType="done"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <TouchableOpacity style={styles.eyeButton} onPress={onToggle} accessibilityRole="button" accessibilityLabel={visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}>
          <Icon name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.backgroundNurse },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...Typography.h2, color: Colors.secondaryDark },
  headerSpace: { width: 44 },
  content: { width: "100%", maxWidth: 600, alignSelf: "center", padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  profileCard: { alignItems: "stretch", padding: Spacing.xl, gap: Spacing.md, borderRadius: Radii.card, backgroundColor: Colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  profileIdentity: { alignItems: "center", marginBottom: Spacing.sm },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: Colors.secondaryLight, marginBottom: Spacing.sm },
  avatarInitial: { fontFamily: Fonts.nunitoBold, fontSize: 30, color: Colors.secondaryDark },
  profileName: { ...Typography.h2, color: Colors.textPrimary, textAlign: "center" },
  profileRole: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  profileLoader: { marginVertical: Spacing.sm },
  loadError: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.control, backgroundColor: Colors.warningLight },
  loadErrorText: { ...Typography.caption, color: Colors.warningDark, flex: 1 },
  loadRetry: { ...Typography.captionStrong, color: Colors.secondaryDark },
  sectionDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.xs },
  formTitle: { ...Typography.h3, color: Colors.textPrimary },
  formDescription: { ...Typography.caption, color: Colors.textMuted, lineHeight: 18, marginTop: -Spacing.sm },
  field: { position: "relative", paddingTop: 8 },
  fieldLabel: { ...Typography.captionStrong, position: "absolute", zIndex: 1, top: 0, left: 12, paddingHorizontal: 4, backgroundColor: Colors.white },
  inputWrap: { minHeight: 58, flexDirection: "row", alignItems: "center", borderColor: Colors.border, borderRadius: Radii.control, backgroundColor: Colors.white },
  input: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, ...Typography.body, color: Colors.textPrimary },
  eyeButton: { width: ControlSize.minTouchTarget, height: ControlSize.minTouchTarget, alignItems: "center", justifyContent: "center" },
  strengthBlock: { gap: Spacing.xs, marginTop: -Spacing.xs },
  strengthTopline: { flexDirection: "row", justifyContent: "space-between" },
  strengthLabel: { ...Typography.caption, color: Colors.textMuted },
  strengthValue: { ...Typography.captionStrong },
  strengthTrack: { flexDirection: "row", gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  minimumRule: { ...Typography.caption, color: Colors.textMuted },
  minimumRuleMet: { color: Colors.success },
  errorMessage: { ...Typography.caption, color: Colors.critical, lineHeight: 18 },
  saveButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: Radii.control, backgroundColor: Colors.secondary, marginTop: Spacing.xs },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { ...Typography.bodyStrong, color: Colors.white },
  confirmationOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg },
  confirmationScrim: { backgroundColor: "rgba(218,223,233,0.3)" },
  confirmationCard: { width: "100%", maxWidth: 380, padding: Spacing.xl, borderRadius: 18, backgroundColor: Colors.white, gap: Spacing.md, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  confirmationTitle: { fontFamily: Fonts.interSemiBold, fontSize: 18, color: Colors.textPrimary },
  confirmationMessage: { fontFamily: Fonts.interRegular, fontSize: 14, lineHeight: 21, color: Colors.textMuted },
  confirmationActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
  confirmationCancelButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: Radii.control, borderWidth: 1, borderColor: Colors.border },
  confirmationCancelText: { ...Typography.body, color: Colors.textSecondary },
  confirmationSaveButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: Radii.control, backgroundColor: Colors.secondary },
  confirmationSaveText: { ...Typography.bodyStrong, color: Colors.white },
});
