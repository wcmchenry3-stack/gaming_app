import type { DeckTheme } from "./types";

/**
 * Dynamic imports — only the active deck's chunk ever loads.
 * Adding a new deck: add an entry here and register it in availableDecks.
 * No game code changes required.
 */
export const DECK_REGISTRY: Record<string, () => Promise<{ default: DeckTheme }>> = {
  minimal: () => import("./minimal"),
  classic: () => import("./classic"),
  neon: () => import("./neon"),
};

export const DEFAULT_DECK_ID = "classic";

export const AVAILABLE_DECK_IDS = Object.keys(DECK_REGISTRY);
