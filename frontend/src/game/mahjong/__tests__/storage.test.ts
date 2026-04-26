import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";

import { clearGame, loadGame, saveGame, loadStats, saveStats } from "../storage";
import { createGame } from "../engine";
import { TURTLE_LAYOUT } from "../layouts/turtle";
import type { MahjongState } from "../types";

const GAME_KEY = "mahjong_game";

function seedState(): MahjongState {
  return createGame(TURTLE_LAYOUT, 12345);
}

describe("mahjong game storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (Sentry.captureException as jest.Mock).mockClear();
    (Sentry.captureMessage as jest.Mock).mockClear();
  });

  it("round-trips a fresh deal via save → load", async () => {
    const s = seedState();
    await saveGame(s);
    const loaded = await loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!._v).toBe(1);
    expect(loaded!.tiles.length).toBe(s.tiles.length);
    expect(loaded!.score).toBe(s.score);
    expect(loaded!.shufflesLeft).toBe(s.shufflesLeft);
    expect(loaded!.isComplete).toBe(false);
  });

  it("returns null when no save exists", async () => {
    expect(await loadGame()).toBeNull();
  });

  it("strips nested undoStack snapshots at save time so storage cannot balloon", async () => {
    const nested: MahjongState = {
      ...seedState(),
      undoStack: [{ ...seedState(), undoStack: [{ ...seedState(), undoStack: [] }] }],
    };
    await saveGame(nested);
    const raw = await AsyncStorage.getItem(GAME_KEY);
    const parsed = JSON.parse(raw!);
    for (const snap of parsed.undoStack) {
      expect(snap.undoStack).toEqual([]);
    }
  });

  it("returns null and captures a warning on corrupt JSON", async () => {
    await AsyncStorage.setItem(GAME_KEY, "not-json{{");
    expect(await loadGame()).toBeNull();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("corrupt game payload"),
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ subsystem: "mahjong.storage", op: "load" }),
      })
    );
    expect(await AsyncStorage.getItem(GAME_KEY)).toBeNull();
  });

  it("returns null when the payload has a different shape (missing fields)", async () => {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify({ foo: "bar" }));
    expect(await loadGame()).toBeNull();
    expect(await AsyncStorage.getItem(GAME_KEY)).toBeNull();
  });

  it("returns null on schema version mismatch (_v !== 1)", async () => {
    const future = { ...seedState(), _v: 2 };
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(future));
    expect(await loadGame()).toBeNull();
  });

  it("clearGame removes the saved state", async () => {
    await saveGame(seedState());
    await clearGame();
    expect(await loadGame()).toBeNull();
  });

  it("normalizes missing startedAt to null", async () => {
    const stateWithout = { ...seedState() } as Partial<MahjongState>;
    delete (stateWithout as Record<string, unknown>).startedAt;
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(stateWithout));
    const loaded = await loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.startedAt).toBeNull();
  });
});

describe("mahjong stats storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (Sentry.captureException as jest.Mock).mockClear();
  });

  it("returns zero defaults when no stats saved", async () => {
    const stats = await loadStats();
    expect(stats).toEqual({ bestScore: 0, bestTimeMs: 0, gamesPlayed: 0, gamesWon: 0 });
  });

  it("saves and loads stats round-trip", async () => {
    await saveStats({ bestScore: 1230, bestTimeMs: 185000, gamesPlayed: 10, gamesWon: 4 });
    const loaded = await loadStats();
    expect(loaded).toEqual({ bestScore: 1230, bestTimeMs: 185000, gamesPlayed: 10, gamesWon: 4 });
  });

  it("returns zero defaults on corrupt stats payload", async () => {
    await AsyncStorage.setItem("mahjong_stats_v1", "not-json{");
    const stats = await loadStats();
    expect(stats).toEqual({ bestScore: 0, bestTimeMs: 0, gamesPlayed: 0, gamesWon: 0 });
  });

  it("coerces missing numeric fields to 0 on partial payload", async () => {
    await AsyncStorage.setItem("mahjong_stats_v1", JSON.stringify({ gamesPlayed: 5 }));
    const stats = await loadStats();
    expect(stats).toEqual({ bestScore: 0, bestTimeMs: 0, gamesPlayed: 5, gamesWon: 0 });
  });
});
