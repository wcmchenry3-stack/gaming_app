/**
 * TableauPile (#595) — one column of a 7-column Klondike tableau.
 *
 * Stateless. Vertically offsets cards so all are visible; empty columns
 * render a dashed placeholder. Bubbles taps up as `(colIndex, cardIndex)`
 * so the parent screen can run its tap-to-select state machine.
 */

import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../../theme/ThemeContext";
import type { Card } from "../types";
import type { CanonicalSuit } from "../../_shared/decks/types";
import CardView, { CARD_HEIGHT, CARD_WIDTH } from "./CardView";
import { DraggableCard } from "../../_shared/drag/DraggableCard";
import { DropTarget } from "../../_shared/drag/DropTarget";
import type { DropHandler } from "../../_shared/drag/DragContext";

const FACE_UP_OFFSET = 24;
const FACE_DOWN_OFFSET = 14;

export interface TableauPileProps {
  readonly pile: readonly Card[];
  readonly colIndex: number;
  readonly selectedIndex?: number;
  readonly onCardPress?: (colIndex: number, cardIndex: number) => void;
  readonly onEmptyPress?: (colIndex: number) => void;
  /** Unique drop-zone ID, e.g. "solitaire-tableau-0". Required for DnD. */
  readonly dropId?: string;
  readonly onDrop?: DropHandler;
}

export default function TableauPile({
  pile,
  colIndex,
  selectedIndex,
  onCardPress,
  onEmptyPress,
  dropId,
  onDrop,
}: TableauPileProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("solitaire");

  const highlightStyle: ViewStyle = {
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: 8,
  };
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

  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < pile.length; i++) {
    offsets.push(acc);
    const card = pile[i];
    if (card === undefined) break;
    acc += card.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
  }
  const containerHeight = CARD_HEIGHT + (offsets[pile.length - 1] ?? 0);
  const containerStyle: ViewStyle = { width: CARD_WIDTH, height: containerHeight };

  const cards = pile.map((card, cardIndex) => {
    const isSelected = selectedIndex !== undefined && cardIndex >= selectedIndex;
    const handlePress = onCardPress ? () => onCardPress(colIndex, cardIndex) : undefined;
    const dragCards = pile.slice(cardIndex).map((c) => ({
      suit: c.suit as CanonicalSuit,
      rank: c.rank,
      faceDown: !c.faceUp,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    }));
    return (
      <DraggableCard
        key={cardIndex}
        style={[styles.cardSlot, { top: offsets[cardIndex] ?? 0 }]}
        onTap={handlePress}
        dragCards={dragCards}
        dragSource={{ game: "solitaire", type: "tableau", col: colIndex, fromIndex: cardIndex }}
        draggable={card.faceUp}
      >
        <CardView card={card} selected={isSelected} />
      </DraggableCard>
    );
  });

  const pileView = (
    <View
      style={containerStyle}
      accessibilityLabel={t("pile.tableau.label", { col: colIndex + 1, count: pile.length })}
    >
      {cards}
    </View>
  );

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

  return pileView;
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
