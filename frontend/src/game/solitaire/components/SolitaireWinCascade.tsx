import React, { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface Props {
  readonly visible: boolean;
}

export function SolitaireWinCascade({ visible }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const y0 = useSharedValue(-80);
  const y1 = useSharedValue(-80);
  const y2 = useSharedValue(-80);
  const y3 = useSharedValue(-80);
  const y4 = useSharedValue(-80);
  const y5 = useSharedValue(-80);
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
      y.value = -80;
      y.value = withDelay(i * 110, withSpring(520, { damping: 14, stiffness: 55 }));
    });
    ops.forEach((op, i) => {
      op.value = 0;
      op.value = withDelay(
        i * 110,
        withSequence(
          withTiming(1, { duration: 80 }),
          withDelay(700, withTiming(0, { duration: 500 }))
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
      <Animated.View style={[styles.card, styles.c0, { backgroundColor: "#e74c3c" }, a0]} />
      <Animated.View style={[styles.card, styles.c1, { backgroundColor: "#3498db" }, a1]} />
      <Animated.View style={[styles.card, styles.c2, { backgroundColor: "#2ecc71" }, a2]} />
      <Animated.View style={[styles.card, styles.c3, { backgroundColor: "#f1c40f" }, a3]} />
      <Animated.View style={[styles.card, styles.c4, { backgroundColor: "#9b59b6" }, a4]} />
      <Animated.View style={[styles.card, styles.c5, { backgroundColor: "#e91e63" }, a5]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", width: 22, height: 32, borderRadius: 3, top: 0 },
  c0: { left: "8%" },
  c1: { left: "22%" },
  c2: { left: "36%" },
  c3: { left: "52%" },
  c4: { left: "66%" },
  c5: { left: "80%" },
});
