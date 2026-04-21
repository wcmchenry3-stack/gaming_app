/**
 * Shared PlayingCard — canonical props interface + native/Jest text implementation.
 *
 * On web, Metro resolves PlayingCard.web.tsx instead (cardmeister SVG art).
 * Games import from this path and never know which renderer is underneath.
 * To swap decks: replace PlayingCard.web.tsx. To add runtime deck-switching:
 * wrap in a CardDeckContext and have both files read from it.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { type CanonicalSuit, rankLabel, suitEmoji, RED_SUITS } from "./cardId";

export interface PlayingCardProps {
  suit: CanonicalSuit;
  rank: number;
  faceDown?: boolean;
  width?: number;
  height?: number;
  rotation?: number;
  /** Accent border — used by Hearts (valid play) and Solitaire (selected). */
  highlighted?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export default function PlayingCard({
  suit,
  rank,
  faceDown = false,
  width = 52,
  height = 74,
  rotation = 0,
  highlighted = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: PlayingCardProps) {
  const { colors } = useTheme();

  const rotateStyle = rotation !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined;
  const borderColor = highlighted ? colors.accent : colors.border;
  const borderWidth = highlighted ? 2 : 1;

  if (faceDown) {
    const content = (
      <View
        style={[
          styles.card,
          { width, height, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
          rotateStyle,
        ]}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={[styles.backInner, { borderColor: colors.secondary }]}>
          <Text style={[styles.backMark, { color: colors.secondary }]}>?</Text>
        </View>
      </View>
    );
    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
        >
          {content}
        </Pressable>
      );
    }
    return content;
  }

  const isRed = RED_SUITS.has(suit);
  const rankColor = isRed ? colors.error : colors.text;
  const rankText = rankLabel(rank);
  const suitText = suitEmoji(suit);

  const cardContent = (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          borderColor,
          borderWidth,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.4 : 1,
        },
        rotateStyle,
      ]}
    >
      <Text style={[styles.rank, { color: rankColor }]}>{rankText}</Text>
      <Text style={[styles.suit, { color: rankColor }]}>{suitText}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {cardContent}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
    gap: 2,
  },
  backInner: {
    width: "70%",
    height: "70%",
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backMark: {
    fontSize: 22,
    fontWeight: "700",
  },
  rank: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  suit: {
    fontSize: 18,
    lineHeight: 22,
  },
});
