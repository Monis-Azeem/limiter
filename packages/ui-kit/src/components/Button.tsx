import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent
} from "react-native";

import { colors, radius, spacing } from "../tokens";

interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  onPress: (event: GestureResponderEvent) => void;
}

export function Button({
  label,
  variant = "primary",
  onPress
}: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.base, variantStyles[variant]]}
      onPress={onPress}
    >
      <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 1
  },
  label: {
    fontSize: 15,
    fontWeight: "600"
  }
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.success,
    borderColor: colors.success
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger
  }
});

const labelStyles = StyleSheet.create({
  primary: {
    color: "#FFFFFF"
  },
  secondary: {
    color: colors.textPrimary
  },
  danger: {
    color: "#FFFFFF"
  }
});
