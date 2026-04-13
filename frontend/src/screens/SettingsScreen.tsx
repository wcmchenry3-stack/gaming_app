import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react-native";
import { useTheme } from "../theme/ThemeContext";
import { MODAL_SCRIM } from "../theme/theme.constants";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { AppHeader, APP_HEADER_HEIGHT } from "../components/shared/AppHeader";
import { gameEventClient } from "../game/_shared/gameEventClient";

export default function SettingsScreen() {
  const { colors, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const handleClearLogs = async () => {
    setConfirmVisible(false);
    try {
      await gameEventClient.clearAll();
      setSuccessVisible(true);
      setTimeout(() => setSuccessVisible(false), 2000);
    } catch (e) {
      Sentry.captureException(e, {
        tags: { subsystem: "settings", op: "clearLogs" },
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: APP_HEADER_HEIGHT + insets.top },
      ]}
    >
      <AppHeader title={t("nav.settings")} />

      <View style={[styles.row, { borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>{t("theme.label", "Theme")}</Text>
        <Pressable
          onPress={toggle}
          style={[styles.toggle, { backgroundColor: colors.surfaceAlt }]}
          testID="theme-toggle-button"
          accessibilityRole="button"
          accessibilityLabel={t("theme.switchTo", {
            mode: theme === "dark" ? t("theme.light") : t("theme.dark"),
          })}
        >
          <Text style={{ color: colors.text }}>
            {theme === "dark" ? t("theme.light", "Light") : t("theme.dark", "Dark")}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("settings.language", "Language")}
        </Text>
        <LanguageSwitcher />
      </View>

      <View style={[styles.rowStacked, { borderColor: colors.border }]}>
        <View style={styles.rowStackedText}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t("clearLogs.label", "Clear local logs")}
          </Text>
          <Text style={[styles.description, { color: colors.text, opacity: 0.7 }]}>
            {t("clearLogs.description")}
          </Text>
        </View>
        <Pressable
          onPress={() => setConfirmVisible(true)}
          style={[styles.destructive, { backgroundColor: colors.surfaceAlt }]}
          testID="clear-logs-button"
          accessibilityRole="button"
          accessibilityLabel={t("clearLogs.label")}
        >
          <Text style={{ color: colors.text }}>{t("clearLogs.button", "Clear")}</Text>
        </Pressable>
      </View>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: MODAL_SCRIM }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("clearLogs.confirm.title")}
            </Text>
            <Text style={[styles.modalBody, { color: colors.text }]}>
              {t("clearLogs.confirm.body")}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmVisible(false)}
                style={[styles.modalButton, { backgroundColor: colors.surfaceAlt }]}
                testID="clear-logs-cancel"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.text }}>{t("clearLogs.confirm.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={handleClearLogs}
                style={[styles.modalButton, { backgroundColor: colors.error }]}
                testID="clear-logs-confirm"
                accessibilityRole="button"
              >
                <Text style={[styles.modalDestructiveText, { color: colors.textOnAccent }]}>
                  {t("clearLogs.confirm.confirm")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {successVisible && (
        <View style={[styles.toast, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text }}>{t("clearLogs.success")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  rowStacked: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowStackedText: { flex: 1 },
  label: { fontSize: 16 },
  description: { fontSize: 13, marginTop: 4 },
  toggle: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  destructive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  modalBody: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalDestructiveText: { fontWeight: "600" },
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 4,
  },
});
