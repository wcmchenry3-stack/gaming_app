import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import type { NoteDigit, SudokuCell as SudokuCellData } from "../../game/sudoku/types";

interface Props {
  cell: SudokuCellData;
  row: number;
  col: number;
  selected: boolean;
  /** Non-selected cell that holds the same digit as the selected cell. */
  highlighted: boolean;
  onPress: () => void;
}

const NOTE_DIGITS: readonly NoteDigit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function SudokuCell({ cell, row, col, selected, highlighted, onPress }: Props) {
  const { t } = useTranslation("sudoku");
  const { colors } = useTheme();

  const background = selected
    ? // 20% tint of the accent colour — tokens don't expose a pre-mixed
      // "accent-dim" so we piggyback on surfaceHigh and the accent border
      // for the selection affordance.
      colors.surfaceHigh
    : highlighted
      ? colors.surfaceAlt
      : colors.surface;

  const borderColor = selected ? colors.accent : colors.border;

  const valueColor = cell.given ? colors.text : cell.isError ? colors.error : colors.accent;

  const label = t("cell.label", {
    row: row + 1,
    col: col + 1,
    value: cell.value === 0 ? t("cell.empty") : String(cell.value),
    defaultValue: `Cell row ${row + 1}, column ${col + 1}, ${cell.value === 0 ? "empty" : cell.value}`,
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.cell,
        {
          backgroundColor: background,
          borderColor,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {cell.value !== 0 ? (
        <Text style={[styles.value, { color: valueColor, fontWeight: cell.given ? "700" : "600" }]}>
          {cell.value}
        </Text>
      ) : cell.notes.size > 0 ? (
        <View style={styles.notesGrid}>
          {NOTE_DIGITS.map((d) => (
            <Text
              key={d}
              style={[styles.note, { color: cell.notes.has(d) ? colors.textMuted : "transparent" }]}
            >
              {d}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 22,
  },
  notesGrid: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  note: {
    width: "33.33%",
    textAlign: "center",
    fontSize: 9,
    lineHeight: 11,
  },
});
