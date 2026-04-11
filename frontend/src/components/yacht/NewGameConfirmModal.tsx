import React from "react";
import { Modal, View, Text, Pressable, StyleSheet, Platform, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function NewGameConfirmModal({ visible, onConfirm, onCancel }: Props) {
  const { t } = useTranslation("yacht");
  const { colors } = useTheme();

  const confirmBg: ViewStyle =
    Platform.OS === "web"
      ? ({
          backgroundImage: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBright})`,
          boxShadow: `0 0 20px ${colors.accent}55`,
        } as ViewStyle)
      : { backgroundColor: colors.accentBright };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessibilityViewIsModal
      onRequestClose={onCancel}
    >
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceHigh,
              borderColor: colors.border,
              borderTopColor: colors.accent,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t("newGame.confirm.title")}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {t("newGame.confirm.body")}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              confirmBg,
              pressed ? { transform: [{ scale: 0.96 }] } : null,
            ]}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={t("newGame.confirm.confirm")}
          >
            <Text style={[styles.confirmText, { color: colors.textOnAccent }]}>
              {t("newGame.confirm.confirm")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t("newGame.confirm.cancel")}
          >
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>
              {t("newGame.confirm.cancel")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderTopWidth: 3,
    padding: 24,
    alignItems: "center",
    width: "86%",
    maxWidth: 360,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  confirmButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 10,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
