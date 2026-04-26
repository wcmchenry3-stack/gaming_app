import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeContext";
import SharedPlayingCard from "../shared/PlayingCard";
import { rankLabel } from "../../game/_shared/decks/cardId";
import type { CanonicalSuit } from "../../game/_shared/decks/types";
import type { Card } from "../../game/freecell/types";
import { CARD_WIDTH, CARD_HEIGHT } from "./FreeCellSlot";

const FACE_UP_OFFSET = 24;

export interface TableauColumnProps {
  readonly pile: readonly Card[];
  readonly colIndex: number;
  readonly selectedIndex?: number;
  readonly onCardPress?: (colIndex: number, cardIndex: number) => void;
  readonly onEmptyPress?: (colIndex: number) => void;
}

export default function TableauColumn({
  pile,
  colIndex,
  selectedIndex,
  onCardPress,
  onEmptyPress,
}: TableauColumnProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("freecell");

  if (pile.length === 0) {
    return (
      <Pressable
        onPress={onEmptyPress ? () => onEmptyPress(colIndex) : undefined}
        style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.background }]}
        accessibilityRole="button"
        accessibilityLabel={t("pile.tableau.empty", { col: colIndex + 1 })}
      />
    );
  }

  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < pile.length; i++) {
    offsets.push(acc);
    acc += FACE_UP_OFFSET;
  }
  const containerHeight = CARD_HEIGHT + (offsets[pile.length - 1] ?? 0);

  const containerStyle: ViewStyle = {
    width: CARD_WIDTH,
    height: containerHeight,
  };

  return (
    <View
      style={containerStyle}
      accessibilityLabel={t("pile.tableau.label", { col: colIndex + 1, count: pile.length })}
    >
      {pile.map((card, cardIndex) => {
        const isSelected = selectedIndex !== undefined && cardIndex >= selectedIndex;
        const rl = rankLabel(card.rank);
        const suitName = t(`suit.${card.suit}` as const);
        const label = isSelected
          ? t("card.selected", { rank: rl, suit: suitName })
          : t("card.label", { rank: rl, suit: suitName });
        const handlePress = onCardPress ? () => onCardPress(colIndex, cardIndex) : undefined;
        return (
          <View key={cardIndex} style={[styles.cardSlot, { top: offsets[cardIndex] ?? 0 }]}>
            <SharedPlayingCard
              suit={card.suit as CanonicalSuit}
              rank={card.rank}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              highlighted={isSelected}
              onPress={handlePress}
              accessibilityLabel={label}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  cardSlot: {
    position: "absolute",
    left: 0,
  },
});
