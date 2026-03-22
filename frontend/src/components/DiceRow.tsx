import React, { useState, useEffect } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import Die from "./Die";
import { useTheme } from "../theme/ThemeContext";

interface DiceRowProps {
  dice: number[];
  rollsUsed: number;
  gameOver: boolean;
  onRoll: (held: boolean[]) => Promise<void>;
  resetHeld: boolean;
}

export default function DiceRow({ dice, rollsUsed, gameOver, onRoll, resetHeld }: DiceRowProps) {
  const { colors } = useTheme();
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    setHeld([false, false, false, false, false]);
  }, [resetHeld]);

  function toggleHeld(index: number) {
    if (rollsUsed === 0) return;
    setHeld((prev) => prev.map((h, i) => (i === index ? !h : h)));
  }

  async function handleRoll() {
    setRolling(true);
    try {
      await onRoll(held);
    } finally {
      setRolling(false);
    }
  }

  const canRoll = rollsUsed < 3 && !gameOver;
  const rollsLeft = 3 - rollsUsed;

  return (
    <View style={styles.container}>
      <View style={styles.diceRow}>
        {dice.map((val, i) => (
          <Die
            key={i}
            value={val}
            held={held[i]}
            onPress={() => toggleHeld(i)}
            disabled={rollsUsed === 0 || gameOver}
          />
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {rollsUsed > 0 ? "Tap dice to hold" : "Press Roll to start your turn"}
      </Text>
      <Pressable
        style={[
          styles.rollButton,
          { backgroundColor: canRoll ? colors.accent : colors.textFilled },
        ]}
        onPress={handleRoll}
        disabled={!canRoll || rolling}
      >
        <Text style={styles.rollButtonText}>
          {rolling ? "Rolling..." : `Roll (${rollsLeft} left)`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
  diceRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  hint: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  rollButton: {
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rollButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
