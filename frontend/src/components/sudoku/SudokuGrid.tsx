import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import type { Grid } from "../../game/sudoku/types";
import SudokuCell from "./SudokuCell";

interface Props {
  grid: Grid;
  selectedRow: number | null;
  selectedCol: number | null;
  onCellPress: (row: number, col: number) => void;
}

export default function SudokuGrid({ grid, selectedRow, selectedCol, onCellPress }: Props) {
  const { colors } = useTheme();

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
      (Math.floor(r / 3) === Math.floor(selectedRow / 3) &&
        Math.floor(c / 3) === Math.floor(selectedCol / 3))
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
            // Thick box borders: every 3rd internal boundary (cols 3, 6;
            // rows 3, 6) gets the full-weight `colors.border`. Outer edges
            // are handled by the container background showing through.
            const boxRight = c % 3 === 2 && c !== 8 ? 2 : 0;
            const boxBottom = r % 3 === 2 && r !== 8 ? 2 : 0;
            const hair = StyleSheet.hairlineWidth;
            return (
              <View
                key={`${r}-${c}`}
                style={{
                  flex: 1,
                  marginRight: c === 8 ? 0 : boxRight || hair,
                  marginBottom: r === 8 ? 0 : boxBottom || hair,
                }}
              >
                <SudokuCell
                  cell={cell}
                  row={r}
                  col={c}
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
