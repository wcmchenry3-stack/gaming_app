import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { Bottle } from "../types";
import { BOTTLE_DEPTH } from "../types";
import BallView, { BALL_SIZE } from "./BallView";

const BOTTLE_PADDING = 6;
const BALL_GAP = 3;
export const BOTTLE_WIDTH = BALL_SIZE + BOTTLE_PADDING * 2;
export const BOTTLE_HEIGHT = BOTTLE_DEPTH * (BALL_SIZE + BALL_GAP) + BOTTLE_PADDING * 2;

function isSolved(bottle: Bottle): boolean {
  return bottle.length === 0 || (bottle.length === BOTTLE_DEPTH && new Set(bottle).size === 1);
}

export interface BottleViewProps {
  readonly bottle: Bottle;
  readonly index: number;
  readonly selected?: boolean;
  readonly colorblindMode?: boolean;
  readonly onTap?: () => void;
}

export default function BottleView({
  bottle,
  index,
  selected = false,
  colorblindMode = false,
  onTap,
}: BottleViewProps) {
  const { t } = useTranslation("sort");
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.06 : 1, { damping: 10, stiffness: 220 });
  }, [selected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const solved = isSolved(bottle);
  let accessibilityLabel: string;
  if (selected) {
    accessibilityLabel = t("a11y.bottleSelected", { index: index + 1 });
  } else if (bottle.length === 0) {
    accessibilityLabel = t("a11y.bottleEmpty", { index: index + 1 });
  } else if (solved) {
    accessibilityLabel = t("a11y.bottleSolved", { index: index + 1 });
  } else {
    accessibilityLabel = t("a11y.bottle", {
      index: index + 1,
      count: bottle.length,
      depth: BOTTLE_DEPTH,
    });
  }

  return (
    <TouchableOpacity
      onPress={onTap}
      disabled={!onTap}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.bottle,
          selected && styles.bottleSelected,
          solved && bottle.length > 0 && styles.bottleSolved,
          animStyle,
        ]}
      >
        {/* Slots rendered bottom→top: column-reverse makes index 0 appear at bottom */}
        <View style={styles.slots}>
          {Array.from({ length: BOTTLE_DEPTH }, (_, slotIdx) => {
            const color = slotIdx < bottle.length ? bottle[slotIdx]! : null;
            return (
              <View key={slotIdx} style={styles.slot}>
                {color !== null ? (
                  <BallView color={color} colorblindMode={colorblindMode} />
                ) : (
                  <View style={styles.emptySlot} />
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bottle: {
    width: BOTTLE_WIDTH,
    height: BOTTLE_HEIGHT,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#4a4a56",
    backgroundColor: "#ffffff0f",
    padding: BOTTLE_PADDING,
    justifyContent: "flex-end",
  },
  bottleSelected: {
    borderColor: "#8ff5ff",
    backgroundColor: "#8ff5ff1f",
  },
  bottleSolved: {
    borderColor: "#22c55e",
    backgroundColor: "#22c55e1a",
  },
  slots: {
    flexDirection: "column-reverse",
    gap: BALL_GAP,
  },
  slot: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptySlot: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: "#ffffff0a",
  },
});
