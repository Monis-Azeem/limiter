import type { AppTarget, PermissionKey } from "@boundly/domain";
import { Button, Card, Screen, colors, spacing } from "@boundly/ui-kit";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { enforcementService } from "../services/enforcement-service";
import { useAppStore } from "../stores/useAppStore";
import { typography } from "../theme/typography";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const appIcon = require("../../assets/icon.png");

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
    removeTargetFromEnforcement,
    setDailyLimitMinutes,
    startEnforcement,
    stopEnforcement,
    syncFromNativeUsage,
    refreshLiveUsage
  } = useAppStore();

  const profileByTargetId = useMemo(() => {
    const map = new Map<string, (typeof profiles)[number]>();
    profiles.forEach((profile) => {
      const targetId = profile.targetAppIds[0];
      if (targetId) {
        map.set(targetId, profile);
      }
    });
    return map;
  }, [profiles]);

  const selectedProfile = useMemo(
    () => profileByTargetId.get(selectedTargetId),
    [profileByTargetId, selectedTargetId]
  );

  const selectedApp = useMemo(
    () => managedApps.find((app) => app.id === selectedTargetId),
    [managedApps, selectedTargetId]
  );

  const enforcedTargetIds = useMemo(
    () => new Set(profiles.flatMap((profile) => profile.targetAppIds)),
    [profiles]
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

  const managedLiveUsage = useMemo(() => {
    const enforced = liveUsage.filter((row) => row.enforced);
    const query = appQuery.trim().toLowerCase();
    if (!query) {
      return enforced;
    }
    return enforced.filter((row) => row.displayName.toLowerCase().includes(query));
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
    if (!permissionsGranted || profiles.length === 0 || !selectedTargetId) {
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

  const currentLimit = selectedProfile?.dailyLimitMinutes ?? 15;
  const canStart = permissionsGranted && profiles.length > 0;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image source={appIcon} style={styles.headerIcon} />
          <View style={styles.headerText}>
            <Text style={typography.title}>Limiter</Text>
            <Text style={styles.subtitle}>Take control of your screen time</Text>
          </View>
        </View>
      </View>

      <Card>
        <Text style={styles.stepTitle}>Setup Guide</Text>
        <Text style={styles.helper}>
          Since this app is not from the Play Store, follow these steps first:
        </Text>
        <View style={styles.setupStep}>
          <Text style={styles.setupNumber}>1</Text>
          <View style={styles.setupContent}>
            <Text style={styles.setupLabel}>Pause Play Protect</Text>
            <Text style={styles.setupDesc}>
              Open Play Store {'>'} tap your profile icon {'>'} Play Protect {'>'} Settings gear {'>'} turn off "Scan apps with Play Protect"
            </Text>
          </View>
        </View>
        <View style={styles.setupStep}>
          <Text style={styles.setupNumber}>2</Text>
          <View style={styles.setupContent}>
            <Text style={styles.setupLabel}>Allow unknown apps</Text>
            <Text style={styles.setupDesc}>
              Settings {'>'} Apps {'>'} Special app access {'>'} Install unknown apps {'>'} allow the source you used
            </Text>
          </View>
        </View>
        <View style={styles.setupStep}>
          <Text style={styles.setupNumber}>3</Text>
          <View style={styles.setupContent}>
            <Text style={styles.setupLabel}>Allow restricted settings</Text>
            <Text style={styles.setupDesc}>
              Settings {'>'} Apps {'>'} Limiter {'>'} tap the three dots (top right) {'>'} "Allow restricted settings"
            </Text>
          </View>
        </View>
        <Text style={styles.helper}>
          After these steps, grant the permissions below.
        </Text>
      </Card>

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
            label={loadingApps ? "Loading..." : "Refresh"}
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
            {loadingApps ? "Getting apps..." : "No apps found. Tap refresh."}
          </Text>
        ) : (
          <View style={styles.appListContainer}>
            <ScrollView nestedScrollEnabled style={styles.appListScroll}>
              {filteredManagedApps.map((app) => {
                const selected = app.id === selectedTargetId;
                const enforced = enforcedTargetIds.has(app.id);
                return (
                  <Pressable
                    key={app.id}
                    style={[styles.appRow, selected ? styles.appRowActive : undefined]}
                    onPress={() => setSelectedTargetId(app.id)}
                  >
                    <Text style={[styles.appRowText, selected ? styles.appRowTextActive : undefined]}>
                      {app.displayName}
                    </Text>
                    <View style={styles.appBadges}>
                      {enforced ? <Text style={styles.appRowBadge}>Enforced</Text> : null}
                      {selected ? <Text style={styles.appRowBadgeMuted}>Selected</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.stepTitle}>Step 3: Set daily limit</Text>
        <Text style={styles.helper}>App: {selectedApp?.displayName ?? selectedTargetId ?? "Select an app"}</Text>
        <Text style={styles.limitText}>{currentLimit} min / day</Text>
        <Text style={styles.helper}>
          {selectedProfile ? "This app is currently enforced." : "Not enforced yet. Add it with a limit."}
        </Text>
        <View style={styles.limitRow}>
          <Button label="-5m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit - 5)} />
          <Button label="-1m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit - 1)} />
          <Button label="+1m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit + 1)} />
          <Button label="+5m" variant="secondary" onPress={() => setDailyLimitMinutes(currentLimit + 5)} />
        </View>
        <View style={styles.startRow}>
          <Button
            label={selectedProfile ? "Update limit" : "Add to enforcement"}
            variant="primary"
            onPress={() => setDailyLimitMinutes(currentLimit)}
          />
          {selectedProfile ? (
            <Button
              label="Remove app"
              variant="secondary"
              onPress={() => {
                void removeTargetFromEnforcement(selectedTargetId);
              }}
            />
          ) : null}
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
        {profiles.length === 0 ? <Text style={styles.helper}>Add at least one app to enforcement first.</Text> : null}
        {!isBootstrapped ? <Text style={styles.helper}>Loading setup...</Text> : null}
      </Card>

      <Card>
        <Text style={styles.stepTitle}>Managed apps</Text>
        {profiles.length === 0 ? (
          <Text style={styles.helper}>No apps enforced yet.</Text>
        ) : (
          <View style={styles.liveList}>
            {profiles.map((profileItem) => {
              const targetId = profileItem.targetAppIds[0]!;
              const appLabel = managedApps.find((app) => app.id === targetId)?.displayName ?? targetId;
              return (
                <View key={profileItem.id} style={styles.liveRow}>
                  <View style={styles.liveMain}>
                    <Text style={styles.liveTitle}>{appLabel}</Text>
                    <Text style={styles.helper}>{profileItem.dailyLimitMinutes} min / day</Text>
                  </View>
                  <View style={styles.managedActions}>
                    <Button
                      label="-1m"
                      variant="secondary"
                      onPress={() => {
                        setSelectedTargetId(targetId);
                        setDailyLimitMinutes(profileItem.dailyLimitMinutes - 1);
                      }}
                    />
                    <Button
                      label="+1m"
                      variant="secondary"
                      onPress={() => {
                        setSelectedTargetId(targetId);
                        setDailyLimitMinutes(profileItem.dailyLimitMinutes + 1);
                      }}
                    />
                    <Button
                      label="Remove"
                      variant="secondary"
                      onPress={() => {
                        void removeTargetFromEnforcement(targetId);
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.stepTitle}>Live usage</Text>
          <Button
            label="Refresh"
            variant="secondary"
            onPress={() => {
              void syncFromNativeUsage();
              void refreshLiveUsage();
            }}
          />
        </View>
        {managedLiveUsage.length === 0 ? (
          <Text style={styles.helper}>No managed app usage data yet.</Text>
        ) : (
          <View style={styles.liveListContainer}>
            <ScrollView nestedScrollEnabled style={styles.liveListScroll}>
              {managedLiveUsage.map((row) => {
                const status = row.blockedNow ? "Blocked" : "Live";
                const usageText = row.dailyLimitMinutes !== undefined
                  ? `${row.minutesUsedToday} / ${row.dailyLimitMinutes} min (${Math.max(0, row.dailyLimitMinutes - row.minutesUsedToday)} left)`
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
                        row.blockedNow ? styles.statusBlocked : styles.statusLive
                      ]}
                    >
                      <Text style={styles.statusText}>{status}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12
  },
  headerText: {
    flex: 1,
    gap: 2
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14
  },
  stepTitle: {
    ...typography.heading
  },
  setupStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm
  },
  setupNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.success,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 26,
    textAlign: "center",
    overflow: "hidden"
  },
  setupContent: {
    flex: 1,
    gap: 2
  },
  setupLabel: {
    ...typography.body,
    fontWeight: "600"
  },
  setupDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18
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
  appListContainer: {
    maxHeight: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden"
  },
  appListScroll: {
    paddingVertical: spacing.xs
  },
  appRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  appRowActive: {
    backgroundColor: "#ECFDF5"
  },
  appRowText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1
  },
  appRowTextActive: {
    fontWeight: "600"
  },
  appBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  appRowBadge: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "700"
  },
  appRowBadgeMuted: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600"
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
  liveListContainer: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden"
  },
  liveListScroll: {
    paddingVertical: spacing.xs
  },
  liveRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
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
  statusText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "700"
  },
  logButtons: {
    flexDirection: "row",
    gap: spacing.sm
  },
  managedActions: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
    justifyContent: "flex-end"
  },
  logLine: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary
  }
});
