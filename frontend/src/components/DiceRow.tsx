import React, { useState, useEffect } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import Die from "./Die";
import { useTheme } from "../theme/ThemeContext";

// Below this viewport height, the dice row collapses its vertical padding,
// hides the redundant rolls-left dot indicator (the ROLL button already
// shows "ROLL (N LEFT)"), and tightens its roll button so the Yacht
// scorecard gets more usable space. Catches Galaxy Fold landscape (~604dp),
// Galaxy Fold portrait (~725dp), and smaller phones.
const COMPACT_HEIGHT_BREAKPOINT = 780;

interface DiceRowProps {
  dice: number[];
  rollsUsed: number;
  gameOver: boolean;
  onRoll: (held: boolean[]) => void | Promise<void>;
  resetHeld: boolean;
}

export default function DiceRow({ dice, rollsUsed, gameOver, onRoll, resetHeld }: DiceRowProps) {
  const { t } = useTranslation("yacht");
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const isCompact = height < COMPACT_HEIGHT_BREAKPOINT;
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

  // Web gradient for roll button; native falls back to flat accentBright
  const rollButtonBg: ViewStyle =
    canRoll && Platform.OS === "web"
      ? ({
          backgroundImage: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBright})`,
          boxShadow: `0 0 24px ${colors.accent}55`,
        } as ViewStyle)
      : { backgroundColor: canRoll ? colors.accentBright : colors.surfaceHigh };

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      <View style={styles.diceRow}>
        {dice.map((val, i) => (
          <Die
            key={i}
            index={i}
            value={val}
            held={held[i]}
            onPress={() => toggleHeld(i)}
            disabled={rollsUsed === 0 || gameOver}
          />
        ))}
      </View>
      <Text
        style={[styles.hint, isCompact && styles.hintCompact, { color: colors.textMuted }]}
        accessibilityLiveRegion="polite"
      >
        {rollsUsed > 0 ? t("dice.hintAfterRoll") : t("dice.hintBeforeRoll")}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.rollButton,
          isCompact && styles.rollButtonCompact,
          rollButtonBg,
          pressed && canRoll && !rolling ? { transform: [{ scale: 0.95 }] } : null,
        ]}
        onPress={handleRoll}
        disabled={!canRoll || rolling}
        accessibilityRole="button"
        accessibilityLabel={
          rolling
            ? t("roll.rollingLabel")
            : t(`roll.label_${rollsLeft === 1 ? "one" : "other"}`, { count: rollsLeft })
        }
        accessibilityState={{ disabled: !canRoll || rolling, busy: rolling }}
      >
        <Text
          style={[
            styles.rollButtonText,
            { color: canRoll ? colors.textOnAccent : colors.textMuted },
          ]}
        >
          {rolling ? t("roll.rolling") : t("roll.button", { count: rollsLeft })}
        </Text>
      </Pressable>
      {/* Rolls-left dots are redundant with the button label ("ROLL (N LEFT)")
          — hide them on short viewports to reclaim vertical space. */}
      {!isCompact && (
        <View style={styles.rollCounter} accessibilityElementsHidden importantForAccessibility="no">
          {[0, 1, 2].map((i) => {
            const filled = i < rollsLeft;
            return (
              <View
                key={i}
                style={[
                  styles.rollDot,
                  {
                    backgroundColor: filled ? colors.accent : colors.surfaceHigh,
                    ...(filled && Platform.OS === "web"
                      ? { boxShadow: `0 0 6px ${colors.accent}` }
                      : null),
                  } as ViewStyle,
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
  containerCompact: {
    marginVertical: 4,
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
  hintCompact: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  rollButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 999,
  },
  rollButtonCompact: {
    paddingHorizontal: 28,
    paddingVertical: 9,
  },
  rollButtonText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  rollCounter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  rollDot: {
    width: 10,
    height: 4,
    borderRadius: 2,
  },
});
