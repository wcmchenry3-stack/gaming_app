/**
 * AsyncStorage persistence for 2048 in-progress games and best score.
 *
 * Saves after every move so a crash or app-kill mid-game doesn't lose
 * progress. One slot per device (single-player, no account linkage).
 *
 * Storage key bumped to v2 because Twenty48State now includes `tiles` and
 * `scoreDelta` — v1 payloads are silently discarded on first load.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { Twenty48State } from "./types";

const GAME_KEY = "twenty48_game_v2";
const BEST_SCORE_KEY = "twenty48_best_score_v1";

export async function saveGame(state: Twenty48State): Promise<void> {
  try {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(state));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "twenty48.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<Twenty48State | null> {
  try {
    const raw = await AsyncStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Twenty48State;
    if (
      !Array.isArray(parsed.board) ||
      parsed.board.length !== 4 ||
      typeof parsed.score !== "number" ||
      !Array.isArray(parsed.tiles)
    ) {
      return null;
    }
    // Normalize timer fields — absent in states saved before timer was added.
    parsed.startedAt = parsed.startedAt ?? null;
    parsed.accumulatedMs = parsed.accumulatedMs ?? 0;
    return parsed;
  } catch (e) {
    // Corrupt payload: recovery is complete (we remove the bad entry and
    // return null, so the caller starts a fresh game). This is not an
    // error — downgrade from captureException to a warning captureMessage
    // so it doesn't page as a crash in Sentry. See #501.
    Sentry.captureMessage("twenty48.storage: corrupt game payload, discarding", {
      level: "warning",
      tags: { subsystem: "twenty48.storage", op: "load" },
      extra: { error: String(e), key: GAME_KEY },
    });
    // Remove corrupted entry so it doesn't fail on every subsequent load.
    await AsyncStorage.removeItem(GAME_KEY).catch(() => {});
    return null;
  }
}

export async function clearGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GAME_KEY);
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "twenty48.storage", op: "clear" } });
  }
}

export async function saveBestScore(score: number): Promise<void> {
  try {
    await AsyncStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "twenty48.storage", op: "saveBest" } });
  }
}

export async function loadBestScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BEST_SCORE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "twenty48.storage", op: "loadBest" } });
    return 0;
  }
}
