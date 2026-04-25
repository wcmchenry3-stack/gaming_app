import type { CanonicalSuit } from "../types";

/**
 * SVG path data for the four suit glyphs, normalised to a 500×500 viewBox.
 * Paths are hand-tuned for legibility at small card sizes (52×74px and up).
 */
export const SUIT_PATHS: Record<CanonicalSuit, string> = {
  hearts:
    "M 250 450 C 250 450 40 310 40 180 C 40 95 110 55 180 75 C 210 84 235 105 250 130 C 265 105 290 84 320 75 C 390 55 460 95 460 180 C 460 310 250 450 250 450 Z",

  spades:
    "M 250 50 C 250 50 450 195 450 315 C 450 385 385 405 325 375 C 345 420 350 455 385 470 L 115 470 C 150 455 155 420 175 375 C 115 405 50 385 50 315 C 50 195 250 50 250 50 Z",

  diamonds: "M 250 30 L 470 250 L 250 470 L 30 250 Z",

  clubs:
    "M 250 470 L 195 360 C 140 388 65 358 65 278 C 65 208 128 172 188 188 C 162 138 162 68 218 50 C 228 47 272 47 282 50 C 338 68 338 138 312 188 C 372 172 435 208 435 278 C 435 358 360 388 305 360 L 250 470 Z",
};
