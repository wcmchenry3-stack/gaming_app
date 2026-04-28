import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import SharedPlayingCard from "../shared/PlayingCard";
import { rankLabel } from "../../game/_shared/decks/cardId";
import type { CanonicalSuit } from "../../game/_shared/decks/types";
import type { Card } from "../../game/freecell/types";
import { DraggableCard } from "../../game/_shared/drag/DraggableCard";
import { DropTarget } from "../../game/_shared/drag/DropTarget";
import type { DropHandler } from "../../game/_shared/drag/DragContext";

export const CARD_WIDTH = 40;
export const CARD_HEIGHT = 57;

export interface FreeCellSlotProps {
  readonly card: Card | null;
  readonly cellIndex: number;
  readonly selected?: boolean;
  readonly hintSource?: boolean;
  readonly onPress?: (cellIndex: number) => void;
  readonly dropId?: string;
  readonly onDrop?: DropHandler;
}

export default function FreeCellSlot({
  card,
  cellIndex,
  selected = false,
  hintSource = false,
  onPress,
  dropId,
  onDrop,
}: FreeCellSlotProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("freecell");

  const handlePress = onPress ? () => onPress(cellIndex) : undefined;
  const hasDrop = dropId !== undefined && onDrop !== undefined;

  if (card !== null) {
    const rl = rankLabel(card.rank);
    const suitName = t(`suit.${card.suit}` as const);
    const label = selected
      ? t("card.selected", { rank: rl, suit: suitName })
      : t("card.label", { rank: rl, suit: suitName });

    const cardEl = (
      <SharedPlayingCard
        suit={card.suit as CanonicalSuit}
        rank={card.rank}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        highlighted={selected}
        hintHighlighted={hintSource}
        accessibilityLabel={label}
      />
    );

    const draggable = (
      <DraggableCard
        onTap={handlePress}
        dragCards={[
          {
            suit: card.suit as CanonicalSuit,
            rank: card.rank,
            faceDown: false,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          },
        ]}
        dragSource={{ game: "freecell", type: "freecell", cell: cellIndex }}
      >
        {cardEl}
      </DraggableCard>
    );

    if (hasDrop) {
      return (
        <DropTarget
          id={dropId!}
          onDrop={onDrop!}
          highlightStyle={{ borderColor: colors.accent, borderWidth: 2, borderRadius: 6 }}
          dimStyle={{ opacity: 0.4 }}
        >
          {draggable}
        </DropTarget>
      );
    }
    return draggable;
  }

  // Empty slot.
  const emptyLabel = t("pile.freecell.empty", { cell: cellIndex + 1 });
  const slotStyle = [
    styles.empty,
    {
      borderColor: selected ? colors.accent : colors.border,
      borderWidth: selected ? 2 : 1,
      backgroundColor: colors.background,
    },
  ];

  const freeLabel = <Text style={[styles.freeLabel, { color: colors.textFilled }]}>free</Text>;

  const emptyEl = handlePress ? (
    <Pressable
      onPress={handlePress}
      style={slotStyle}
      accessibilityRole="button"
      accessibilityLabel={emptyLabel}
    >
      {freeLabel}
    </Pressable>
  ) : (
    <View style={slotStyle} accessibilityRole="image" accessibilityLabel={emptyLabel}>
      {freeLabel}
    </View>
  );

  if (hasDrop) {
    return (
      <DropTarget
        id={dropId!}
        onDrop={onDrop!}
        highlightStyle={{ borderColor: colors.accent, borderWidth: 2, borderRadius: 6 }}
        dimStyle={{ opacity: 0.4 }}
      >
        {emptyEl}
      </DropTarget>
    );
  }
  return emptyEl;
}

const styles = StyleSheet.create({
  empty: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 6,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  freeLabel: {
    fontFamily: typography.label,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
