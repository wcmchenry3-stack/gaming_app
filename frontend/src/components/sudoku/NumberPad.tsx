import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import type { CellValue, Grid, Variant } from "../../game/sudoku/types";
import { variantConfig } from "../../game/sudoku/types";

interface Props {
  /** Used to compute which digits already have all instances placed. */
  grid: Grid;
  variant: Variant;
  notesMode: boolean;
  onDigit: (digit: CellValue) => void;
  onErase: () => void;
  onToggleNotes: () => void;
}

function countValue(grid: Grid, digit: CellValue): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell.value === digit) n++;
  return n;
}

export default function NumberPad({
  grid,
  variant,
  notesMode,
  onDigit,
  onErase,
  onToggleNotes,
}: Props) {
  const { t } = useTranslation("sudoku");
  const { colors } = useTheme();
  const { size } = variantConfig(variant);

  // Build digits 1–size in rows of 3.
  const digits = useMemo<readonly CellValue[]>(
    () => Array.from({ length: size }, (_, i) => (i + 1) as CellValue),
    [size]
  );
  const digitRows = useMemo<readonly (readonly CellValue[])[]>(() => {
    const rows: CellValue[][] = [];
    for (let i = 0; i < digits.length; i += 3) {
      rows.push(digits.slice(i, i + 3) as CellValue[]);
    }
    return rows;
  }, [digits]);

  // Dim digits where all `size` instances are already placed.
  const completed = useMemo<ReadonlySet<CellValue>>(() => {
    const done = new Set<CellValue>();
    for (const d of digits) if (countValue(grid, d) === size) done.add(d);
    return done;
  }, [grid, digits, size]);

  return (
    <View style={styles.pad}>
      <View style={styles.digitGrid}>
        {digitRows.map((row, ri) => (
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
