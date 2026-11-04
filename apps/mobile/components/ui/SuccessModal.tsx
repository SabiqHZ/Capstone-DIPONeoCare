import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { Colors } from "../../constants/colors";
import { Fonts, Typography } from "../../constants/fonts";
import { Radii, Spacing } from "../../constants/ui";
import { Icon } from "./Icon";

interface SuccessModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
}

export function SuccessModal({
  visible,
  title,
  message,
  buttonLabel = "Selesai",
  onClose,
}: SuccessModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={85} tint="light" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconBox}>
            <Icon name="checkmark" size={26} color={Colors.white} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg },
  scrim: { backgroundColor: "rgba(218,223,233,0.3)" },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: 18,
    backgroundColor: Colors.white,
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconBox: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: Colors.success,
  },
  title: { ...Typography.h3, color: Colors.textPrimary, textAlign: "center" },
  message: { fontFamily: Fonts.interRegular, fontSize: 14, lineHeight: 21, color: Colors.textMuted, textAlign: "center" },
  button: {
    width: "100%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.control,
    backgroundColor: Colors.secondary,
  },
  buttonText: { ...Typography.bodyStrong, color: Colors.white },
});
