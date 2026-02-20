import type { AppTarget, RuleProfile } from "@boundly/domain";
import { Button, Card, MetricRow, colors, spacing } from "@boundly/ui-kit";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";

interface RulesScreenProps {
  profiles: RuleProfile[];
  activeProfileId: string;
  profile: RuleProfile;
  managedApps: AppTarget[];
  selectedTargetId: string;
  onSelectProfile: (profileId: string) => void;
  onSelectTarget: (targetId: string) => void;
  onSetDailyLimitMinutes: (minutes: number) => void;
  onSetDailyOpenLimit: (opens: number) => void;
}

export function RulesScreen({
  profiles,
  activeProfileId,
  profile,
  managedApps,
  selectedTargetId,
  onSelectProfile,
  onSelectTarget,
  onSetDailyLimitMinutes,
  onSetDailyOpenLimit
}: RulesScreenProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={typography.title}>Rules</Text>
      <Text style={styles.subtitle}>Hard enforcement is active for selected apps.</Text>

      <Card>
        <Text style={styles.sectionTitle}>Profiles</Text>
        <View style={styles.targetGrid}>
          {profiles.map((item) => (
            <Pressable
              key={item.id}
              style={[
                styles.targetPill,
                activeProfileId === item.id ? styles.targetPillActive : undefined
              ]}
              onPress={() => onSelectProfile(item.id)}
            >
              <Text
                style={[
                  styles.targetText,
                  activeProfileId === item.id ? styles.targetTextActive : undefined
                ]}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Targets</Text>
        <View style={styles.targetGrid}>
          {managedApps.map((app) => (
            <Pressable
              key={app.id}
              style={[
                styles.targetPill,
                selectedTargetId === app.id ? styles.targetPillActive : undefined
              ]}
              onPress={() => onSelectTarget(app.id)}
            >
              <Text
                style={[
                  styles.targetText,
                  selectedTargetId === app.id ? styles.targetTextActive : undefined
                ]}
              >
                {app.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Daily Limits</Text>
        <MetricRow label="Minutes" value={`${profile.dailyLimitMinutes}m`} />
        <View style={styles.row}>
          <Button
            label="-5m"
            variant="secondary"
            onPress={() => onSetDailyLimitMinutes(profile.dailyLimitMinutes - 5)}
          />
          <Button
            label="+5m"
            variant="secondary"
            onPress={() => onSetDailyLimitMinutes(profile.dailyLimitMinutes + 5)}
          />
        </View>
        <MetricRow label="Opens" value={`${profile.dailyOpenLimit}`} />
        <View style={styles.row}>
          <Button
            label="-1 open"
            variant="secondary"
            onPress={() => onSetDailyOpenLimit(profile.dailyOpenLimit - 1)}
          />
          <Button
            label="+1 open"
            variant="secondary"
            onPress={() => onSetDailyOpenLimit(profile.dailyOpenLimit + 1)}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  sectionTitle: {
    ...typography.heading
  },
  targetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  targetPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  targetPillActive: {
    backgroundColor: colors.success,
    borderColor: colors.success
  },
  targetText: {
    color: colors.textPrimary,
    fontWeight: "500"
  },
  targetTextActive: {
    color: "#FFFFFF"
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm
  }
});
