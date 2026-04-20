import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import type { HeartsState } from "./types";

const GAME_KEY = "hearts_game";

export async function saveGame(state: HeartsState): Promise<void> {
  try {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(state));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "hearts.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<HeartsState | null> {
  try {
    const raw = await AsyncStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HeartsState>;
    if (
      parsed._v !== 1 ||
      !Array.isArray(parsed.playerHands) ||
      parsed.playerHands.length !== 4 ||
      !Array.isArray(parsed.cumulativeScores) ||
      parsed.cumulativeScores.length !== 4 ||
      !Array.isArray(parsed.handScores) ||
      parsed.handScores.length !== 4 ||
      !Array.isArray(parsed.currentTrick) ||
      !Array.isArray(parsed.wonCards) ||
      typeof parsed.tricksPlayedInHand !== "number" ||
      typeof parsed.heartsBroken !== "boolean" ||
      typeof parsed.isComplete !== "boolean"
    ) {
      await AsyncStorage.removeItem(GAME_KEY).catch(() => {});
      return null;
    }
    return parsed as HeartsState;
  } catch (e) {
    Sentry.captureMessage("hearts.storage: corrupt game payload, discarding", {
      level: "warning",
      tags: { subsystem: "hearts.storage", op: "load" },
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
    Sentry.captureException(e, { tags: { subsystem: "hearts.storage", op: "clear" } });
  }
}
