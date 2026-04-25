import type React from "react";

export type CanonicalSuit = "spades" | "hearts" | "diamonds" | "clubs";

/**
 * Props passed by PlayingCard to whichever deck renderer is active.
 * All colours come from ThemeContext so every deck is dark-mode aware
 * by default. A deck may ignore colours it doesn't need (e.g. the Neon
 * deck uses its own fixed palette) but must never hardcode colours that
 * would break in light mode.
 */
export interface CardFaceProps {
  suit: CanonicalSuit;
  rank: number; // 1=A  2-10  11=J  12=Q  13=K
  width: number;
  height: number;
  faceDown: boolean;
  // ThemeContext colours injected by PlayingCard
  cardBg: string; // card face background
  cardBgBack: string; // card back background
  border: string; // normal border colour
  borderHighlight: string; // accent border when highlighted/selected
  textColor: string; // rank text + black suits
  redSuitColor: string; // hearts / diamonds
}

export interface DeckTheme {
  id: string;
  /** Display name — used in Settings UI. */
  name: string;
  CardFace: React.ComponentType<CardFaceProps>;
}
