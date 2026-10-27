import {
  TouchableOpacity,
  StyleSheet,
  type TouchableOpacityProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";

import { Colors } from "../../constants/colors";
import { ControlSize, Radii, Spacing } from "../../constants/ui";

type Variant = "parent" | "caregiver" | "critical";

interface ActionButtonProps extends TouchableOpacityProps {
  children: ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}

export function ActionButton({
  children,
  variant = "parent",
  style,
  accessibilityRole,
  ...props
}: ActionButtonProps) {
  return (
    <TouchableOpacity
      {...props}
      accessibilityRole={accessibilityRole ?? "button"}
      style={[styles.base, styles[variant], style]}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: ControlSize.minTouchTarget,
    borderRadius: Radii.control,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  parent: { backgroundColor: Colors.primary },
  caregiver: { backgroundColor: Colors.secondary },
  critical: { backgroundColor: Colors.critical },
});
