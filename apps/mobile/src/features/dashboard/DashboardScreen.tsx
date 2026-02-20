import type { EnforcementDecision, RuleProfile, UsageSnapshot } from "@boundly/domain";
import { Button, Card, MetricRow, colors, spacing } from "@boundly/ui-kit";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";

interface DashboardScreenProps {
  profile: RuleProfile;
  selectedTargetId: string;
  usage: UsageSnapshot;
  decision: EnforcementDecision;
  onRecordOpenAttempt: () => void;
  onAddUsageMinutes: (minutes: number) => void;
  onConfirmIntent: () => void;
  onSatisfyDelay: () => void;
  onResetAttempt: () => void;
}

export function DashboardScreen({
  profile,
  selectedTargetId,
  usage,
  decision,
  onRecordOpenAttempt,
  onAddUsageMinutes,
  onConfirmIntent,
  onSatisfyDelay,
  onResetAttempt
}: DashboardScreenProps): React.JSX.Element {
  const usedMinutes = usage.minutesByTarget[selectedTargetId] ?? 0;
  const usedOpens = usage.opensByTarget[selectedTargetId] ?? 0;

  return (
    <View style={styles.root}>
      <Text style={typography.title}>Today</Text>
      <Text style={styles.subtitle}>{profile.name} profile</Text>

      <Card>
        <Text style={styles.sectionTitle}>Quota</Text>
        <MetricRow label="App" value={selectedTargetId} />
        <MetricRow label="Used Minutes" value={`${usedMinutes}m`} />
        <MetricRow label="Remaining Minutes" value={`${decision.remainingMinutes}m`} />
        <MetricRow label="Used Opens" value={`${usedOpens}`} />
        <MetricRow label="Remaining Opens" value={`${decision.remainingOpens}`} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Current Decision</Text>
        <MetricRow label="State" value={decision.kind.toUpperCase()} />
        <MetricRow label="Reason" value={decision.reason} />
        {decision.delaySeconds ? (
          <MetricRow label="Delay" value={`${decision.delaySeconds}s`} />
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Simulation</Text>
        <View style={styles.row}>
          <Button label="Open Attempt" onPress={onRecordOpenAttempt} />
          <Button label="+5 min usage" variant="secondary" onPress={() => onAddUsageMinutes(5)} />
        </View>
        <View style={styles.row}>
          <Button label="Confirm Intent" variant="secondary" onPress={onConfirmIntent} />
          <Button label="Finish Delay" variant="secondary" onPress={onSatisfyDelay} />
        </View>
        <Button label="Reset Attempt State" variant="secondary" onPress={onResetAttempt} />
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
  row: {
    flexDirection: "row",
    gap: spacing.sm
  }
});
