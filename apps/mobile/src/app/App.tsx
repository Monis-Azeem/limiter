import type { AppTarget, PermissionKey } from "@boundly/domain";
import { Button, Card, Screen, colors, spacing } from "@boundly/ui-kit";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
  const [appQuery, setAppQuery] = useState("");

  const {
    profiles,
    activeProfileId,
    selectedTargetId,
    permissionStates,
    permissionsGranted,
    health,
    isBootstrapped,
    liveUsage,
    bootstrap,
    requestPermission,
    refreshPermissions,
    setSelectedTargetId,
    setDailyLimitMinutes,
    startEnforcement,
    stopEnforcement,
    syncFromNativeUsage,
    refreshLiveUsage
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

  const filteredManagedApps = useMemo(() => {
    const query = appQuery.trim().toLowerCase();
    if (!query) {
      return managedApps;
    }
    return managedApps.filter((app) => app.displayName.toLowerCase().includes(query));
  }, [appQuery, managedApps]);

  const filteredLiveUsage = useMemo(() => {
    const query = appQuery.trim().toLowerCase();
    if (!query) {
      return liveUsage;
    }
    return liveUsage.filter((row) => row.displayName.toLowerCase().includes(query));
  }, [appQuery, liveUsage]);

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

      await refreshLiveUsage();
    };

    void initialize();
    return () => {
      mounted = false;
    };
  }, [bootstrap, refreshPermissions, refreshLiveUsage, setSelectedTargetId]);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }
    const interval = setInterval(() => {
      void syncFromNativeUsage();
      void refreshLiveUsage();
    }, 12_000);
    return () => clearInterval(interval);
  }, [isBootstrapped, refreshLiveUsage, syncFromNativeUsage]);

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
      await refreshLiveUsage();
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
      await syncFromNativeUsage();
      await refreshLiveUsage();
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
      await syncFromNativeUsage();
      await refreshLiveUsage();
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
        <Text style={styles.subtitle}>Allow permissions, pick app, set minutes, start.</Text>
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
        <TextInput
          value={appQuery}
          onChangeText={setAppQuery}
          placeholder="Search apps"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {!permissionsGranted ? <Text style={styles.helper}>Grant all 3 permissions first.</Text> : null}
        {filteredManagedApps.length === 0 ? (
          <Text style={styles.helper}>
            {loadingApps ? "Getting apps..." : "No apps found. Tap refresh apps."}
          </Text>
        ) : (
          <View style={styles.appList}>
            {filteredManagedApps.slice(0, 120).map((app) => {
              const selected = app.id === selectedTargetId;
              return (
                <Pressable
                  key={app.id}
                  style={[styles.appRow, selected ? styles.appRowActive : undefined]}
                  onPress={() => setSelectedTargetId(app.id)}
                >
                  <Text style={[styles.appRowText, selected ? styles.appRowTextActive : undefined]}>
                    {app.displayName}
                  </Text>
                  {selected ? <Text style={styles.appRowBadge}>Selected</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.stepTitle}>Step 3: Set daily limit</Text>
        <Text style={styles.helper}>App: {selectedApp?.displayName ?? selectedTargetId ?? "Select an app"}</Text>
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
          <Text style={styles.stepTitle}>Enforcement live now</Text>
          <Button
            label="Refresh"
            variant="secondary"
            onPress={() => {
              void syncFromNativeUsage();
              void refreshLiveUsage();
            }}
          />
        </View>
        {filteredLiveUsage.length === 0 ? (
          <Text style={styles.helper}>No app usage data yet.</Text>
        ) : (
          <View style={styles.liveList}>
            {filteredLiveUsage.slice(0, 160).map((row) => {
              const status = row.blockedNow ? "Blocked" : row.enforced ? "Live" : "Not managed";
              const usageText = row.enforced && row.dailyLimitMinutes !== undefined
                ? `${row.minutesUsedToday} / ${row.dailyLimitMinutes} min`
                : `${row.minutesUsedToday} min`;
              return (
                <View key={row.appId} style={styles.liveRow}>
                  <View style={styles.liveMain}>
                    <Text style={styles.liveTitle}>{row.displayName}</Text>
                    <Text style={styles.helper}>{usageText}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      row.blockedNow
                        ? styles.statusBlocked
                        : row.enforced
                          ? styles.statusLive
                          : styles.statusIdle
                    ]}
                  >
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
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
  searchInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  appList: {
    gap: spacing.sm
  },
  appRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  appRowActive: {
    borderColor: colors.success,
    backgroundColor: "#ECFDF5"
  },
  appRowText: {
    ...typography.body,
    color: colors.textPrimary
  },
  appRowTextActive: {
    fontWeight: "600"
  },
  appRowBadge: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "700"
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
  liveList: {
    gap: spacing.sm
  },
  liveRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  liveMain: {
    flex: 1,
    gap: spacing.xs
  },
  liveTitle: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  statusLive: {
    backgroundColor: "#ECFDF5"
  },
  statusBlocked: {
    backgroundColor: "#FEF2F2"
  },
  statusIdle: {
    backgroundColor: colors.surface
  },
  statusText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700"
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
