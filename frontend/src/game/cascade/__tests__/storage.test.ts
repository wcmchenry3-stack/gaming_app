/**
 * #216 — Cascade reload persistence storage tests.
 *
 * Covers the save/load/clear round-trip and schema validation. The
 * integration points (CascadeScreen wiring, canvas restore) are
 * exercised by the e2e spec separately.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { saveGame, loadGame, clearGame, CascadeGameSnapshot, SavedFruit } from "../storage";

const KEY = "cascade_game_v1";

function makeSnapshot(overrides: Partial<CascadeGameSnapshot> = {}): CascadeGameSnapshot {
  return {
    version: 1,
    score: 42,
    gameOver: false,
    fruitSetId: "fruits",
    queueTiers: [0, 1],
    fruits: [
      { tier: 0, x: 100, y: 200 },
      { tier: 2, x: 150, y: 400 },
    ],
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("cascade/storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (Sentry.captureException as jest.Mock).mockClear();
    (Sentry.captureMessage as jest.Mock).mockClear();
  });

  describe("round-trip", () => {
    it("saveGame + loadGame returns the same snapshot", async () => {
      const snap = makeSnapshot();
      await saveGame(snap);
      const loaded = await loadGame();
      expect(loaded).toEqual(snap);
    });

    it("empty fruits array round-trips cleanly (native fallback case)", async () => {
      const snap = makeSnapshot({ fruits: [] });
      await saveGame(snap);
      const loaded = await loadGame();
      expect(loaded?.fruits).toEqual([]);
      expect(loaded?.score).toBe(42);
    });

    it("game_over=true round-trips for resume-to-game-over scenarios", async () => {
      const snap = makeSnapshot({ gameOver: true, score: 9999 });
      await saveGame(snap);
      const loaded = await loadGame();
      expect(loaded?.gameOver).toBe(true);
      expect(loaded?.score).toBe(9999);
    });
  });

  describe("clear", () => {
    it("clearGame removes any saved snapshot", async () => {
      await saveGame(makeSnapshot());
      await clearGame();
      const loaded = await loadGame();
      expect(loaded).toBeNull();
    });

    it("loadGame returns null when nothing is saved", async () => {
      const loaded = await loadGame();
      expect(loaded).toBeNull();
    });
  });

  describe("schema validation", () => {
    async function writeRaw(raw: unknown): Promise<void> {
      await AsyncStorage.setItem(KEY, JSON.stringify(raw));
    }

    it("returns null for a wrong version", async () => {
      await writeRaw({ ...makeSnapshot(), version: 99 });
      expect(await loadGame()).toBeNull();
    });

    it("returns null when score is missing", async () => {
      const snap = makeSnapshot() as Partial<CascadeGameSnapshot>;
      delete snap.score;
      await writeRaw(snap);
      expect(await loadGame()).toBeNull();
    });

    it("returns null when queueTiers is missing or wrong length", async () => {
      await writeRaw({ ...makeSnapshot(), queueTiers: [0] });
      expect(await loadGame()).toBeNull();
      await writeRaw({ ...makeSnapshot(), queueTiers: undefined });
      expect(await loadGame()).toBeNull();
    });

    it("returns null when fruits is not an array", async () => {
      await writeRaw({ ...makeSnapshot(), fruits: "not an array" });
      expect(await loadGame()).toBeNull();
    });

    it("drops malformed fruit entries but keeps the snapshot", async () => {
      const snap = makeSnapshot({
        fruits: [
          { tier: 0, x: 100, y: 200 },
          { tier: 1, x: NaN, y: 200 } as SavedFruit, // bad
          null as unknown as SavedFruit, // bad
          { tier: 3, x: 50, y: 50 },
        ],
      });
      await writeRaw(snap);
      const loaded = await loadGame();
      expect(loaded?.fruits).toHaveLength(2);
      expect(loaded?.fruits[0]?.tier).toBe(0);
      expect(loaded?.fruits[1]?.tier).toBe(3);
    });

    it("returns null and deletes the entry when the stored JSON is corrupt", async () => {
      await AsyncStorage.setItem(KEY, "{not json");
      expect(await loadGame()).toBeNull();
      // Subsequent load sees nothing (the corrupt entry was removed).
      expect(await loadGame()).toBeNull();
    });

    // Same #501/#510 pattern: corrupt payload reports as warning.
    it("reports corrupt payload as warning (not exception)", async () => {
      await AsyncStorage.setItem(KEY, "{not json");
      expect(await loadGame()).toBeNull();
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining("corrupt game payload"),
        expect.objectContaining({
          level: "warning",
          tags: expect.objectContaining({ subsystem: "cascade.storage", op: "load" }),
        })
      );
    });
  });
});
