/**
 * Shared PlayingCard — layout wrapper consumed by all card games.
 *
 * Reads the active deck from CardDeckContext and the colour tokens from
 * ThemeContext, then delegates card face rendering to the deck's CardFace
 * component. Games never import deck-specific code directly.
 *
 * To swap the global deck: call setDeck() from useDeck().
 * To add a new deck: add an entry to DECK_REGISTRY — no game code changes.
 */

import React from "react";
import { Pressable, View } from "react-native";
import { useDeck } from "../../game/_shared/decks/CardDeckContext";
import { useTheme } from "../../theme/ThemeContext";
import type { CanonicalSuit } from "../../game/_shared/decks/types";

export interface PlayingCardProps {
  suit: CanonicalSuit;
  rank: number;
  faceDown?: boolean;
  width?: number;
  height?: number;
  rotation?: number;
  /** Accent border (Hearts: valid play, Solitaire: selected card). */
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
  const { activeDeck } = useDeck();
  const { colors } = useTheme();

  const rotateStyle = rotation !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined;

  const cardFace = (
    <activeDeck.CardFace
      suit={suit}
      rank={rank}
      width={width}
      height={height}
      faceDown={faceDown}
      cardBg={colors.surface}
      cardBgBack={colors.surfaceAlt}
      border={highlighted ? colors.accent : colors.border}
      borderHighlight={colors.accent}
      textColor={colors.text}
      redSuitColor={colors.error}
    />
  );

  const wrapperStyle = [{ width, height, opacity: disabled ? 0.4 : 1 }, rotateStyle];

  if (onPress) {
    return (
      <Pressable
        style={wrapperStyle}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        {cardFace}
      </Pressable>
    );
  }

  return (
    <View style={wrapperStyle} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {cardFace}
    </View>
  );
}
