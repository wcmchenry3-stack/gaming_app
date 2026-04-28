/**
 * Shared design-token constants that live outside ThemeContext so they
 * can be imported into screens/components without pulling the full theme.
 *
 * Matches the design-tokens policy skip pattern `theme\.[^./]+\.[jt]sx?$`,
 * which lets us keep raw color literals here instead of inlining them in
 * screen files.
 */

/** Semi-transparent black backdrop behind modal cards. */
export const MODAL_SCRIM = "rgba(0,0,0,0.5)";

/** Yacht celebration badge — gold, matching the original badge colour. */
export const BADGE_YACHT_BG = "rgba(255,215,0,0.95)";

/** Joker celebration badge — purple, for the joker variant. */
export const BADGE_JOKER_BG = "rgba(138,43,226,0.95)";
