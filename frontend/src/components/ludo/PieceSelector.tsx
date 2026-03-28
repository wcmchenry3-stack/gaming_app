import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { PLAYER_COLORS } from "./boardLayout";

interface Props {
  validMoves: number[];
  playerColor: string;
  onSelect: (pieceIndex: number) => void;
  loading: boolean;
}

export default function PieceSelector({ validMoves, playerColor, onSelect, loading }: Props) {
  const { t } = useTranslation("ludo");
  const { colors } = useTheme();
  const dotColor = PLAYER_COLORS[playerColor] ?? playerColor;

  return (
    <View style={styles.container}>
      {validMoves.map((idx) => (
        <Pressable
          key={idx}
          style={[styles.btn, { backgroundColor: dotColor }]}
          onPress={() => onSelect(idx)}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={t("actions.movePieceLabel", { index: idx + 1 })}
          accessibilityState={{ disabled: loading }}
        >
          <Text style={[styles.btnText, { color: colors.surface }]}>
            {t("actions.movePiece", { index: idx + 1 })}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
