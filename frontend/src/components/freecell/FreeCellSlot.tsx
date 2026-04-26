import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeContext";
import SharedPlayingCard from "../shared/PlayingCard";
import { rankLabel } from "../../game/_shared/decks/cardId";
import type { CanonicalSuit } from "../../game/_shared/decks/types";
import type { Card } from "../../game/freecell/types";

export const CARD_WIDTH = 40;
export const CARD_HEIGHT = 57;

export interface FreeCellSlotProps {
  readonly card: Card | null;
  readonly cellIndex: number;
  readonly selected?: boolean;
  readonly onPress?: (cellIndex: number) => void;
}

export default function FreeCellSlot({
  card,
  cellIndex,
  selected = false,
  onPress,
}: FreeCellSlotProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("freecell");

  const handlePress = onPress ? () => onPress(cellIndex) : undefined;

  if (card !== null) {
    const rl = rankLabel(card.rank);
    const suitName = t(`suit.${card.suit}` as const);
    const label = selected
      ? t("card.selected", { rank: rl, suit: suitName })
      : t("card.label", { rank: rl, suit: suitName });

    return (
      <SharedPlayingCard
        suit={card.suit as CanonicalSuit}
        rank={card.rank}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        highlighted={selected}
        onPress={handlePress}
        accessibilityLabel={label}
      />
    );
  }

  const emptyLabel = t("pile.freecell.empty", { cell: cellIndex + 1 });
  const slotStyle = [
    styles.empty,
    {
      borderColor: selected ? colors.accent : colors.border,
      borderWidth: selected ? 2 : 1,
      backgroundColor: colors.background,
    },
  ];

  if (handlePress) {
    return (
      <Pressable
        onPress={handlePress}
        style={slotStyle}
        accessibilityRole="button"
        accessibilityLabel={emptyLabel}
      />
    );
  }

  return <View style={slotStyle} accessibilityRole="image" accessibilityLabel={emptyLabel} />;
}

const styles = StyleSheet.create({
  empty: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    borderStyle: "dashed",
  },
});
