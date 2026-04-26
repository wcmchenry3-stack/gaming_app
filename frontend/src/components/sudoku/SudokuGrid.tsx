import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import type { Grid, Variant } from "../../game/sudoku/types";
import { variantConfig } from "../../game/sudoku/types";
import SudokuCell from "./SudokuCell";

interface Props {
  grid: Grid;
  selectedRow: number | null;
  selectedCol: number | null;
  variant: Variant;
  onCellPress: (row: number, col: number) => void;
}

export default function SudokuGrid({
  grid,
  selectedRow,
  selectedCol,
  variant,
  onCellPress,
}: Props) {
  const { colors } = useTheme();
  const { size, boxRows, boxCols } = variantConfig(variant);

  // Digit of the currently-selected cell (0 = empty / nothing to match).
  const selectedValue =
    selectedRow !== null && selectedCol !== null
      ? (grid[selectedRow]?.[selectedCol]?.value ?? 0)
      : 0;

  const isPeer = (r: number, c: number): boolean => {
    if (selectedRow === null || selectedCol === null) return false;
    if (r === selectedRow && c === selectedCol) return false;
    return (
      r === selectedRow ||
      c === selectedCol ||
      (Math.floor(r / boxRows) === Math.floor(selectedRow / boxRows) &&
        Math.floor(c / boxCols) === Math.floor(selectedCol / boxCols))
    );
  };

  return (
    <View
      accessibilityLabel="Sudoku board"
      style={[styles.grid, { backgroundColor: colors.border }]}
    >
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => {
            // Thick box borders at every internal box boundary.
            const boxRight = (c + 1) % boxCols === 0 && c !== size - 1 ? 2 : 0;
            const boxBottom = (r + 1) % boxRows === 0 && r !== size - 1 ? 2 : 0;
            const hair = StyleSheet.hairlineWidth;
            return (
              <View
                key={`${r}-${c}`}
                style={{
                  flex: 1,
                  marginRight: c === size - 1 ? 0 : boxRight || hair,
                  marginBottom: r === size - 1 ? 0 : boxBottom || hair,
                }}
              >
                <SudokuCell
                  cell={cell}
                  row={r}
                  col={c}
                  size={size}
                  selected={r === selectedRow && c === selectedCol}
                  highlighted={
                    selectedValue !== 0 &&
                    cell.value === selectedValue &&
                    !(r === selectedRow && c === selectedCol)
                  }
                  peer={isPeer(r, c)}
                  onPress={() => onCellPress(r, c)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: "100%",
    aspectRatio: 1,
    flexDirection: "column",
  },
  row: {
    flex: 1,
    flexDirection: "row",
  },
});
