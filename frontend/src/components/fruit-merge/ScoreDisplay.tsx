import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  score: number;
}

export default function ScoreDisplay({ score }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const prevScore = useRef(score);

  useEffect(() => {
    if (score !== prevScore.current) {
      prevScore.current = score;
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 80, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [score, scale]);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.label, { color: colors.textMuted }]}>Score</Text>
      <Animated.Text style={[styles.score, { color: colors.accent, transform: [{ scale }] }]}>
        {score.toLocaleString()}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 120,
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  score: {
    fontSize: 28,
    fontWeight: "800",
  },
});
