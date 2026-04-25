import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import type { CellValue, Grid } from "../../game/sudoku/types";

interface Props {
  /** Used to compute which digits already have all 9 instances placed. */
  grid: Grid;
  notesMode: boolean;
  onDigit: (digit: CellValue) => void;
  onErase: () => void;
  onToggleNotes: () => void;
}

const DIGITS: readonly CellValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIGIT_ROWS: readonly (readonly CellValue[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

function countValue(grid: Grid, digit: CellValue): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell.value === digit) n++;
  return n;
}

export default function NumberPad({ grid, notesMode, onDigit, onErase, onToggleNotes }: Props) {
  const { t } = useTranslation("sudoku");
  const { colors } = useTheme();

  // Dim digits where all 9 instances are already placed. Recomputed on
  // every render so that placing the 9th "8" immediately dims its key
  // without waiting for another re-render trigger.
  const completed = useMemo<ReadonlySet<CellValue>>(() => {
    const done = new Set<CellValue>();
    for (const d of DIGITS) if (countValue(grid, d) === 9) done.add(d);
    return done;
  }, [grid]);

  return (
    <View style={styles.pad}>
      <View style={styles.digitGrid}>
        {DIGIT_ROWS.map((row, ri) => (
          <View key={ri} style={styles.digitRow}>
            {row.map((d) => {
              const disabled = completed.has(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => onDigit(d)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={t("numberPad.digit", {
                    digit: d,
                    defaultValue: `Enter digit ${d}`,
                  })}
                  accessibilityState={{ disabled }}
                  style={[
                    styles.digitBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: disabled ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.digitText, { color: colors.text }]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={onToggleNotes}
          accessibilityRole="button"
          accessibilityLabel={t("numberPad.toggleNotes", {
            defaultValue: "Toggle pencil marks",
          })}
          accessibilityState={{ selected: notesMode }}
          style={[
            styles.actionBtn,
            {
              backgroundColor: notesMode ? colors.accent : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.actionText, { color: notesMode ? colors.textOnAccent : colors.text }]}
          >
            {t("numberPad.notes", { defaultValue: "Notes" })}
          </Text>
        </Pressable>
        <Pressable
          onPress={onErase}
          accessibilityRole="button"
          accessibilityLabel={t("numberPad.erase", {
            defaultValue: "Erase cell",
          })}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>
            {t("numberPad.eraseShort", { defaultValue: "Erase" })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    alignItems: "center",
    gap: 12,
  },
  digitGrid: {
    gap: 8,
  },
  digitRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  digitBtn: {
    width: 64,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  digitText: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "stretch",
    maxWidth: 280,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
