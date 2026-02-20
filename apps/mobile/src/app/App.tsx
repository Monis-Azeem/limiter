import type { AppTarget } from "@boundly/domain";
import { Screen, colors, spacing } from "@boundly/ui-kit";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { InsightsScreen } from "../features/insights/InsightsScreen";
import { LockScreen } from "../features/lock/LockScreen";
import { OnboardingScreen } from "../features/onboarding/OnboardingScreen";
import { RulesScreen } from "../features/rules/RulesScreen";
import { enforcementService } from "../services/enforcement-service";
import { useAppStore, type AppTab } from "../stores/useAppStore";
import { typography } from "../theme/typography";

const TABS: AppTab[] = ["onboarding", "dashboard", "rules", "lock", "insights"];

function TabPill({
  tab,
  activeTab,
  onPress
}: {
  tab: AppTab;
  activeTab: AppTab;
  onPress: (tab: AppTab) => void;
}): React.JSX.Element {
  const active = activeTab === tab;
  return (
    <Pressable
      style={[styles.tabPill, active ? styles.tabPillActive : undefined]}
      onPress={() => onPress(tab)}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : undefined]}>{tab}</Text>
    </Pressable>
  );
}

function AppContainer(): React.JSX.Element {
  const [managedApps, setManagedApps] = useState<AppTarget[]>([]);
  const {
    activeTab,
    profiles,
    activeProfileId,
    usage,
    selectedTargetId,
    permissionsGranted,
    permissionStates,
    health,
    decision,
    isBootstrapped,
    setActiveTab,
    setActiveProfile,
    setSelectedTargetId,
    setDailyLimitMinutes,
    setDailyOpenLimit,
    recordOpenAttempt,
    addUsageMinutes,
    confirmIntent,
    satisfyDelay,
    resetAttemptState,
    useEmergencyOverride,
    bootstrap,
    requestPermission,
    refreshPermissions,
    syncFromNativeUsage,
    startEnforcement
  } = useAppStore();

  const profile = useMemo(
    () => profiles.find((item) => item.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId]
  );

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      await bootstrap();
      const apps = await enforcementService.listInstalledApps();
      if (mounted) {
        setManagedApps(apps);
      }
    };

    void initialize();

    return () => {
      mounted = false;
    };
  }, [bootstrap]);

  useEffect(() => {
    const interval = setInterval(() => {
      void syncFromNativeUsage();
    }, 30_000);

    return () => clearInterval(interval);
  }, [syncFromNativeUsage]);

  const content = useMemo(() => {
    if (activeTab === "onboarding") {
      return (
        <OnboardingScreen
          permissionsGranted={permissionsGranted}
          healthStatus={health.status}
          {...(health.detail ? { healthDetail: health.detail } : {})}
          permissionStates={permissionStates}
          managedApps={managedApps}
          onRequestPermission={(permissionKey) => {
            void requestPermission(permissionKey);
          }}
          onRefreshPermissions={() => {
            void refreshPermissions();
          }}
          onStartEnforcement={() => {
            void startEnforcement();
          }}
          onContinue={() => setActiveTab("dashboard")}
        />
      );
    }

    if (activeTab === "dashboard") {
      if (!profile) {
        return null;
      }

      return (
        <DashboardScreen
          profile={profile}
          selectedTargetId={selectedTargetId}
          usage={usage}
          decision={decision}
          onRecordOpenAttempt={() => {
            void recordOpenAttempt();
          }}
          onAddUsageMinutes={(minutes) => {
            void addUsageMinutes(minutes);
          }}
          onConfirmIntent={confirmIntent}
          onSatisfyDelay={satisfyDelay}
          onResetAttempt={resetAttemptState}
        />
      );
    }

    if (activeTab === "rules") {
      if (!profile) {
        return null;
      }

      return (
        <RulesScreen
          profiles={profiles}
          activeProfileId={activeProfileId}
          profile={profile}
          managedApps={managedApps}
          selectedTargetId={selectedTargetId}
          onSelectProfile={setActiveProfile}
          onSelectTarget={setSelectedTargetId}
          onSetDailyLimitMinutes={setDailyLimitMinutes}
          onSetDailyOpenLimit={setDailyOpenLimit}
        />
      );
    }

    if (activeTab === "lock") {
      if (!profile) {
        return null;
      }

      return (
        <LockScreen
          decision={decision}
          profile={profile}
          usage={usage}
          onEmergencyOverride={() => {
            void useEmergencyOverride();
          }}
        />
      );
    }

    if (!profile) {
      return null;
    }

    return <InsightsScreen profile={profile} usage={usage} />;
  }, [
    activeTab,
    permissionsGranted,
    health.status,
    permissionStates,
    managedApps,
    requestPermission,
    refreshPermissions,
    startEnforcement,
    setActiveTab,
    profiles,
    activeProfileId,
    setActiveProfile,
    profile,
    usage,
    selectedTargetId,
    decision,
    recordOpenAttempt,
    addUsageMinutes,
    confirmIntent,
    satisfyDelay,
    resetAttemptState,
    setSelectedTargetId,
    setDailyLimitMinutes,
    setDailyOpenLimit,
    useEmergencyOverride
  ]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.title}>Boundly</Text>
        <Text style={styles.subtitle}>
          {isBootstrapped ? "Offline hard enforcement prototype" : "Bootstrapping local enforcement"}
        </Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TabPill key={tab} tab={tab} activeTab={activeTab} onPress={setActiveTab} />
        ))}
      </View>

      {content}
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
    ...typography.caption
  },
  tabBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tabPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  tabPillActive: {
    borderColor: colors.success,
    backgroundColor: colors.success
  },
  tabText: {
    color: colors.textPrimary,
    fontWeight: "500"
  },
  tabTextActive: {
    color: "#FFFFFF"
  }
});
