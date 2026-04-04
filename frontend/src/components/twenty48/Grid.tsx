import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import Tile from "./Tile";

const GRID_SIZE = 4;
const GAP = 8;
const MAX_BOARD = 360;

interface GridProps {
  board: number[][];
}

export default function Grid({ board }: GridProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const boardWidth = Math.min(width - 32, MAX_BOARD);
  const tileSize = (boardWidth - GAP * (GRID_SIZE + 1)) / GRID_SIZE;

  return (
    <View
      style={[
        styles.grid,
        {
          width: boardWidth,
          height: boardWidth,
          backgroundColor: colors.border,
          padding: GAP,
          gap: GAP,
        },
      ]}
      accessible={true}
      accessibilityLabel="Game board"
    >
      {board.map((row, r) => (
        <View key={r} style={[styles.row, { gap: GAP }]}>
          {row.map((cell, c) => (
            <Tile key={`${r}-${c}`} value={cell} size={tileSize} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    borderRadius: 10,
  },
  row: {
    flexDirection: "row",
  },
});
