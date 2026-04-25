/**
 * AsyncStorage persistence for in-progress Solitaire games (#597).
 *
 * Saves after every state mutation so a crash or backgrounded app doesn't
 * lose progress. One slot per device; no account linkage in V1.
 *
 * `saveGame` strips the nested `undoStack` arrays from each snapshot down
 * to `[]` so the on-disk payload cannot balloon exponentially (a naive
 * serialize would persist every previous state's prior-state chain). The
 * engine already guarantees nested stacks are `[]` at write time — this
 * is defensive belt-and-suspenders.
 *
 * `loadGame` enforces `_v: 1` so future schema bumps reject incompatible
 * payloads rather than crashing the screen. Corrupt payloads are deleted
 * and reported as a warning (not an exception) — the caller recovers by
 * starting a fresh game.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import type { SolitaireState } from "./types";

const GAME_KEY = "solitaire_game";

function stripNestedUndo(state: SolitaireState): SolitaireState {
  return {
    ...state,
    undoStack: state.undoStack.map((snapshot) => ({ ...snapshot, undoStack: [] })),
  };
}

export async function saveGame(state: SolitaireState): Promise<void> {
  try {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(stripNestedUndo(state)));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "solitaire.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<SolitaireState | null> {
  try {
    const raw = await AsyncStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SolitaireState>;
    if (
      parsed._v !== 1 ||
      (parsed.drawMode !== 1 && parsed.drawMode !== 3) ||
      !Array.isArray(parsed.tableau) ||
      parsed.tableau.length !== 7 ||
      parsed.foundations === null ||
      typeof parsed.foundations !== "object" ||
      !Array.isArray(parsed.stock) ||
      !Array.isArray(parsed.waste) ||
      typeof parsed.score !== "number" ||
      typeof parsed.recycleCount !== "number" ||
      !Array.isArray(parsed.undoStack) ||
      typeof parsed.isComplete !== "boolean"
    ) {
      await AsyncStorage.removeItem(GAME_KEY).catch(() => {});
      return null;
    }
    return parsed as SolitaireState;
  } catch (e) {
    Sentry.captureMessage("solitaire.storage: corrupt game payload, discarding", {
      level: "warning",
      tags: { subsystem: "solitaire.storage", op: "load" },
      extra: { error: String(e), key: GAME_KEY },
    });
    await AsyncStorage.removeItem(GAME_KEY).catch(() => {});
    return null;
  }
}

export async function clearGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GAME_KEY);
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "solitaire.storage", op: "clear" } });
  }
}
