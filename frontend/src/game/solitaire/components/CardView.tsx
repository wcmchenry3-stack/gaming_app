import React from "react";
import { useTranslation } from "react-i18next";
import SharedPlayingCard from "../../../components/shared/PlayingCard";
import type { CanonicalSuit } from "../../../components/shared/cardId";
import { rankLabel } from "../../../components/shared/cardId";
import type { Card } from "../types";

export interface CardViewProps {
  readonly card: Card;
  readonly selected?: boolean;
  readonly onPress?: () => void;
}

export default function CardView({ card, selected = false, onPress }: CardViewProps) {
  const { t } = useTranslation("solitaire");

  const rank = rankLabel(card.rank);
  const suitName = t(`suit.${card.suit}` as const);
  const label = !card.faceUp
    ? selected
      ? t("card.faceDownSelected")
      : t("card.faceDown")
    : selected
      ? t("card.faceUpSelected", { rank, suit: suitName })
      : t("card.faceUp", { rank, suit: suitName });

  return (
    <SharedPlayingCard
      suit={card.suit as CanonicalSuit}
      rank={card.rank}
      faceDown={!card.faceUp}
      highlighted={selected}
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

export const CARD_WIDTH = 52;
export const CARD_HEIGHT = 74;
