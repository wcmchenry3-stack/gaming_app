import React from "react";
import { View, Text, StyleSheet } from "react-native";

const TILE_COLORS: Record<number, string> = {
  0: "transparent",
  2: "#eee4da",
  4: "#ede0c8",
  8: "#f2b179",
  16: "#f59563",
  32: "#f67c5f",
  64: "#f65e3b",
  128: "#edcf72",
  256: "#edcc61",
  512: "#edc850",
  1024: "#edc53f",
  2048: "#edc22e",
};

const DARK_TEXT_VALUES = new Set([0, 2, 4]);

function getFontSize(value: number): number {
  if (value < 100) return 28;
  if (value < 1000) return 22;
  if (value < 10000) return 18;
  return 14;
}

interface TileProps {
  value: number;
  size: number;
}

export default function Tile({ value, size }: TileProps) {
  const bg = TILE_COLORS[value] ?? "#3c3a32";
  const textColor = DARK_TEXT_VALUES.has(value) ? "#776e65" : "#f9f6f2";

  return (
    <View
      style={[styles.tile, { width: size, height: size, backgroundColor: bg }]}
      accessibilityLabel={value > 0 ? String(value) : "empty"}
    >
      {value > 0 && (
        <Text style={[styles.text, { color: textColor, fontSize: getFontSize(value) }]}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "800",
  },
});
