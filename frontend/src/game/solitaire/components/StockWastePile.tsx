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
import CardView, { CARD_HEIGHT, CARD_WIDTH } from "./CardView";

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

  return (
    <View style={styles.row}>
      <Stock
        count={stock.length}
        colors={colors}
        onPress={onStockPress}
        drawMode={drawMode}
        t={t}
      />
      <Waste
        waste={waste}
        drawMode={drawMode}
        selected={wasteSelected}
        onPress={onWastePress}
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
  t,
}: {
  readonly count: number;
  readonly colors: ReturnType<typeof useTheme>["colors"];
  readonly onPress?: () => void;
  readonly drawMode: DrawMode;
  readonly t: TFunction<"solitaire">;
}) {
  const isEmpty = count === 0;
  const label = isEmpty
    ? t("pile.stock.empty", { count: drawMode })
    : t("pile.stock.label", { count: drawMode, remaining: count });

  const style = [
    styles.slot,
    {
      backgroundColor: isEmpty ? colors.background : colors.surfaceAlt,
      borderColor: colors.border,
      borderWidth: 1,
      borderStyle: isEmpty ? ("dashed" as const) : ("solid" as const),
    },
  ];

  const content = isEmpty ? (
    <Text style={[styles.recycleSymbol, { color: colors.textMuted }]}>↻</Text>
  ) : (
    <>
      <Text style={[styles.countText, { color: colors.textMuted }]}>{count}</Text>
    </>
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
  t,
}: {
  readonly waste: readonly Card[];
  readonly drawMode: DrawMode;
  readonly selected: boolean;
  readonly onPress?: () => void;
  readonly t: TFunction<"solitaire">;
}) {
  if (waste.length === 0) {
    return (
      <View
        style={styles.wasteEmpty}
        accessibilityRole="image"
        accessibilityLabel={t("pile.waste.empty")}
      />
    );
  }

  if (drawMode !== 3) {
    const top = waste[waste.length - 1];
    if (top === undefined) return null;
    return <CardView card={top} selected={selected} onPress={onPress} />;
  }

  const visibleCount = Math.min(3, waste.length);
  const visible = waste.slice(waste.length - visibleCount);
  const containerWidth = (visibleCount - 1) * WASTE_FAN_OFFSET + CARD_WIDTH;

  return (
    <View style={[styles.wasteFanContainer, { width: containerWidth }]}>
      {visible.map((card, i) => {
        const isTop = i === visible.length - 1;
        return (
          <View
            key={`${card.suit}-${card.rank}`}
            style={[styles.wasteFanCard, { left: i * WASTE_FAN_OFFSET }]}
          >
            <CardView
              card={card}
              selected={isTop && selected}
              onPress={isTop ? onPress : undefined}
            />
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
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  wasteEmpty: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  wasteFanContainer: {
    height: CARD_HEIGHT,
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
