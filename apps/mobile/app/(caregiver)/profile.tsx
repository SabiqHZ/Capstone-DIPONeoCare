import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { Radii, Spacing, ControlSize } from "../../constants/ui";
import { authService } from "../../services/auth.service";
import { useAuthStore } from "../../stores/auth.store";

type Profile = { username: string; name: string; unitId: string };

export default function CaregiverProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordFormVisible, setIsPasswordFormVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visibleFields, setVisibleFields] = useState([false, false, false]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setProfileError(false);
    try {
      const data = await authService.getCaregiverProfile();
      setProfile(data);
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

  const handleChangePassword = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Lengkapi semua kolom sandi.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("Sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi sandi baru belum sama.");
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage("Sandi baru harus berbeda dari sandi saat ini.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await authService.changeCaregiverPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(response.message || "Kata sandi berhasil diperbarui.");
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || "Kata sandi gagal diperbarui. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || user.role !== "caregiver") return null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Kembali ke dashboard">
            <Icon name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil Pengasuh</Text>
          <View style={styles.headerSpace} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{(profile?.name || user.name).trim().charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.profileName}>{profile?.name || user.name}</Text>
            <Text style={styles.profileRole}>Pengasuh</Text>
            {isLoading ? (
              <ActivityIndicator color={Colors.secondary} style={styles.profileLoader} />
            ) : (
              <View style={styles.details}>
                <InfoRow label="Nama" value={profile?.name || user.name} />
                <InfoRow label="Username" value={profile?.username || "—"} />
                <InfoRow label="Unit" value={profile?.unitId || user.unitId || "—"} last />
              </View>
            )}
          </View>

          {profileError ? (
            <View style={styles.loadError}>
              <Text style={styles.loadErrorText}>Profil gagal dimuat. Periksa koneksi lalu coba lagi.</Text>
              <TouchableOpacity onPress={() => void loadProfile()} accessibilityRole="button">
                <Text style={styles.loadRetry}>Coba lagi</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.changePasswordButton}
            onPress={() => {
              setIsPasswordFormVisible((visible) => !visible);
              setErrorMessage("");
              setSuccessMessage("");
            }}
            accessibilityRole="button"
            accessibilityLabel={isPasswordFormVisible ? "Tutup ubah kata sandi" : "Ubah kata sandi"}
          >
            <View style={styles.changePasswordIcon}><Icon name="lock-closed-outline" size={20} color={Colors.secondaryDark} /></View>
            <Text style={styles.changePasswordLabel}>Ubah kata sandi</Text>
            <Icon name={isPasswordFormVisible ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          {isPasswordFormVisible ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Perbarui kata sandi</Text>
              <Text style={styles.formDescription}>Gunakan sandi minimal 8 karakter agar akun tetap aman.</Text>
              <PasswordField label="Sandi saat ini" value={currentPassword} onChangeText={setCurrentPassword} visible={visibleFields[0]} onToggle={() => toggleVisibility(0)} editable={!isSaving} />
              <PasswordField label="Sandi baru" value={newPassword} onChangeText={setNewPassword} visible={visibleFields[1]} onToggle={() => toggleVisibility(1)} editable={!isSaving} />

              <View style={styles.strengthBlock}>
                <View style={styles.strengthTopline}>
                  <Text style={styles.strengthLabel}>Kekuatan sandi</Text>
                  <Text style={[styles.strengthValue, { color: strength ? strengthColor : Colors.textMuted }]}>{strengthLabel || "Belum diisi"}</Text>
                </View>
                <View style={styles.strengthTrack}>
                  {[0, 1, 2, 3].map((step) => <View key={step} style={[styles.strengthSegment, step < strength && { backgroundColor: strengthColor }]} />)}
                </View>
                <Text style={[styles.minimumRule, newPassword.length >= 8 && styles.minimumRuleMet]}>
                  {newPassword.length >= 8 ? "✓" : "•"} Minimal 8 karakter
                </Text>
              </View>

              <PasswordField label="Konfirmasi sandi baru" value={confirmPassword} onChangeText={setConfirmPassword} visible={visibleFields[2]} onToggle={() => toggleVisibility(2)} editable={!isSaving} />

              {errorMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text> : null}
              {successMessage ? (
                <View style={styles.successBox}>
                  <Icon name="checkmark-circle" size={20} color={Colors.success} />
                  <Text style={styles.successMessage}>{successMessage}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={() => void handleChangePassword()} disabled={isSaving} activeOpacity={0.8} accessibilityRole="button">
                {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Simpan kata sandi</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PasswordField({ label, value, onChangeText, visible, onToggle, editable }: {
  label: string; value: string; onChangeText: (value: string) => void; visible: boolean; onToggle: () => void; editable: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
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
  profileCard: { alignItems: "center", padding: Spacing.xl, borderRadius: Radii.card, backgroundColor: Colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: Colors.secondaryLight, marginBottom: Spacing.sm },
  avatarInitial: { fontFamily: Fonts.nunitoBold, fontSize: 30, color: Colors.secondaryDark },
  profileName: { ...Typography.h2, color: Colors.textPrimary, textAlign: "center" },
  profileRole: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  profileLoader: { marginTop: 20 },
  loadError: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.control, backgroundColor: Colors.warningLight },
  loadErrorText: { ...Typography.caption, color: Colors.warningDark, flex: 1 },
  loadRetry: { ...Typography.captionStrong, color: Colors.secondaryDark },
  details: { width: "100%", marginTop: Spacing.lg },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md, paddingVertical: Spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoLabel: { ...Typography.body, color: Colors.textMuted },
  infoValue: { ...Typography.bodyStrong, color: Colors.textPrimary, flexShrink: 1, textAlign: "right" },
  changePasswordButton: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radii.card, backgroundColor: Colors.white },
  changePasswordIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radii.control, backgroundColor: Colors.secondaryLight },
  changePasswordLabel: { ...Typography.bodyStrong, color: Colors.textPrimary, flex: 1 },
  formCard: { padding: Spacing.lg, gap: Spacing.md, borderRadius: Radii.card, backgroundColor: Colors.white },
  formTitle: { ...Typography.h3, color: Colors.textPrimary },
  formDescription: { ...Typography.caption, color: Colors.textMuted, lineHeight: 18, marginTop: -Spacing.sm },
  field: { gap: Spacing.xs },
  fieldLabel: { ...Typography.captionStrong, color: Colors.textSecondary },
  inputWrap: { minHeight: 50, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.control, backgroundColor: Colors.white },
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
  successBox: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.control, backgroundColor: Colors.successLight },
  successMessage: { ...Typography.bodyStrong, color: Colors.successDark, flex: 1 },
  saveButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: Radii.control, backgroundColor: Colors.secondary, marginTop: Spacing.xs },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { ...Typography.bodyStrong, color: Colors.white },
});
