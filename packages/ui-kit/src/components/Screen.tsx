import type { PropsWithChildren } from "react";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";

import { colors, spacing } from "../tokens";

export function Screen({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg
  }
});
