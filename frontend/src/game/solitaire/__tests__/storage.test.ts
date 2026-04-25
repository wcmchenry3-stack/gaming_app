import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";

import { clearGame, loadGame, saveGame, loadStats, saveStats } from "../storage";
import { dealGame, applyMove } from "../engine";
import type { SolitaireState } from "../types";

const GAME_KEY = "solitaire_game";

function seedState(): SolitaireState {
  return dealGame(1, 12345);
}

describe("solitaire storage", () => {
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
    expect(loaded!.drawMode).toBe(s.drawMode);
    expect(loaded!.score).toBe(s.score);
    expect(loaded!.stock.length).toBe(s.stock.length);
    expect(loaded!.tableau.length).toBe(7);
  });

  it("returns null when no save exists", async () => {
    expect(await loadGame()).toBeNull();
  });

  it("strips nested undoStack snapshots at save time so storage cannot balloon", async () => {
    // Build a state with several moves so the undoStack has multiple snapshots.
    let s = dealGame(1, 12345);
    for (const card of s.stock.slice(-3)) {
      void card; // silence unused warning
    }
    s = { ...s, waste: [...s.waste] };
    const withFoundation = applyMove(s, { type: "waste-to-foundation" });
    // applyMove may no-op; even so, the undoStack is either [] or one entry.
    // Force a save with an artificially nested undoStack to verify stripping.
    const nested: SolitaireState = {
      ...s,
      undoStack: [{ ...s, undoStack: [{ ...s, undoStack: [] }] }],
    };
    await saveGame(nested);
    const raw = await AsyncStorage.getItem(GAME_KEY);
    const parsed = JSON.parse(raw!);
    for (const snap of parsed.undoStack) {
      expect(snap.undoStack).toEqual([]);
    }
    expect(withFoundation).toBeDefined();
  });

  it("returns null and captures a warning on a corrupt JSON payload", async () => {
    await AsyncStorage.setItem(GAME_KEY, "not-json{{");
    expect(await loadGame()).toBeNull();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("corrupt game payload"),
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ subsystem: "solitaire.storage", op: "load" }),
      })
    );
    // Corrupt entry is removed so subsequent loads don't keep warning.
    expect(await AsyncStorage.getItem(GAME_KEY)).toBeNull();
  });

  it("returns null when the payload has a different shape (missing fields)", async () => {
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify({ foo: "bar" }));
    expect(await loadGame()).toBeNull();
    // Malformed entry is also removed so the next mount starts clean.
    expect(await AsyncStorage.getItem(GAME_KEY)).toBeNull();
  });

  it("returns null on a schema version mismatch (_v !== 1)", async () => {
    const future = { ...seedState(), _v: 2 };
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(future));
    expect(await loadGame()).toBeNull();
  });

  it("clearGame removes the saved state", async () => {
    await saveGame(seedState());
    await clearGame();
    expect(await loadGame()).toBeNull();
  });

  it("normalizes missing timer fields for saves created before timer was added", async () => {
    const stateWithoutTimer = { ...seedState() } as Partial<SolitaireState>;
    delete (stateWithoutTimer as Record<string, unknown>).startedAt;
    delete (stateWithoutTimer as Record<string, unknown>).accumulatedMs;
    await AsyncStorage.setItem(GAME_KEY, JSON.stringify(stateWithoutTimer));
    const loaded = await loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.startedAt).toBeNull();
    expect(loaded!.accumulatedMs).toBe(0);
  });
});

describe("solitaire stats storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (Sentry.captureException as jest.Mock).mockClear();
  });

  it("returns zero defaults when no stats saved", async () => {
    const stats = await loadStats();
    expect(stats).toEqual({ bestTimeMs: 0, bestMoves: 0, gamesPlayed: 0, gamesWon: 0 });
  });

  it("saves and loads stats round-trip", async () => {
    await saveStats({ bestTimeMs: 95000, bestMoves: 42, gamesPlayed: 7, gamesWon: 3 });
    const loaded = await loadStats();
    expect(loaded).toEqual({ bestTimeMs: 95000, bestMoves: 42, gamesPlayed: 7, gamesWon: 3 });
  });

  it("returns zero defaults on corrupt stats payload", async () => {
    await AsyncStorage.setItem("solitaire_stats_v1", "not-json{");
    const stats = await loadStats();
    expect(stats).toEqual({ bestTimeMs: 0, bestMoves: 0, gamesPlayed: 0, gamesWon: 0 });
  });

  it("coerces missing numeric fields to 0 on partial payload", async () => {
    await AsyncStorage.setItem("solitaire_stats_v1", JSON.stringify({ gamesPlayed: 5 }));
    const stats = await loadStats();
    expect(stats).toEqual({ bestTimeMs: 0, bestMoves: 0, gamesPlayed: 5, gamesWon: 0 });
  });
});
