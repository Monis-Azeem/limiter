import type { RuleProfile, UsageSnapshot } from "@boundly/domain";
import { Card, MetricRow, colors, spacing } from "@boundly/ui-kit";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";

interface InsightsScreenProps {
  profile: RuleProfile;
  usage: UsageSnapshot;
}

export function InsightsScreen({
  profile,
  usage
}: InsightsScreenProps): React.JSX.Element {
  const targetIds = profile.targetAppIds;
  const totalMinutes = targetIds.reduce(
    (sum, id) => sum + (usage.minutesByTarget[id] ?? 0),
    0
  );
  const totalOpens = targetIds.reduce((sum, id) => sum + (usage.opensByTarget[id] ?? 0), 0);

  return (
    <View style={styles.root}>
      <Text style={typography.title}>Insights</Text>
      <Text style={styles.subtitle}>Local-only activity summary.</Text>

      <Card>
        <Text style={styles.sectionTitle}>Totals</Text>
        <MetricRow label="Total Minutes" value={`${totalMinutes}m`} />
        <MetricRow label="Total Opens" value={`${totalOpens}`} />
        <MetricRow label="Overrides" value={`${usage.overridesUsedToday}`} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Per App</Text>
        {targetIds.map((id) => (
          <MetricRow
            key={id}
            label={id}
            value={`${usage.minutesByTarget[id] ?? 0}m / ${usage.opensByTarget[id] ?? 0} opens`}
          />
        ))}
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
  }
});
