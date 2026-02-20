import type { PropsWithChildren } from "react";
import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../tokens";

export function Card({ children }: PropsWithChildren): React.JSX.Element {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm
  }
});
