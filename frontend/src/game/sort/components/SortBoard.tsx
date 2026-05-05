import React, { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { SortState } from "../types";
import BottleView, {
  DEFAULT_BOTTLE_HEIGHT,
  DEFAULT_BOTTLE_WIDTH,
  LIQUID_COLORS,
} from "./BottleView";

const BOTTLE_GAP = 12;
const ASPECT_RATIO = DEFAULT_BOTTLE_WIDTH / DEFAULT_BOTTLE_HEIGHT; // ≈ 0.333

export interface SortBoardProps {
  readonly state: SortState;
  readonly colorblindMode?: boolean;
  readonly onBottleTap: (index: number) => void;
  readonly pouringFrom?: number | null;
  readonly pouringTo?: number | null;
  /** Height of the board container in pixels — used to scale bottles to fit. */
  readonly availableHeight?: number;
}

export default function SortBoard({
  state,
  colorblindMode = false,
  onBottleTap,
  pouringFrom = null,
  pouringTo = null,
  availableHeight,
}: SortBoardProps) {
  const { t } = useTranslation("sort");
  const { width: screenW } = useWindowDimensions();

  const numBottles = state.bottles.length;
  // Single row for ≤4 bottles; 3 cols for 5–6; 4 cols for 7+
  const numCols = numBottles <= 4 ? numBottles : numBottles <= 6 ? 3 : 4;
  const numRows = Math.ceil(numBottles / numCols);

  // Scale bottles to fill available height without overflow
  const avH = availableHeight && availableHeight > 0 ? availableHeight : 480;
  const maxBottleH = Math.max(60, (avH - BOTTLE_GAP * (numRows - 1)) / numRows);
  const bottleHFromHeight = Math.min(DEFAULT_BOTTLE_HEIGHT, maxBottleH);

  // Also clamp to horizontal space so bottles never overflow screen width
  const horizPad = 32;
  const maxBottleW = (screenW - horizPad - BOTTLE_GAP * (numCols - 1)) / numCols;
  const bottleW = Math.min(bottleHFromHeight * ASPECT_RATIO, maxBottleW);
  const bottleH = bottleW / ASPECT_RATIO;

  // Pour tilt direction for the source bottle only
  const pouringDirection: "left" | "right" | undefined =
    pouringFrom !== null && pouringTo !== null
      ? pouringFrom < pouringTo
        ? "right"
        : "left"
      : undefined;

  const handlers = useMemo(
    () => state.bottles.map((_, idx) => () => onBottleTap(idx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.bottles.length, onBottleTap]
  );

  return (
    <View accessibilityLabel={t("a11y.boardRegion")} accessibilityRole="none" style={styles.board}>
      <View style={[styles.grid, { gap: BOTTLE_GAP }]}>
        {state.bottles.map((bottle, idx) => (
          <View key={idx} style={[styles.bottleCell, { width: bottleW }]}>
            <BottleView
              bottle={bottle}
              index={idx}
              selected={state.selectedBottleIndex === idx}
              pouring={idx === pouringFrom}
              pouringDirection={idx === pouringFrom ? pouringDirection : undefined}
              colorblindMode={colorblindMode}
              bottleWidth={bottleW}
              bottleHeight={bottleH}
              onTap={handlers[idx]}
            />
          </View>
        ))}
      </View>
      <SortWinOverlay visible={state.isComplete} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Win overlay — liquid-coloured confetti cascades down when the puzzle is solved
// ---------------------------------------------------------------------------

const PARTICLE_COLORS = Object.values(LIQUID_COLORS).slice(0, 6);

interface OverlayProps {
  readonly visible: boolean;
}

function SortWinOverlay({ visible }: OverlayProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const y0 = useSharedValue(-60);
  const y1 = useSharedValue(-60);
  const y2 = useSharedValue(-60);
  const y3 = useSharedValue(-60);
  const y4 = useSharedValue(-60);
  const y5 = useSharedValue(-60);
  const op0 = useSharedValue(0);
  const op1 = useSharedValue(0);
  const op2 = useSharedValue(0);
  const op3 = useSharedValue(0);
  const op4 = useSharedValue(0);
  const op5 = useSharedValue(0);

  useEffect(() => {
    if (!visible || reduceMotion) return;

    const ys = [y0, y1, y2, y3, y4, y5];
    const ops = [op0, op1, op2, op3, op4, op5];

    ys.forEach((y, i) => {
      y.value = -60;
      y.value = withDelay(i * 100, withSpring(500, { damping: 14, stiffness: 55 }));
    });
    ops.forEach((op, i) => {
      op.value = 0;
      op.value = withDelay(
        i * 100,
        withSequence(
          withTiming(1, { duration: 80 }),
          withDelay(600, withTiming(0, { duration: 400 }))
        )
      );
    });

    return () => {
      [y0, y1, y2, y3, y4, y5].forEach((v) => cancelAnimation(v));
      [op0, op1, op2, op3, op4, op5].forEach((v) => cancelAnimation(v));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const a0 = useAnimatedStyle(() => ({ transform: [{ translateY: y0.value }], opacity: op0.value }));
  const a1 = useAnimatedStyle(() => ({ transform: [{ translateY: y1.value }], opacity: op1.value }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.value }], opacity: op2.value }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ translateY: y3.value }], opacity: op3.value }));
  const a4 = useAnimatedStyle(() => ({ transform: [{ translateY: y4.value }], opacity: op4.value }));
  const a5 = useAnimatedStyle(() => ({ transform: [{ translateY: y5.value }], opacity: op5.value }));

  if (!visible || reduceMotion) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.particle, styles.p0, { backgroundColor: PARTICLE_COLORS[0] }, a0]} />
      <Animated.View style={[styles.particle, styles.p1, { backgroundColor: PARTICLE_COLORS[1] }, a1]} />
      <Animated.View style={[styles.particle, styles.p2, { backgroundColor: PARTICLE_COLORS[2] }, a2]} />
      <Animated.View style={[styles.particle, styles.p3, { backgroundColor: PARTICLE_COLORS[3] }, a3]} />
      <Animated.View style={[styles.particle, styles.p4, { backgroundColor: PARTICLE_COLORS[4] }, a4]} />
      <Animated.View style={[styles.particle, styles.p5, { backgroundColor: PARTICLE_COLORS[5] }, a5]} />
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  bottleCell: {
    alignItems: "center",
  },
  particle: { position: "absolute", width: 20, height: 20, borderRadius: 10, top: 0 },
  p0: { left: "8%" },
  p1: { left: "22%" },
  p2: { left: "36%" },
  p3: { left: "52%" },
  p4: { left: "66%" },
  p5: { left: "80%" },
});
