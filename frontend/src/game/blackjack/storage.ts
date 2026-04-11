/**
 * AsyncStorage persistence for Blackjack in-progress games.
 *
 * Persists the full engine state (deck + both hands + chip balance) so a
 * player can close the app mid-hand and resume where they left off, and
 * so chip balance carries across launches.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { DEFAULT_RULES, EngineState } from "./engine";

const STORAGE_KEY = "blackjack_game_v2";

export async function saveGame(state: EngineState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "blackjack.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<EngineState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EngineState;
    // Sanity check — shape drift discards rather than crashing.
    if (
      typeof parsed.chips !== "number" ||
      typeof parsed.bet !== "number" ||
      typeof parsed.phase !== "string" ||
      !Array.isArray(parsed.deck) ||
      !Array.isArray(parsed.player_hand) ||
      !Array.isArray(parsed.dealer_hand) ||
      !Array.isArray(parsed.player_hands) ||
      !Array.isArray(parsed.hand_bets)
    ) {
      return null;
    }
    // Backfill rules for saves created before configurable rules.
    if (!parsed.rules) {
      parsed.rules = DEFAULT_RULES;
    }
    // Backfill lastWin for saves created before the HUD was added.
    if (!("lastWin" in (parsed as object))) {
      (parsed as unknown as Record<string, unknown>).lastWin = null;
    }
    return parsed;
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "blackjack.storage", op: "load" } });
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    return null;
  }
}

export async function clearGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "blackjack.storage", op: "clear" } });
  }
}
