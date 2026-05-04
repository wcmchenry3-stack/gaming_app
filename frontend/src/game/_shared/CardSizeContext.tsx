import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";

const MIN_CARD_W = 28;

export interface CardSizeContextValue {
  readonly cardWidth: number;
  readonly cardHeight: number;
}

export const CardSizeContext = createContext<CardSizeContextValue>({ cardWidth: 0, cardHeight: 0 });

export function useCardSize(): CardSizeContextValue {
  return useContext(CardSizeContext);
}

export function useResponsiveCardSize(
  naturalWidth: number,
  naturalHeight: number,
  columns: number,
  gap: number
): CardSizeContextValue {
  const { width: availableWidth } = useWindowDimensions();
  const naturalBoardWidth = columns * naturalWidth + (columns - 1) * gap;
  const scale = Math.max(
    MIN_CARD_W / naturalWidth,
    Math.min(1, availableWidth / naturalBoardWidth)
  );
  return {
    cardWidth: Math.round(naturalWidth * scale),
    cardHeight: Math.round(naturalHeight * scale),
  };
}
