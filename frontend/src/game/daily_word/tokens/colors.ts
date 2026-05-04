/**
 * Semantic color tokens for the Daily Word game.
 * These are Wordle-convention game colors, separate from the BC Arcade brand palette.
 */

export const DW = {
  // Game surface
  bg: "#121213",
  bgModal: "#1a1a1b",
  bgModalOverlay: "rgba(0,0,0,0.7)",

  // Tile states
  tileCorrect: "#538d4e",
  tilePresent: "#b59f3b",
  tileAbsent: "#3a3a3c",
  tileTbd: "#121213",
  tileBorderNeutral: "#565758",
  tileBorderEmpty: "#3a3a3c",

  // Keyboard
  keyUnused: "#818384",
  keyCorrect: "#538d4e",
  keyPresent: "#b59f3b",
  keyAbsent: "#3a3a3c",

  // Text
  textWhite: "#ffffff",
  textMuted: "#818384",
  textBody: "#e8e8f0",
  textDark: "#121213",

  // Feedback accents
  accentWin: "#538d4e",
  accentLoss: "#b59f3b",
} as const;
