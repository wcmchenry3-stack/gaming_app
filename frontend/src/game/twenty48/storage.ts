/**
 * AsyncStorage persistence for 2048 in-progress games.
 *
 * Saves after every move so a crash or app-kill mid-game doesn't lose
 * progress. One slot per device (single-player, no account linkage).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { Twenty48State } from "./types";

const STORAGE_KEY = "twenty48_game_v1";

export async function saveGame(state: Twenty48State): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "twenty48.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<Twenty48State | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Twenty48State;
    // Cheap sanity check — a corrupted or shape-drifted payload should be discarded.
    if (
      !Array.isArray(parsed.board) ||
      parsed.board.length !== 4 ||
      typeof parsed.score !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "twenty48.storage", op: "load" } });
    return null;
  }
}

export async function clearGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "twenty48.storage", op: "clear" } });
  }
}
