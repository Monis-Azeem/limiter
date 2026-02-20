import type { AppTarget, PermissionState } from "@boundly/domain";
import { Button, Card, MetricRow, colors, spacing } from "@boundly/ui-kit";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { typography } from "../../theme/typography";

interface OnboardingScreenProps {
  permissionsGranted: boolean;
  healthStatus: string;
  healthDetail?: string;
  permissionStates: PermissionState[];
  managedApps: AppTarget[];
  onRequestPermission: (permissionKey: PermissionState["key"]) => void;
  onRefreshPermissions: () => void;
  onStartEnforcement: () => void;
  onContinue: () => void;
}

const REQUIRED_PERMISSION_KEYS: PermissionState["key"][] = [
  "usage_access",
  "accessibility",
  "ignore_battery_optimization"
];

export function OnboardingScreen({
  permissionsGranted,
  healthStatus,
  healthDetail,
  permissionStates,
  managedApps,
  onRequestPermission,
  onRefreshPermissions,
  onStartEnforcement,
  onContinue
}: OnboardingScreenProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={typography.title}>Boundly</Text>
      <Text style={styles.subtitle}>Hard limits for scrolling apps, offline by default.</Text>

      <Card>
        <Text style={styles.sectionTitle}>Permission Checklist</Text>
        <MetricRow label="Health" value={healthStatus} />
        {healthDetail ? <Text style={styles.helper}>{healthDetail}</Text> : null}
        {REQUIRED_PERMISSION_KEYS.map((permissionKey) => {
          const state = permissionStates.find((permissionState) => permissionState.key === permissionKey);
          const granted = state?.granted ?? false;
          return (
            <View key={permissionKey} style={styles.permissionRow}>
              <MetricRow label={permissionKey} value={granted ? "Granted" : "Missing"} />
              <Button
                label={granted ? "Granted" : "Grant"}
                variant={granted ? "secondary" : "primary"}
                onPress={() => onRequestPermission(permissionKey)}
              />
            </View>
          );
        })}
        <View style={styles.row}>
          <Button label="Refresh" variant="secondary" onPress={onRefreshPermissions} />
          <Button
            label="Start Enforcement"
            variant={permissionsGranted ? "primary" : "secondary"}
            onPress={onStartEnforcement}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Detected Apps</Text>
        {managedApps.slice(0, 8).map((app) => (
          <MetricRow key={app.id} label={app.displayName} value={app.platformPackageId} />
        ))}
      </Card>

      <Button
        label="Continue"
        variant={permissionsGranted ? "primary" : "secondary"}
        onPress={onContinue}
      />
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
  permissionRow: {
    gap: spacing.sm
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm
  },
  helper: {
    ...typography.caption
  }
});
