/**
 * AnimatedTile — renders a single 2048 tile with three animations:
 *
 *  • Slide   — translates from prevRow/prevCol to row/col (100 ms, ease-out)
 *  • Pop     — scale pulse 1 → 1.15 → 1 when isMerge (150 ms)
 *  • Spawn   — scale from 0 → 1.1 → 1 when isNew (180 ms, 60 ms delay)
 *
 * Absolute positioning relative to the parent Grid container so React can
 * animate by tile identity rather than by grid slot.
 */

import React, { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { TileData } from "../../game/twenty48/types";

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

function tilePos(index: number, tileSize: number, gap: number): number {
  return gap + index * (tileSize + gap);
}

interface AnimatedTileProps {
  tile: TileData;
  tileSize: number;
  gap: number;
}

export default function AnimatedTile({ tile, tileSize, gap }: AnimatedTileProps) {
  const { id, value, row, col, prevRow, prevCol, isNew, isMerge } = tile;

  const bg = TILE_COLORS[value] ?? "#3c3a32";
  const textColor = DARK_TEXT_VALUES.has(value) ? "#776e65" : "#f9f6f2";

  const targetTop = tilePos(row, tileSize, gap);
  const targetLeft = tilePos(col, tileSize, gap);

  const startTop = prevRow !== null ? tilePos(prevRow, tileSize, gap) : targetTop;
  const startLeft = prevCol !== null ? tilePos(prevCol, tileSize, gap) : targetLeft;

  const top = useSharedValue(startTop);
  const left = useSharedValue(startLeft);
  const scale = useSharedValue(isNew ? 0 : 1);

  useEffect(() => {
    // Slide animation — only if tile moved.
    if (startTop !== targetTop || startLeft !== targetLeft) {
      top.value = withTiming(targetTop, { duration: 100, easing: Easing.out(Easing.quad) });
      left.value = withTiming(targetLeft, { duration: 100, easing: Easing.out(Easing.quad) });
    }

    // Merge pop — brief scale pulse after slide completes.
    if (isMerge) {
      scale.value = withDelay(
        90,
        withSequence(
          withTiming(1.15, { duration: 75, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 75, easing: Easing.in(Easing.quad) })
        )
      );
    }

    // Spawn scale-in — delayed slightly so it appears after slide settles.
    if (isNew) {
      scale.value = withDelay(
        60,
        withSequence(
          withTiming(1.1, { duration: 100, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 80, easing: Easing.in(Easing.quad) })
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, row, col, isNew, isMerge]); // shared values (top/left/scale) are stable refs

  const animStyle = useAnimatedStyle(() => ({
    top: top.value,
    left: left.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.tile, { width: tileSize, height: tileSize, backgroundColor: bg }, animStyle]}
      accessibilityLabel={value > 0 ? String(value) : "empty"}
      accessibilityRole="image"
    >
      {value > 0 && (
        <Text style={[styles.text, { color: textColor, fontSize: getFontSize(value) }]}>
          {value}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "800",
  },
});
