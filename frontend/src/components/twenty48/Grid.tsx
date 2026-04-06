import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { TileData } from "../../game/twenty48/types";
import AnimatedTile from "./AnimatedTile";

const GRID_SIZE = 4;
const GAP = 8;
const MAX_BOARD = 360;

interface GridProps {
  tiles: TileData[];
}

export default function Grid({ tiles }: GridProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const boardWidth = Math.min(width - 32, MAX_BOARD);
  const tileSize = (boardWidth - GAP * (GRID_SIZE + 1)) / GRID_SIZE;

  // Render empty slot backgrounds so the grid looks filled even with no tiles.
  const occupiedCells = new Set(tiles.map(t => `${t.row}-${t.col}`));
  const slots = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const top = GAP + r * (tileSize + GAP);
      const left = GAP + c * (tileSize + GAP);
      const isEmpty = !occupiedCells.has(`${r}-${c}`);
      slots.push(
        <View
          key={`slot-${r}-${c}`}
          style={[
            styles.slot,
            { width: tileSize, height: tileSize, top, left, backgroundColor: colors.border },
          ]}
          accessibilityRole={isEmpty ? "image" : undefined}
          accessibilityLabel={isEmpty ? "empty" : undefined}
        />
      );
    }
  }

  return (
    <View
      style={[
        styles.grid,
        { width: boardWidth, height: boardWidth, backgroundColor: colors.border },
      ]}
      accessible={true}
      accessibilityLabel="Game board"
    >
      {slots}
      {tiles.map((tile) => (
        <AnimatedTile key={tile.id} tile={tile} tileSize={tileSize} gap={GAP} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    borderRadius: 10,
    position: "relative",
  },
  slot: {
    position: "absolute",
    borderRadius: 6,
  },
});
