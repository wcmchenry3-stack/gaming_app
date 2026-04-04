import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface GameOverlayProps {
  type: "game_over" | "win";
  score: number;
  onNewGame: () => void;
  onKeepPlaying?: () => void;
  onHome: () => void;
}

export default function GameOverlay({
  type,
  score,
  onNewGame,
  onKeepPlaying,
  onHome,
}: GameOverlayProps) {
  const { t } = useTranslation(["twenty48", "common"]);
  const { colors } = useTheme();

  const isWin = type === "win";
  const title = isWin ? t("twenty48:win.title") : t("twenty48:gameOver.title");
  const body = isWin ? t("twenty48:win.body") : t("twenty48:gameOver.body", { score });

  return (
    <View style={styles.backdrop}>
      <View style={[styles.modal, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>

        <View style={styles.buttons}>
          {isWin && onKeepPlaying && (
            <Pressable
              style={[styles.btn, { backgroundColor: colors.accent }]}
              onPress={onKeepPlaying}
              accessibilityRole="button"
              accessibilityLabel={t("twenty48:actions.keepPlayingLabel")}
            >
              <Text style={[styles.btnText, { color: colors.surface }]}>
                {t("twenty48:actions.keepPlaying")}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={onNewGame}
            accessibilityRole="button"
            accessibilityLabel={t("twenty48:actions.newGameLabel")}
          >
            <Text style={[styles.btnText, { color: colors.surface }]}>
              {t("twenty48:actions.newGame")}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.outlineBtn, { borderColor: colors.border }]}
            onPress={onHome}
            accessibilityRole="button"
            accessibilityLabel={t("twenty48:actions.quitLabel")}
          >
            <Text style={[styles.btnText, { color: colors.text }]}>
              {t("twenty48:gameOver.home")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  modal: {
    borderRadius: 16,
    padding: 28,
    width: "85%",
    maxWidth: 340,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  body: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  buttons: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  btn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  outlineBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
