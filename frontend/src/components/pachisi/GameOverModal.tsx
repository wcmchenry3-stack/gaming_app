import React from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  visible: boolean;
  winner: string | null;
  humanPlayer: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function PachisiGameOverModal({
  visible,
  winner,
  humanPlayer,
  onPlayAgain,
  onHome,
}: Props) {
  const { t } = useTranslation("pachisi");
  const { colors } = useTheme();

  const humanWon = winner === humanPlayer;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t("gameOver.title")}</Text>
          <Text style={[styles.result, { color: colors.accent }]}>
            {humanWon ? t("gameOver.youWin") : t("gameOver.cpuWins")}
          </Text>
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
            style={[styles.btn, styles.homeBtn, { borderColor: colors.border }]}
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
    maxWidth: 320,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  result: {
    fontSize: 32,
    fontWeight: "800",
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  btn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  homeBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
