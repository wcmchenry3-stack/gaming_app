/**
 * CapacityWarningToast — #483 (blocker for #373 scenario 6).
 *
 * Polls `eventStore.shouldShowCapacityWarning()` on a short interval
 * and renders a top-of-screen banner when the queue crosses the 80%
 * fill ratio. Dismiss marks the warning shown, which activates the
 * 24h suppression window inside eventStore.markWarningShown().
 *
 * Mount this once at a provider level (NetworkContext) — it's a
 * cross-app concern, not per-screen. The component positions itself
 * absolutely at the top of the screen with a high zIndex so it
 * overlays any child screen without needing navigation context.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react-native";
import { useTheme } from "../../theme/ThemeContext";
import { eventStore } from "../../game/_shared/eventStore";

/** How often to check whether the warning should be shown. */
const POLL_INTERVAL_MS = 30_000;

interface Props {
  /**
   * Optional override for the check function — lets unit tests supply
   * a synchronous stub without mocking the whole eventStore singleton.
   * Production code never passes this.
   */
  shouldShowCheck?: () => Promise<boolean>;
  /** Optional override for the "mark shown" side effect. */
  markShown?: () => Promise<void>;
  /** Override for testing the poll interval. */
  pollIntervalMs?: number;
}

export function CapacityWarningToast({
  shouldShowCheck,
  markShown,
  pollIntervalMs = POLL_INTERVAL_MS,
}: Props = {}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(false);

  const check = shouldShowCheck ?? (() => eventStore.shouldShowCapacityWarning());
  const mark = markShown ?? (() => eventStore.markWarningShown());

  const runCheck = useCallback(async () => {
    try {
      const should = await check();
      if (should) setVisible(true);
    } catch (e) {
      Sentry.captureException(e, {
        tags: { subsystem: "capacityWarningToast", op: "check" },
      });
    }
    // check is captured from props — caller supplies a stable ref in tests
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First check fires immediately on mount, then on the interval.
  useEffect(() => {
    void runCheck();
    const id = setInterval(runCheck, pollIntervalMs);
    return () => clearInterval(id);
  }, [runCheck, pollIntervalMs]);

  const onDismiss = useCallback(() => {
    setVisible(false);
    mark().catch((e) => {
      Sentry.captureException(e, {
        tags: { subsystem: "capacityWarningToast", op: "markShown" },
      });
    });
    // mark is captured from props — caller supplies a stable ref in tests
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          top: insets.top + 12,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID="capacity-warning-toast"
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{t("capacityWarning.title")}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t("capacityWarning.body")}</Text>
      </View>
      <Pressable
        onPress={onDismiss}
        style={[styles.dismissButton, { borderColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t("capacityWarning.dismiss")}
        testID="capacity-warning-dismiss"
      >
        <Text style={[styles.dismissText, { color: colors.accent }]}>
          {t("capacityWarning.dismiss")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    // High enough to overlay any screen content, lower than modal scrims.
    zIndex: 9999,
    // RN native elevation for Android shadow parity with web zIndex.
    elevation: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
  },
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
  },
  dismissText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
