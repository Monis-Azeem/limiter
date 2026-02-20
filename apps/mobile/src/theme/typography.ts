import { StyleSheet } from "react-native";

import { colors } from "@boundly/ui-kit";

export const typography = StyleSheet.create({
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600",
    color: colors.textPrimary
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    color: colors.textPrimary
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
    color: colors.textPrimary
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.textSecondary
  }
});
