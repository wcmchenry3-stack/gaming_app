import React from "react";
import { useTranslation } from "react-i18next";
import SharedPlayingCard from "../shared/PlayingCard";
import type { Card } from "../../game/hearts/types";
import type { CanonicalSuit } from "../shared/cardId";
import { rankLabel } from "../shared/cardId";

interface Props {
  card: Card;
  faceDown?: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export default function PlayingCard({ card, faceDown = false, highlighted = false, disabled = false, onPress }: Props) {
  const { t } = useTranslation("hearts");

  const rankStr = rankLabel(card.rank);
  const suitName = t(`card.suit.${card.suit}`);
  const label = faceDown
    ? t("card.faceDown")
    : highlighted
      ? t("card.highlighted", { rank: rankStr, suit: suitName })
      : t("card.label", { rank: rankStr, suit: suitName });

  return (
    <SharedPlayingCard
      suit={card.suit as CanonicalSuit}
      rank={card.rank}
      faceDown={faceDown}
      highlighted={highlighted}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}
