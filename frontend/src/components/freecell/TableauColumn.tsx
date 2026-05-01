import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeContext";
import SharedPlayingCard from "../shared/PlayingCard";
import { rankLabel } from "../../game/_shared/decks/cardId";
import type { CanonicalSuit } from "../../game/_shared/decks/types";
import type { Card } from "../../game/freecell/types";
import { CARD_WIDTH, CARD_HEIGHT } from "./FreeCellSlot";
import { DraggableCard } from "../../game/_shared/drag/DraggableCard";
import { DropTarget } from "../../game/_shared/drag/DropTarget";
import type { DropHandler } from "../../game/_shared/drag/DragContext";

const FACE_UP_OFFSET = 36;
const MIN_FACE_UP_OFFSET = 12;
// Matches the tableau height budget encoded in BOARD_HEIGHT in FreeCellScreen
const TABLEAU_MAX_HEIGHT = 12 * FACE_UP_OFFSET + CARD_HEIGHT;

/** Returns the per-card vertical offset that keeps the whole pile visible.
 *  Compresses below FACE_UP_OFFSET only when the pile would overflow. */
export function computeCardOffset(pileLength: number): number {
  if (pileLength <= 1) return FACE_UP_OFFSET;
  const natural = (TABLEAU_MAX_HEIGHT - CARD_HEIGHT) / (pileLength - 1);
  return Math.max(MIN_FACE_UP_OFFSET, Math.min(FACE_UP_OFFSET, natural));
}

export interface TableauColumnProps {
  readonly pile: readonly Card[];
  readonly colIndex: number;
  readonly selectedIndex?: number;
  readonly hintIndex?: number;
  readonly onCardPress?: (colIndex: number, cardIndex: number) => void;
  readonly onEmptyPress?: (colIndex: number) => void;
  readonly dropId?: string;
  readonly onDrop?: DropHandler;
}

export default function TableauColumn({
  pile,
  colIndex,
  selectedIndex,
  hintIndex,
  onCardPress,
  onEmptyPress,
  dropId,
  onDrop,
}: TableauColumnProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("freecell");

  const highlightStyle: ViewStyle = { borderColor: colors.accent, borderWidth: 2, borderRadius: 6 };
  const dimStyle: ViewStyle = { opacity: 0.4 };
  const hasDrop = dropId !== undefined && onDrop !== undefined;

  if (pile.length === 0) {
    const empty = (
      <Pressable
        onPress={onEmptyPress ? () => onEmptyPress(colIndex) : undefined}
        style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.background }]}
        accessibilityRole="button"
        accessibilityLabel={t("pile.tableau.empty", { col: colIndex + 1 })}
      />
    );
    if (hasDrop) {
      return (
        <DropTarget
          id={dropId!}
          onDrop={onDrop!}
          highlightStyle={highlightStyle}
          dimStyle={dimStyle}
        >
          {empty}
        </DropTarget>
      );
    }
    return empty;
  }

  const cardOffset = computeCardOffset(pile.length);
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < pile.length; i++) {
    offsets.push(acc);
    acc += cardOffset;
  }
  const containerHeight = Math.min(
    TABLEAU_MAX_HEIGHT,
    CARD_HEIGHT + (offsets[pile.length - 1] ?? 0)
  );
  const containerStyle: ViewStyle = { width: CARD_WIDTH, height: containerHeight };

  const cards = pile.map((card, cardIndex) => {
    const isSelected = selectedIndex !== undefined && cardIndex >= selectedIndex;
    const isHint = hintIndex !== undefined && cardIndex >= hintIndex;
    const rl = rankLabel(card.rank);
    const suitName = t(`suit.${card.suit}` as const);
    const label = isSelected
      ? t("card.selected", { rank: rl, suit: suitName })
      : t("card.label", { rank: rl, suit: suitName });
    const handlePress = onCardPress ? () => onCardPress(colIndex, cardIndex) : undefined;

    const dragCards = pile.slice(cardIndex).map((c) => ({
      suit: c.suit as CanonicalSuit,
      rank: c.rank,
      faceDown: false,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    }));

    return (
      <DraggableCard
        key={cardIndex}
        style={[styles.cardSlot, { top: offsets[cardIndex] ?? 0 }]}
        onTap={handlePress}
        dragCards={dragCards}
        dragSource={{ game: "freecell", type: "tableau", col: colIndex, fromIndex: cardIndex }}
      >
        <SharedPlayingCard
          suit={card.suit as CanonicalSuit}
          rank={card.rank}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          highlighted={isSelected}
          hintHighlighted={isHint}
          accessibilityLabel={label}
        />
      </DraggableCard>
    );
  });

  if (hasDrop) {
    return (
      <DropTarget
        id={dropId!}
        onDrop={onDrop!}
        style={containerStyle}
        highlightStyle={highlightStyle}
        dimStyle={dimStyle}
      >
        <View
          style={StyleSheet.absoluteFill}
          accessibilityLabel={t("pile.tableau.label", { col: colIndex + 1, count: pile.length })}
        >
          {cards}
        </View>
      </DropTarget>
    );
  }

  return (
    <View
      style={containerStyle}
      accessibilityLabel={t("pile.tableau.label", { col: colIndex + 1, count: pile.length })}
    >
      {cards}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  cardSlot: {
    position: "absolute",
    left: 0,
  },
});
