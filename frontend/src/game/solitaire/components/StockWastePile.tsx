/**
 * StockWastePile (#595) — the stock and waste piles rendered side by side.
 *
 * Stateless. Two callbacks: `onStockPress` drives draw/recycle (the parent
 * screen decides which), and `onWastePress` selects the top of the waste.
 * The stock is always face-down; when empty it shows a recycle symbol so
 * the player knows they can recycle. Waste shows only its top card
 * face-up (matches tap-target semantics — the player can only play the
 * top waste card).
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { useTheme } from "../../../theme/ThemeContext";
import type { Card, DrawMode } from "../types";
import type { CanonicalSuit } from "../../_shared/decks/types";
import CardView, { CARD_HEIGHT, CARD_WIDTH } from "./CardView";
import { useCardSize } from "../../_shared/CardSizeContext";
import { DraggableCard } from "../../_shared/drag/DraggableCard";

export interface StockWastePileProps {
  readonly stock: readonly Card[];
  readonly waste: readonly Card[];
  readonly drawMode: DrawMode;
  readonly wasteSelected?: boolean;
  readonly onStockPress?: () => void;
  readonly onWastePress?: () => void;
}

export default function StockWastePile({
  stock,
  waste,
  drawMode,
  wasteSelected = false,
  onStockPress,
  onWastePress,
}: StockWastePileProps) {
  const { colors } = useTheme();
  const { t } = useTranslation("solitaire");
  const cardSize = useCardSize();

  return (
    <View style={styles.row}>
      <Stock
        count={stock.length}
        colors={colors}
        onPress={onStockPress}
        drawMode={drawMode}
        cardSize={cardSize}
        t={t}
      />
      <Waste
        waste={waste}
        drawMode={drawMode}
        selected={wasteSelected}
        onPress={onWastePress}
        cardSize={cardSize}
        t={t}
      />
    </View>
  );
}

function Stock({
  count,
  colors,
  onPress,
  drawMode,
  cardSize,
  t,
}: {
  readonly count: number;
  readonly colors: ReturnType<typeof useTheme>["colors"];
  readonly onPress?: () => void;
  readonly drawMode: DrawMode;
  readonly cardSize: ReturnType<typeof useCardSize>;
  readonly t: TFunction<"solitaire">;
}) {
  const cardWidth = cardSize.cardWidth || CARD_WIDTH;
  const cardHeight = cardSize.cardHeight || CARD_HEIGHT;
  const isEmpty = count === 0;
  const label = isEmpty
    ? t("pile.stock.empty", { count: drawMode })
    : t("pile.stock.label", { count: drawMode, remaining: count });

  const style = [
    styles.slot,
    {
      width: cardWidth,
      height: cardHeight,
      backgroundColor: isEmpty ? colors.background : colors.surfaceAlt,
      borderColor: colors.border,
      borderWidth: 1,
      borderStyle: isEmpty ? ("dashed" as const) : ("solid" as const),
    },
  ];

  const content = isEmpty ? (
    <Text style={[styles.recycleSymbol, { color: colors.textMuted }]}>↻</Text>
  ) : (
    <Text style={[styles.countText, { color: colors.textMuted }]}>{count}</Text>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={style} accessibilityRole="image" accessibilityLabel={label}>
      {content}
    </View>
  );
}

const WASTE_FAN_OFFSET = 16;

function Waste({
  waste,
  drawMode,
  selected,
  onPress,
  cardSize,
  t,
}: {
  readonly waste: readonly Card[];
  readonly drawMode: DrawMode;
  readonly selected: boolean;
  readonly onPress?: () => void;
  readonly cardSize: ReturnType<typeof useCardSize>;
  readonly t: TFunction<"solitaire">;
}) {
  const cardWidth = cardSize.cardWidth || CARD_WIDTH;
  const cardHeight = cardSize.cardHeight || CARD_HEIGHT;

  if (waste.length === 0) {
    return (
      <View
        style={[styles.wasteEmpty, { width: cardWidth, height: cardHeight }]}
        accessibilityRole="image"
        accessibilityLabel={t("pile.waste.empty")}
      />
    );
  }

  const top = waste[waste.length - 1]!;
  const topDragCards = [
    {
      suit: top.suit as CanonicalSuit,
      rank: top.rank,
      faceDown: false,
      width: cardWidth,
      height: cardHeight,
    },
  ];

  if (drawMode !== 3) {
    return (
      <DraggableCard
        onTap={onPress}
        dragCards={topDragCards}
        dragSource={{ game: "solitaire", type: "waste" }}
      >
        <CardView card={top} selected={selected} />
      </DraggableCard>
    );
  }

  const visibleCount = Math.min(3, waste.length);
  const visible = waste.slice(waste.length - visibleCount);
  const containerWidth = (visibleCount - 1) * WASTE_FAN_OFFSET + cardWidth;

  return (
    <View style={[styles.wasteFanContainer, { width: containerWidth, height: cardHeight }]}>
      {visible.map((card, i) => {
        const isTop = i === visible.length - 1;
        if (isTop) {
          return (
            <View
              key={`${card.suit}-${card.rank}`}
              style={[styles.wasteFanCard, { left: i * WASTE_FAN_OFFSET }]}
            >
              <DraggableCard
                onTap={onPress}
                dragCards={topDragCards}
                dragSource={{ game: "solitaire", type: "waste" }}
              >
                <CardView card={card} selected={selected} />
              </DraggableCard>
            </View>
          );
        }
        return (
          <View
            key={`${card.suit}-${card.rank}`}
            style={[styles.wasteFanCard, { left: i * WASTE_FAN_OFFSET }]}
          >
            <CardView card={card} selected={false} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
  slot: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  wasteEmpty: {},
  wasteFanContainer: {
    position: "relative",
  },
  wasteFanCard: {
    position: "absolute",
    top: 0,
  },
  recycleSymbol: {
    fontSize: 28,
    lineHeight: 32,
  },
  countText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
