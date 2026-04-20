import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import PlayingCard from "./PlayingCard";
import type { TrickCard } from "../../game/hearts/types";

interface Props {
  trick: TrickCard[];
  playerIndex: number;
  playerLabels?: string[];
  winnerIndex?: number | null;
}

const POSITIONS = ["bottom", "left", "top", "right"] as const;

export default function TrickArea({ trick, playerIndex, playerLabels, winnerIndex }: Props) {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();

  // Map seat index (0-3) to compass position relative to human player
  function positionForSeat(seat: number): (typeof POSITIONS)[number] {
    const offset = (seat - playerIndex + 4) % 4;
    return POSITIONS[offset] ?? "bottom";
  }

  const slots: Record<string, TrickCard | undefined> = {};
  for (const tc of trick) {
    slots[positionForSeat(tc.playerIndex)] = tc;
  }

  function renderSlot(pos: (typeof POSITIONS)[number], seatIndex: number) {
    const tc = slots[pos];
    const label = playerLabels?.[seatIndex] ?? String(seatIndex);
    const isWinner = winnerIndex !== null && winnerIndex !== undefined && winnerIndex === seatIndex;

    return (
      <View
        key={pos}
        style={[styles.slot, styles[pos]]}
        accessibilityLabel={
          tc
            ? isWinner
              ? t("trick.winner", { label })
              : undefined
            : t("trick.slot.empty", { label })
        }
      >
        {tc ? (
          <PlayingCard card={tc.card} highlighted={isWinner} />
        ) : (
          <View
            style={[
              styles.emptySlot,
              { borderColor: colors.border, backgroundColor: "transparent" },
            ]}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.area} accessibilityLabel={t("trick.area")} accessibilityRole="none">
      <Text style={[styles.srOnly, { color: colors.text }]}>{t("trick.area")}</Text>
      {([0, 1, 2, 3] as const).map((offset) => {
        const seat = (playerIndex + offset) % 4;
        const pos = POSITIONS[offset] ?? "bottom";
        return renderSlot(pos, seat);
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    width: 200,
    height: 200,
    position: "relative",
  },
  slot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    bottom: 0,
    left: "50%",
    marginLeft: -30,
  },
  top: {
    top: 0,
    left: "50%",
    marginLeft: -30,
  },
  left: {
    left: 0,
    top: "50%",
    marginTop: -37,
  },
  right: {
    right: 0,
    top: "50%",
    marginTop: -37,
  },
  emptySlot: {
    width: 52,
    height: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
  },
});
