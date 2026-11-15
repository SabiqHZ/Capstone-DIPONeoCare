import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { babyService } from "../../services/baby.service";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import { useTheme } from "../../context/ThemeContext";

export default function EditBabyScreen() {
  const router = useRouter();
  const { babyId } = useLocalSearchParams<{ babyId: string }>();
  const { isDark } = useTheme();
  const [form, setForm] = useState({ name: "", bedNumber: "", dateOfBirth: "", parentName: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!babyId) return;
    void babyService.getBabyById(babyId).then((baby) => setForm({
      name: baby.name ?? "", bedNumber: baby.bed_number ?? "",
      dateOfBirth: baby.date_of_birth ?? "", parentName: baby.parent_name ?? "",
    })).catch(() => Alert.alert("Gagal", "Data bayi tidak dapat dimuat."));
  }, [babyId]);

  const save = async () => {
    if (!babyId || Object.values(form).some((value) => !value.trim())) {
      Alert.alert("Data belum lengkap", "Lengkapi semua informasi bayi.");
      return;
    }
    setSaving(true);
    try {
      await babyService.updateBaby(babyId, form);
      Alert.alert("Berhasil", "Informasi bayi telah diperbarui.", [{ text: "OK", onPress: () => router.back() }]);
    } catch {
      Alert.alert("Gagal", "Informasi bayi belum dapat diperbarui.");
    } finally { setSaving(false); }
  };

  return <SafeAreaView style={[styles.safe, isDark && { backgroundColor: "#111827" }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹ Kembali</Text></TouchableOpacity>
      <Text style={[styles.title, isDark && { color: "#F9FAFB" }]}>Edit Informasi Bayi</Text>
      {([
        ["name", "Nama bayi"], ["bedNumber", "Nomor tempat tidur"],
        ["dateOfBirth", "Tanggal lahir (YYYY-MM-DD)"], ["parentName", "Nama orang tua"],
      ] as const).map(([key, label]) => <View key={key} style={styles.field}>
        <Text style={[styles.label, isDark && { color: "#D1D5DB" }]}>{label}</Text>
        <TextInput value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} style={[styles.input, isDark && { color: "#F9FAFB", backgroundColor: "#1F2937", borderColor: "#374151" }]} />
      </View>)}
      <TouchableOpacity disabled={saving} onPress={save} style={styles.save}><Text style={styles.saveText}>{saving ? "Menyimpan..." : "Simpan perubahan"}</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F8FAFC" }, content: { padding: 20, gap: 16 }, back: { color: Colors.secondaryDark, fontFamily: Fonts.poppinsMedium, fontSize: 15 }, title: { color: Colors.textPrimary, fontFamily: Fonts.poppinsBold, fontSize: 23 }, field: { gap: 6 }, label: { color: Colors.textSecondary, fontFamily: Fonts.poppinsMedium, fontSize: 13 }, input: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 10, minHeight: 48, paddingHorizontal: 12, fontFamily: Fonts.poppinsRegular, color: Colors.textPrimary }, save: { backgroundColor: Colors.secondary, minHeight: 48, borderRadius: 10, justifyContent: "center", alignItems: "center", marginTop: 8 }, saveText: { color: Colors.white, fontFamily: Fonts.poppinsSemiBold, fontSize: 15 } });
