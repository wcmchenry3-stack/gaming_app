import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { Bottle, SortState } from "../types";
import BottleView, {
  DEFAULT_BOTTLE_HEIGHT,
  DEFAULT_BOTTLE_WIDTH,
  LIQUID_COLORS,
  TILT_DEG,
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

interface GhostInfo {
  bottle: Bottle;
  bottleIndex: number;
  startX: number;
  startY: number;
}

// Ghost animation timing (ms) — TILT_* values must stay in sync with BottleView
const LIFT_MS = 150;
const TRAVEL_MS = 150;
const TILT_IN_MS = 250;
const TILT_HOLD_MS = 150;
const TILT_OUT_MS = 200;
// TILT_DEG imported from BottleView — single source of truth

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

  // Reduce-motion: fall back to tilt-only (no ghost overlay)
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Position tracking — updated by onLayout, never triggers re-render.
  // React Native fires onLayout top-down (parent before children), so
  // gridOffsetRef is populated before any bottle cell onLayout runs.
  const gridOffsetRef = useRef({ x: 0, y: 0 });
  const bottlePositionsRef = useRef<{ x: number; y: number }[]>([]);

  // Ghost shared values — always allocated (hooks can't be conditional)
  const ghostLiftY = useSharedValue(0);
  const ghostTravelX = useSharedValue(0);
  const ghostTiltDeg = useSharedValue(0);

  const ghostAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: ghostLiftY.value },
      { translateX: ghostTravelX.value },
      { rotate: `${ghostTiltDeg.value}deg` },
    ],
  }));

  // Ghost React state (drives overlay visibility and bottle capture)
  const [ghost, setGhost] = useState<GhostInfo | null>(null);

  // Stable refs for values read inside the effect (avoids stale closure without
  // adding them to the dep array, which would re-trigger on every state change)
  const bottleHRef = useRef(bottleH);
  bottleHRef.current = bottleH;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (pouringFrom === null || pouringTo === null || reduceMotion) {
      cancelAnimation(ghostLiftY);
      cancelAnimation(ghostTravelX);
      cancelAnimation(ghostTiltDeg);
      ghostLiftY.value = 0;
      ghostTravelX.value = 0;
      ghostTiltDeg.value = 0;
      setGhost(null);
      return;
    }

    const srcPos = bottlePositionsRef.current[pouringFrom];
    const dstPos = bottlePositionsRef.current[pouringTo];
    if (!srcPos || !dstPos) return; // layout not measured yet — silent fallback

    const dx = dstPos.x - srcPos.x;
    const liftHeight = bottleHRef.current + 20;
    const tiltAngle = pouringFrom < pouringTo ? TILT_DEG : -TILT_DEG;

    const sourceBottle = stateRef.current.bottles[pouringFrom];
    if (!sourceBottle) return;

    ghostLiftY.value = 0;
    ghostTravelX.value = 0;
    ghostTiltDeg.value = 0;

    setGhost({
      bottle: sourceBottle,
      bottleIndex: pouringFrom,
      startX: srcPos.x,
      startY: srcPos.y,
    });

    // Lift → travel → tilt in → hold → tilt out → return travel → lower (~1200ms total).
    // Ghost clears at ~1200ms; SortScreen commits state at 1250ms — the 50ms gap is
    // imperceptible and ensures the state update lands after the animation completes.
    ghostLiftY.value = withTiming(-liftHeight, { duration: LIFT_MS }, (finished) => {
      if (!finished) return;
      ghostTravelX.value = withTiming(dx, { duration: TRAVEL_MS }, (finished) => {
        if (!finished) return;
        ghostTiltDeg.value = withTiming(tiltAngle, { duration: TILT_IN_MS }, (finished) => {
          if (!finished) return;
          ghostTiltDeg.value = withDelay(
            TILT_HOLD_MS,
            withTiming(0, { duration: TILT_OUT_MS }, (finished) => {
              if (!finished) return;
              ghostTravelX.value = withTiming(0, { duration: TRAVEL_MS }, (finished) => {
                if (!finished) return;
                ghostLiftY.value = withTiming(0, { duration: LIFT_MS }, () => {
                  runOnJS(setGhost)(null);
                });
              });
            })
          );
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pouringFrom, pouringTo, reduceMotion]);

  // Pour tilt direction — used for reduce-motion fallback only
  const pouringDirection: "left" | "right" | undefined =
    pouringFrom !== null && pouringTo !== null
      ? pouringFrom < pouringTo
        ? "right"
        : "left"
      : undefined;

  const handlers = useMemo(
    () => state.bottles.map((_, idx) => () => onBottleTap(idx)),
    // state.bottles identity changes on every pour; keying on .length avoids
    // rebuilding all handlers when only liquid positions change. onBottleTap is
    // included so callers that wrap it in useCallback get stable handles too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.bottles.length, onBottleTap]
  );

  return (
    <View accessibilityLabel={t("a11y.boardRegion")} accessibilityRole="none" style={styles.board}>
      <View
        style={[styles.grid, { gap: BOTTLE_GAP }]}
        onLayout={(e) => {
          gridOffsetRef.current = {
            x: e.nativeEvent.layout.x,
            y: e.nativeEvent.layout.y,
          };
        }}
      >
        {state.bottles.map((bottle, idx) => (
          <View
            key={idx}
            style={[
              styles.bottleCell,
              { width: bottleW },
              idx === pouringFrom && ghost !== null ? styles.bottleHidden : null,
            ]}
            onLayout={(e) => {
              bottlePositionsRef.current[idx] = {
                x: gridOffsetRef.current.x + e.nativeEvent.layout.x,
                y: gridOffsetRef.current.y + e.nativeEvent.layout.y,
              };
            }}
          >
            <BottleView
              bottle={bottle}
              index={idx}
              selected={state.selectedBottleIndex === idx}
              pouring={reduceMotion ? idx === pouringFrom : false}
              pouringDirection={
                reduceMotion && idx === pouringFrom ? pouringDirection : undefined
              }
              colorblindMode={colorblindMode}
              bottleWidth={bottleW}
              bottleHeight={bottleH}
              onTap={handlers[idx]}
            />
          </View>
        ))}
      </View>

      {/* Ghost bottle overlay — floats above grid during pour animation.
          ghost is only set when !reduceMotion, so the extra guard is omitted. */}
      {ghost !== null && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View
            style={[
              styles.ghostBottle,
              {
                left: ghost.startX,
                top: ghost.startY,
                width: bottleW,
                height: bottleH,
              },
              ghostAnimStyle,
            ]}
          >
            <BottleView
              bottle={ghost.bottle}
              index={ghost.bottleIndex}
              isGhost
              colorblindMode={colorblindMode}
              bottleWidth={bottleW}
              bottleHeight={bottleH}
            />
          </Animated.View>
        </View>
      )}

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

  const a0 = useAnimatedStyle(() => ({
    transform: [{ translateY: y0.value }],
    opacity: op0.value,
  }));
  const a1 = useAnimatedStyle(() => ({
    transform: [{ translateY: y1.value }],
    opacity: op1.value,
  }));
  const a2 = useAnimatedStyle(() => ({
    transform: [{ translateY: y2.value }],
    opacity: op2.value,
  }));
  const a3 = useAnimatedStyle(() => ({
    transform: [{ translateY: y3.value }],
    opacity: op3.value,
  }));
  const a4 = useAnimatedStyle(() => ({
    transform: [{ translateY: y4.value }],
    opacity: op4.value,
  }));
  const a5 = useAnimatedStyle(() => ({
    transform: [{ translateY: y5.value }],
    opacity: op5.value,
  }));

  if (!visible || reduceMotion) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[styles.particle, styles.p0, { backgroundColor: PARTICLE_COLORS[0] }, a0]}
      />
      <Animated.View
        style={[styles.particle, styles.p1, { backgroundColor: PARTICLE_COLORS[1] }, a1]}
      />
      <Animated.View
        style={[styles.particle, styles.p2, { backgroundColor: PARTICLE_COLORS[2] }, a2]}
      />
      <Animated.View
        style={[styles.particle, styles.p3, { backgroundColor: PARTICLE_COLORS[3] }, a3]}
      />
      <Animated.View
        style={[styles.particle, styles.p4, { backgroundColor: PARTICLE_COLORS[4] }, a4]}
      />
      <Animated.View
        style={[styles.particle, styles.p5, { backgroundColor: PARTICLE_COLORS[5] }, a5]}
      />
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
  bottleHidden: {
    opacity: 0,
  },
  ghostBottle: {
    position: "absolute",
  },
  particle: { position: "absolute", width: 20, height: 20, borderRadius: 10, top: 0 },
  p0: { left: "8%" },
  p1: { left: "22%" },
  p2: { left: "36%" },
  p3: { left: "52%" },
  p4: { left: "66%" },
  p5: { left: "80%" },
});
