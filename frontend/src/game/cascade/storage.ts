/**
 * AsyncStorage persistence for Cascade in-progress games (#216).
 *
 * Cascade is a physics-simulation game, so "saving" the board means
 * serializing each fruit's tier + resting position. On reload, fruits
 * are re-spawned at their saved coordinates with zero velocity and
 * allowed to settle for a frame or two — the visual difference is
 * minimal compared to a crash-and-lose-everything outcome.
 *
 * Save trigger: after each merge + on a throttled interval while the
 * player is dropping. Clear trigger: game-over, fruit-set switch,
 * explicit New Game.
 *
 * Native (iOS/Android) caveat: the native Skia canvas doesn't yet
 * expose its fruit snapshot, so `fruits` may be empty when saving
 * from native. The loader tolerates this — score + game-over flag
 * still resume correctly, just with an empty board. Full native
 * parity is a follow-up.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";

const GAME_KEY = "cascade_game_v1";

export interface SavedFruit {
  tier: number;
  x: number;
  y: number;
}

export interface CascadeGameSnapshot {
  version: 1;
  score: number;
  gameOver: boolean;
  fruitSetId: string;
  /** [currentTier, nextPreviewTier] from FruitQueue at save time. */
  queueTiers: [number, number];
  /** Array of in-flight fruits at save time. May be empty on native. */
  fruits: SavedFruit[];
  savedAt: number;
}

export async function saveGame(snapshot: CascadeGameSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(snapshot));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "cascade.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<CascadeGameSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CascadeGameSnapshot>;
    // Schema validation — discard anything that doesn't match the v1 shape.
    if (
      parsed.version !== 1 ||
      typeof parsed.score !== "number" ||
      typeof parsed.gameOver !== "boolean" ||
      typeof parsed.fruitSetId !== "string" ||
      !Array.isArray(parsed.queueTiers) ||
      parsed.queueTiers.length !== 2 ||
      !Array.isArray(parsed.fruits)
    ) {
      return null;
    }
    // Defensive clamp: drop any fruit with malformed fields.
    const fruits: SavedFruit[] = parsed.fruits.filter(
      (f): f is SavedFruit =>
        !!f &&
        typeof f.tier === "number" &&
        typeof f.x === "number" &&
        typeof f.y === "number" &&
        Number.isFinite(f.x) &&
        Number.isFinite(f.y)
    );
    return {
      version: 1,
      score: parsed.score,
      gameOver: parsed.gameOver,
      fruitSetId: parsed.fruitSetId,
      queueTiers: [parsed.queueTiers[0] as number, parsed.queueTiers[1] as number],
      fruits,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch (e) {
    // Corrupt payload: recovery is complete. See #501/#510 for the
    // rationale behind downgrading this from captureException to a
    // warning-level captureMessage.
    Sentry.captureMessage("cascade.storage: corrupt game payload, discarding", {
      level: "warning",
      tags: { subsystem: "cascade.storage", op: "load" },
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
    Sentry.captureException(e, { tags: { subsystem: "cascade.storage", op: "clear" } });
  }
}
