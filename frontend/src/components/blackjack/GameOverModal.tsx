import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  visible: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function GameOverModal({ visible, onPlayAgain, onHome }: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.error,
              borderTopColor: colors.error,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.error }]}>{t("gameOver.title")}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{t("gameOver.body")}</Text>

          <Pressable
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={onPlayAgain}
            accessibilityRole="button"
            accessibilityLabel={t("gameOver.playAgainLabel")}
          >
            <Text style={[styles.btnText, { color: colors.surface }]}>
              {t("gameOver.playAgain")}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
            onPress={onHome}
            accessibilityRole="button"
            accessibilityLabel={t("gameOver.homeLabel")}
          >
            <Text style={[styles.btnText, { color: colors.text }]}>{t("gameOver.home")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    borderTopWidth: 4,
    padding: 28,
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  btn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
