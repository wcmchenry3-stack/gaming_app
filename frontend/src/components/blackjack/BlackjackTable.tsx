import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import { HandResponse } from "../../game/blackjack/types";
import HandDisplay from "./HandDisplay";

interface Props {
  playerHand: HandResponse;
  dealerHand: HandResponse;
  phase: string;
  /** All player hands when split is active. */
  playerHands?: HandResponse[];
  /** Index of the hand currently being played. */
  activeHandIndex?: number;
  /** Per-hand bets (when split). */
  handBets?: number[];
  /** Per-hand outcomes (when split, in result phase). */
  handOutcomes?: (string | null)[];
}

export default function BlackjackTable({
  playerHand,
  dealerHand,
  phase,
  playerHands,
  activeHandIndex = 0,
  handBets,
  handOutcomes,
}: Props) {
  const { t } = useTranslation("blackjack");
  const { colors } = useTheme();
  const isPlayerPhase = phase === "player";
  const isSplit = playerHands && playerHands.length > 1;

  return (
    <View style={styles.container}>
      <HandDisplay hand={dealerHand} label={t("hand.dealer")} concealed={isPlayerPhase} />
      <View style={styles.divider} />

      {isSplit ? (
        <View style={styles.handsRow}>
          {playerHands.map((hand, i) => {
            const isActive = isPlayerPhase && i === activeHandIndex;
            const bet = handBets?.[i];
            const outcome = handOutcomes?.[i];
            const label = t("hand.playerHand", { number: i + 1 });

            return (
              <View
                key={i}
                style={[
                  styles.splitHand,
                  isActive && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <HandDisplay hand={hand} label={label} />
                {bet != null && (
                  <Text style={[styles.handBet, { color: colors.textMuted }]}>
                    {bet}
                  </Text>
                )}
                {outcome && phase === "result" && (
                  <Text
                    style={[
                      styles.handOutcome,
                      {
                        color:
                          outcome === "win"
                            ? colors.bonus
                            : outcome === "lose"
                              ? colors.error
                              : colors.textMuted,
                      },
                    ]}
                  >
                    {t(`outcome.${outcome}` as Parameters<typeof t>[0])}
                  </Text>
                )}
                {isActive && (
                  <Text style={[styles.activeLabel, { color: colors.accent }]}>
                    {t("hand.activeIndicator")}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <HandDisplay hand={playerHand} label={t("hand.player")} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 20,
    width: "100%",
  },
  divider: {
    width: "60%",
    height: 1,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  handsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  splitHand: {
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  handBet: {
    fontSize: 12,
    fontWeight: "600",
  },
  handOutcome: {
    fontSize: 13,
    fontWeight: "700",
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
