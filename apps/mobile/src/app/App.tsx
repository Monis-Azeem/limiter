import type { AppTarget, PermissionKey } from "@boundly/domain";
import { Button, Card, Screen, colors, spacing } from "@boundly/ui-kit";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { enforcementService } from "../services/enforcement-service";
import { useAppStore } from "../stores/useAppStore";
import { typography } from "../theme/typography";

const REQUIRED_PERMISSION_KEYS: PermissionKey[] = [
  "usage_access",
  "accessibility",
  "ignore_battery_optimization"
];

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  usage_access: "Usage access",
  accessibility: "Accessibility",
  ignore_battery_optimization: "Battery",
  overlay: "Overlay",
  notifications: "Notifications"
};

function healthText(status: string): string {
  if (status === "enforcement_running") {
    return "Running";
  }
  if (status === "permissions_missing") {
    return "Permissions needed";
  }
  if (status === "enforcement_degraded") {
    return "Issue found";
  }
  return "Stopped";
}

function AppContainer(): React.JSX.Element {
  const [managedApps, setManagedApps] = useState<AppTarget[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [busyPermissionKey, setBusyPermissionKey] = useState<PermissionKey | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const {
    profiles,
    activeProfileId,
    selectedTargetId,
    permissionStates,
    permissionsGranted,
    health,
    isBootstrapped,
    bootstrap,
    requestPermission,
    refreshPermissions,
    setSelectedTargetId,
    setDailyLimitMinutes,
    startEnforcement,
    stopEnforcement
  } = useAppStore();

  const profile = useMemo(
    () => profiles.find((item) => item.id === activeProfileId) ?? profiles[0],
    [activeProfileId, profiles]
  );

  const selectedApp = useMemo(
    () => managedApps.find((app) => app.id === selectedTargetId),
    [managedApps, selectedTargetId]
  );

  const permissionRows = useMemo(
    () =>
      REQUIRED_PERMISSION_KEYS.map((key) => {
        const state = permissionStates.find((permissionState) => permissionState.key === key);
        return {
          key,
          label: PERMISSION_LABELS[key],
          granted: state?.granted ?? false
        };
      }),
    [permissionStates]
  );

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      await bootstrap();
      await refreshPermissions();

      setLoadingApps(true);
      try {
        const apps = await enforcementService.listInstalledApps();
        if (mounted) {
          setManagedApps(apps);
        }
        if (apps.length > 0 && !apps.some((app) => app.id === selectedTargetId)) {
          setSelectedTargetId(apps[0]!.id);
        }
      } finally {
        if (mounted) {
          setLoadingApps(false);
        }
      }

      setLoadingLogs(true);
      try {
        const logs = await enforcementService.getDebugLogs();
        if (mounted) {
          setDebugLogs(logs);
        }
      } finally {
        if (mounted) {
          setLoadingLogs(false);
        }
      }
    };

    void initialize();
    return () => {
      mounted = false;
    };
  }, [bootstrap, refreshPermissions, setSelectedTargetId]);

  const refreshLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await enforcementService.getDebugLogs();
      setDebugLogs(logs);
    } finally {
      setLoadingLogs(false);
    }
  };

  const clearLogs = async () => {
    setLoadingLogs(true);
    try {
      await enforcementService.clearDebugLogs();
      setDebugLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const refreshApps = async () => {
    setLoadingApps(true);
    try {
      const apps = await enforcementService.listInstalledApps();
      setManagedApps(apps);
      if (apps.length > 0 && !apps.some((app) => app.id === selectedTargetId)) {
        setSelectedTargetId(apps[0]!.id);
      }
    } finally {
      setLoadingApps(false);
    }
  };

  const openPermissionSettings = async (permissionKey: PermissionKey) => {
    setBusyPermissionKey(permissionKey);
    try {
      await requestPermission(permissionKey);
      await refreshPermissions();
      await refreshLogs();
    } finally {
      setBusyPermissionKey(null);
    }
  };

  const onStart = async () => {
    if (!permissionsGranted || !profile || !selectedTargetId) {
      return;
    }
    setStarting(true);
    try {
      await startEnforcement();
      await refreshPermissions();
      await refreshLogs();
    } finally {
      setStarting(false);
    }
  };

  const onStop = async () => {
    setStopping(true);
    try {
      await stopEnforcement();
      await refreshPermissions();
      await refreshLogs();
    } finally {
      setStopping(false);
    }
  };

  const currentLimit = profile?.dailyLimitMinutes ?? 30;
  const canStart = permissionsGranted && !!selectedTargetId;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Boundly</Text>
        <Text style={styles.subtitle}>Allow permissions, pick one app, set daily minutes.</Text>
      </View>

      <Card>
        <Text style={styles.stepTitle}>Step 1: Allow permissions</Text>
        {permissionRows.map((row) => (
          <View key={row.key} style={styles.permissionRow}>
            <View style={styles.permissionLabelRow}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={row.granted ? styles.okText : styles.badText}>
                {row.granted ? "Granted" : "Missing"}
              </Text>
            </View>
            <Button
              label={
                busyPermissionKey === row.key ? "Opening..." : `Open ${row.label} settings`
              }
              variant={row.granted ? "secondary" : "primary"}
              onPress={() => {
                if (busyPermissionKey === null) {
                  void openPermissionSettings(row.key);
                }
              }}
            />
          </View>
        ))}
        <Button label="Refresh permission status" variant="secondary" onPress={refreshPermissions} />
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.stepTitle}>Step 2: Pick app</Text>
          <Button
            label={loadingApps ? "Loading..." : "Refresh apps"}
            variant="secondary"
            onPress={() => {
              if (!loadingApps) {
                void refreshApps();
              }
            }}
          />
        </View>
        {!permissionsGranted ? (
          <Text style={styles.helper}>Grant all 3 permissions first.</Text>
        ) : null}
        {managedApps.length === 0 ? (
          <Text style={styles.helper}>
            {loadingApps ? "Getting apps..." : "No apps found yet. Tap refresh apps."}
          </Text>
        ) : (
          <View style={styles.appGrid}>
            {managedApps.map((app) => {
              const selected = app.id === selectedTargetId;
              return (
                <Pressable
                  key={app.id}
                  style={[styles.appChip, selected ? styles.appChipActive : undefined]}
                  onPress={() => setSelectedTargetId(app.id)}
                >
                  <Text style={[styles.appChipText, selected ? styles.appChipTextActive : undefined]}>
                    {app.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.stepTitle}>Step 3: Set daily limit</Text>
        <Text style={styles.helper}>
          App: {selectedApp?.displayName ?? selectedTargetId ?? "Select an app"}
        </Text>
        <Text style={styles.limitText}>{currentLimit} min / day</Text>
        <View style={styles.limitRow}>
          <Button label="-5m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit - 5)} />
          <Button label="-1m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit - 1)} />
          <Button label="+1m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit + 1)} />
          <Button label="+5m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit + 5)} />
        </View>
      </Card>

      <Card>
        <Text style={styles.stepTitle}>Step 4: Start</Text>
        <View style={styles.permissionLabelRow}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{healthText(health.status)}</Text>
        </View>
        {health.detail ? <Text style={styles.badText}>{health.detail}</Text> : null}
        <View style={styles.startRow}>
          <Button
            label={starting ? "Starting..." : "Start enforcement"}
            variant={canStart ? "primary" : "secondary"}
            onPress={() => {
              if (!starting) {
                void onStart();
              }
            }}
          />
          <Button
            label={stopping ? "Stopping..." : "Stop"}
            variant="secondary"
            onPress={() => {
              if (!stopping) {
                void onStop();
              }
            }}
          />
        </View>
        {!isBootstrapped ? <Text style={styles.helper}>Loading setup...</Text> : null}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.stepTitle}>Error log</Text>
          <View style={styles.logButtons}>
            <Button
              label={loadingLogs ? "Loading..." : "Refresh"}
              variant="secondary"
              onPress={() => {
                if (!loadingLogs) {
                  void refreshLogs();
                }
              }}
            />
            <Button label="Clear" variant="secondary" onPress={() => void clearLogs()} />
          </View>
        </View>
        {debugLogs.length === 0 ? (
          <Text style={styles.helper}>No errors yet.</Text>
        ) : (
          debugLogs.slice(0, 20).map((logLine, index) => (
            <Text key={`${logLine}-${index}`} style={styles.logLine}>
              {logLine}
            </Text>
          ))
        )}
      </Card>
    </Screen>
  );
}

export default function App(): React.JSX.Element {
  return <AppContainer />;
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  stepTitle: {
    ...typography.heading
  },
  permissionRow: {
    gap: spacing.sm
  },
  permissionLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  appGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  appChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  appChipActive: {
    backgroundColor: colors.success,
    borderColor: colors.success
  },
  appChipText: {
    color: colors.textPrimary,
    fontWeight: "500"
  },
  appChipTextActive: {
    color: "#FFFFFF"
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary
  },
  label: {
    ...typography.body
  },
  value: {
    ...typography.body,
    fontWeight: "600"
  },
  okText: {
    ...typography.caption,
    color: colors.success
  },
  badText: {
    ...typography.caption,
    color: colors.danger
  },
  limitText: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 30
  },
  limitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  startRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  logButtons: {
    flexDirection: "row",
    gap: spacing.sm
  },
  logLine: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary
  }
});
