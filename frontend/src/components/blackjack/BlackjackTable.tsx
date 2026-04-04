import React from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { HandResponse } from "../../game/blackjack/api";
import HandDisplay from "./HandDisplay";

interface Props {
  playerHand: HandResponse;
  dealerHand: HandResponse;
  phase: string;
}

export default function BlackjackTable({ playerHand, dealerHand, phase }: Props) {
  const { t } = useTranslation("blackjack");
  const isPlayerPhase = phase === "player";

  return (
    <View style={styles.container}>
      <HandDisplay hand={dealerHand} label={t("hand.dealer")} concealed={isPlayerPhase} />
      <View style={styles.divider} />
      <HandDisplay hand={playerHand} label={t("hand.player")} />
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
});
