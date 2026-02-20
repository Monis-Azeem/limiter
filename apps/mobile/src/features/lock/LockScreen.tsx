import type { EnforcementDecision, RuleProfile, UsageSnapshot } from "@boundly/domain";
import { Button, Card, MetricRow, colors, spacing } from "@boundly/ui-kit";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";

interface LockScreenProps {
  decision: EnforcementDecision;
  profile: RuleProfile;
  usage: UsageSnapshot;
  onEmergencyOverride: () => void;
}

export function LockScreen({
  decision,
  profile,
  usage,
  onEmergencyOverride
}: LockScreenProps): React.JSX.Element {
  const canOverride = usage.overridesUsedToday < profile.overridePolicy.maxOverridesPerDay;

  return (
    <View style={styles.root}>
      <Text style={typography.title}>Lock State</Text>
      <Text style={styles.subtitle}>This screen represents what users see when blocked.</Text>

      <Card>
        <Text style={styles.status}>
          {decision.kind === "block" ? "App Blocked" : "Not Blocked"}
        </Text>
        <MetricRow label="Reason" value={decision.reason} />
        <MetricRow
          label="Overrides Used"
          value={`${usage.overridesUsedToday}/${profile.overridePolicy.maxOverridesPerDay}`}
        />
        {decision.cooldownUntilIso ? (
          <MetricRow label="Cooldown Until" value={decision.cooldownUntilIso} />
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Emergency Override</Text>
        <Text style={styles.helper}>
          Override adds {profile.overridePolicy.penaltyMinutes} minutes and applies a{" "}
          {profile.overridePolicy.cooldownMinutes} minute cooldown.
        </Text>
        <Button
          label={canOverride ? "Use Emergency Override" : "Override Unavailable"}
          variant={canOverride ? "danger" : "secondary"}
          onPress={() => {
            if (canOverride) {
              onEmergencyOverride();
            }
          }}
        />
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
  status: {
    ...typography.heading,
    color: colors.danger
  },
  sectionTitle: {
    ...typography.heading
  },
  helper: {
    ...typography.caption
  }
});
