import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import type { FreeCellState } from "./types";

const GAME_KEY = "freecell_game";

function stripNestedUndo(state: FreeCellState): FreeCellState {
  return {
    ...state,
    undoStack: state.undoStack.map((snapshot) => ({ ...snapshot, undoStack: [] })),
  };
}

export async function saveGame(state: FreeCellState): Promise<void> {
  try {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(stripNestedUndo(state)));
  } catch (e) {
    Sentry.captureException(e, { tags: { subsystem: "freecell.storage", op: "save" } });
  }
}

export async function loadGame(): Promise<FreeCellState | null> {
  try {
    const raw = await AsyncStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FreeCellState>;
    if (
      parsed._v !== 1 ||
      !Array.isArray(parsed.tableau) ||
      parsed.tableau.length !== 8 ||
      parsed.foundations === null ||
      typeof parsed.foundations !== "object" ||
      !Array.isArray(parsed.freeCells) ||
      parsed.freeCells.length !== 4 ||
      !Array.isArray(parsed.undoStack) ||
      typeof parsed.isComplete !== "boolean" ||
      typeof parsed.moveCount !== "number"
    ) {
      await AsyncStorage.removeItem(GAME_KEY).catch(() => {});
      return null;
    }
    return parsed as FreeCellState;
  } catch (e) {
    Sentry.captureMessage("freecell.storage: corrupt game payload, discarding", {
      level: "warning",
      tags: { subsystem: "freecell.storage", op: "load" },
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
    Sentry.captureException(e, { tags: { subsystem: "freecell.storage", op: "clear" } });
  }
}
