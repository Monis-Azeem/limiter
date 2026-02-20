import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../tokens";

interface MetricRowProps {
  label: string;
  value: string;
}

export function MetricRow({ label, value }: MetricRowProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14
  },
  value: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600"
  }
});
