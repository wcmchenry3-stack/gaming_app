import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";

interface ScoreBoardProps {
  score: number;
  bestScore: number;
  scoreDelta: number;
}

export default function ScoreBoard({ score, bestScore, scoreDelta }: ScoreBoardProps) {
  const { t } = useTranslation(["twenty48"]);
  const { colors } = useTheme();

  // Score delta float animation.
  const deltaOpacity = useRef(new Animated.Value(0)).current;
  const deltaTranslateY = useRef(new Animated.Value(0)).current;
  const lastDelta = useRef(0);

  useEffect(() => {
    if (scoreDelta <= 0) return;
    lastDelta.current = scoreDelta;
    // Reset to starting position below the score, then float upward.
    deltaOpacity.setValue(1);
    deltaTranslateY.setValue(0);
    Animated.parallel([
      Animated.timing(deltaOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(deltaTranslateY, {
        toValue: -24,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scoreDelta, score]);

  return (
    <View style={styles.row}>
      {/* Current score */}
      <View style={[styles.box, { backgroundColor: colors.surface }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t("twenty48:score.label")}</Text>
        <View style={styles.valueWrap}>
          <Text
            style={[styles.value, { color: colors.text }]}
            accessibilityLabel={t("twenty48:score.accessibilityLabel", { score })}
          >
            {score}
          </Text>
          {scoreDelta > 0 && (
            <Animated.Text
              style={[
                styles.delta,
                {
                  color: colors.accent,
                  opacity: deltaOpacity,
                  transform: [{ translateY: deltaTranslateY }],
                },
              ]}
              aria-hidden
            >
              +{lastDelta.current}
            </Animated.Text>
          )}
        </View>
      </View>

      {/* Best score */}
      <View style={[styles.box, { backgroundColor: colors.surface }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t("twenty48:score.best")}</Text>
        <Text
          style={[styles.value, { color: colors.text }]}
          accessibilityLabel={t("twenty48:score.bestAccessibilityLabel", { score: bestScore })}
        >
          {bestScore}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  box: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 80,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
  },
  valueWrap: {
    alignItems: "center",
  },
  delta: {
    position: "absolute",
    fontSize: 13,
    fontWeight: "700",
    top: -14,
  },
});
