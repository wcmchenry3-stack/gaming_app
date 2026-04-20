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
import CardView, { CARD_HEIGHT, CARD_WIDTH } from "./CardView";

/** Vertical offset between stacked cards. Face-up cards overlap more
 * tightly than face-down ones so the rank/suit of each face-up card stays
 * readable even in long columns. */
const FACE_UP_OFFSET = 24;
const FACE_DOWN_OFFSET = 14;

export interface TableauPileProps {
  readonly pile: readonly Card[];
  readonly colIndex: number;
  /** Index of the card that is currently tap-selected in this column, if
   * any. When the selected card is not at the top of the pile, the entire
   * sub-run from that index to the end is highlighted — that matches
   * Klondike's tap-to-select-run semantics. */
  readonly selectedIndex?: number;
  readonly onCardPress?: (colIndex: number, cardIndex: number) => void;
  readonly onEmptyPress?: (colIndex: number) => void;
}

export default function TableauPile({
  pile,
  colIndex,
  selectedIndex,
  onCardPress,
  onEmptyPress,
}: TableauPileProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("solitaire");

  if (pile.length === 0) {
    return (
      <Pressable
        onPress={onEmptyPress ? () => onEmptyPress(colIndex) : undefined}
        style={[
          styles.empty,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("pile.tableau.empty", { col: colIndex + 1 })}
      />
    );
  }

  // Compute cumulative vertical offset so the container height matches the
  // visible extent of the pile — needed because child absolute positioning
  // doesn't contribute to layout on web.
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < pile.length; i++) {
    offsets.push(acc);
    const card = pile[i];
    if (card === undefined) break;
    acc += card.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
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
        const handlePress = onCardPress ? () => onCardPress(colIndex, cardIndex) : undefined;
        return (
          <View key={cardIndex} style={[styles.cardSlot, { top: offsets[cardIndex] ?? 0 }]}>
            <CardView card={card} selected={isSelected} onPress={handlePress} />
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
