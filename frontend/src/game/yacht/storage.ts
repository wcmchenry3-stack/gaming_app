/**
 * AsyncStorage persistence for Yacht in-progress games.
 *
 * Saves after every action (roll/score/new game) so a crash or app-kill
 * mid-game doesn't lose progress. One slot per device.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { GameState } from "./types";

const STORAGE_KEY = "yacht_game_v1";

export async function saveGame(state: GameState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "yacht.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Sanity check — shape drift should discard rather than crash the screen.
    if (
      !Array.isArray(parsed.dice) ||
      parsed.dice.length !== 5 ||
      typeof parsed.round !== "number" ||
      typeof parsed.scores !== "object" ||
      parsed.scores === null
    ) {
      return null;
    }
    return parsed;
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "yacht.storage", op: "load" } });
    return null;
  }
}

export async function clearGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "yacht.storage", op: "clear" } });
  }
}
