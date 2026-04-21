import React from "react";
import { useTranslation } from "react-i18next";
import SharedPlayingCard from "../shared/PlayingCard";
import type { CanonicalSuit } from "../shared/cardId";
import { rankLabel } from "../shared/cardId";
import { CardResponse } from "../../game/blackjack/types";

interface Props {
  card: CardResponse;
  /** Clockwise rotation in degrees — used for the player-hand card fan. */
  rotation?: number;
  /** "player" renders a larger card; "dealer" renders the compact default. */
  variant?: "player" | "dealer";
  compact?: boolean;
}

const EMOJI_TO_SUIT: Record<string, CanonicalSuit> = {
  "♠": "spades",
  "♥": "hearts",
  "♦": "diamonds",
  "♣": "clubs",
};

const RANK_STR_TO_NUM: Record<string, number> = {
  A: 1,
  J: 11,
  Q: 12,
  K: 13,
};

function cardSize(variant: "player" | "dealer", compact: boolean): { w: number; h: number } {
  if (variant === "player") return compact ? { w: 48, h: 68 } : { w: 68, h: 96 };
  return compact ? { w: 40, h: 56 } : { w: 52, h: 72 };
}

export default function PlayingCard({ card, rotation = 0, variant = "dealer", compact = false }: Props) {
  const { t } = useTranslation("blackjack");
  const { w, h } = cardSize(variant, compact);

  const suit = EMOJI_TO_SUIT[card.suit] ?? "spades";
  const rank = RANK_STR_TO_NUM[card.rank] ?? parseInt(card.rank, 10);
  const rankStr = rankLabel(rank);
  const suitName = t(`card.suit.${suit}`);
  const label = card.face_down
    ? t("card.faceDown")
    : t("card.accessibilityLabel", { rank: card.rank, suit: suitName });

  return (
    <SharedPlayingCard
      suit={suit}
      rank={rank}
      faceDown={card.face_down}
      width={w}
      height={h}
      rotation={rotation}
      accessibilityLabel={label}
    />
  );
}
