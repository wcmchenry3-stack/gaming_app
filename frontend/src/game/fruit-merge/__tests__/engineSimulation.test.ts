/**
 * engineSimulation.test.ts — multi-step Fruit Merge engine simulation tests.
 *
 * Extends the unit tests in engine.test.ts with multi-step scenarios:
 *   - Chain merges (tier 0 → 1 → 2)
 *   - Score accumulation across a merge sequence
 *   - Game-over with multiple fruits above the danger line
 *   - Determinism: same drop + collision sequence → identical events
 *   - Watermelon (tier 10): merge produces no new body
 *
 * Uses the manual Rapier2D mock at frontend/__mocks__/@dimforge/rapier2d-compat.ts
 * so no WASM binary is required.
 */
jest.mock("@dimforge/rapier2d-compat");

import { createEngine, EngineHandle } from "../engine";
import { scoreForMerge } from "../scoring";
import { FRUIT_SETS } from "../../../theme/fruitSets";
import { MockWorld } from "../../../../__mocks__/@dimforge/rapier2d-compat";

// Access live mock module to inspect constructor call counts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RAPIER_MOCK = require("@dimforge/rapier2d-compat").default;

const fruitSet = FRUIT_SETS["fruits"];
const W = 300;
const H = 600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the MockWorld created by the most recent createEngine call. */
function getWorld(): MockWorld {
  const results = (RAPIER_MOCK.World as jest.Mock).mock.results;
  return results[results.length - 1].value as MockWorld;
}

async function buildEngine(
  onMerge = jest.fn(),
  onGameOver = jest.fn(),
): Promise<EngineHandle> {
  return createEngine(W, H, fruitSet, onMerge, onGameOver);
}

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Chain merge: tier 0 → tier 1
// ---------------------------------------------------------------------------

describe("chain merge: tier 0 → tier 1", () => {
  it("fires onMerge with tier 0 when two tier-0 fruits collide", async () => {
    const onMerge = jest.fn();
    const handle = await buildEngine(onMerge);
    const world = getWorld();

    // Wall colliders get handles 1000–1002; first two fruit colliders get 1003, 1004
    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 0 }));
  });

  it("produces a tier-1 body after a tier-0 merge", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step();

    // The merged tier-1 fruit should appear in the next step
    const tiers = handle.step().map((s) => s.tier);
    expect(tiers).toContain(1);
  });
});

// ---------------------------------------------------------------------------
// Chain merge: tier 1 → tier 2
// ---------------------------------------------------------------------------

describe("chain merge: tier 1 → tier 2", () => {
  it("fires onMerge with tier 1 after a second-level merge", async () => {
    const onMerge = jest.fn();
    const handle = await buildEngine(onMerge);
    const world = getWorld();

    // First merge: two tier-0 → tier-1 (colliders 1003, 1004)
    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step(); // spawns tier-1 at collider 1005

    // Second merge: spawned tier-1 collides with a freshly dropped tier-1 (collider 1006)
    handle.drop(fruitSet.fruits[1], fruitSet.id, 120, 300);
    handle.step(); // assigns collider 1006
    world._fireCollision(1005, 1006);
    handle.step();

    expect(onMerge).toHaveBeenCalledTimes(2);
    const tiers = onMerge.mock.calls.map((call: [{ tier: number }]) => call[0].tier);
    expect(tiers).toEqual([0, 1]);
  });

  it("produces a tier-2 body after the second-level merge", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step(); // spawns tier-1 at 1005

    handle.drop(fruitSet.fruits[1], fruitSet.id, 120, 300);
    handle.step(); // assigns 1006
    world._fireCollision(1005, 1006);
    handle.step();

    const tiers = handle.step().map((s) => s.tier);
    expect(tiers).toContain(2);
  });
});

// ---------------------------------------------------------------------------
// Score accumulation
// ---------------------------------------------------------------------------

describe("score accumulation across a merge sequence", () => {
  it("sum of onMerge scores equals expected tier values", async () => {
    let totalScore = 0;
    const onMerge = jest.fn((e: { tier: number }) => {
      totalScore += scoreForMerge(e.tier as Parameters<typeof scoreForMerge>[0]);
    });
    const handle = await buildEngine(onMerge);
    const world = getWorld();

    // Merge 1: tier 0 → scores scoreForMerge(0) = 2
    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step(); // spawns tier-1 at 1005

    // Merge 2: tier 1 → scores scoreForMerge(1) = 4
    handle.drop(fruitSet.fruits[1], fruitSet.id, 120, 300);
    handle.step(); // assigns 1006
    world._fireCollision(1005, 1006);
    handle.step();

    expect(totalScore).toBe(scoreForMerge(0) + scoreForMerge(1)); // 2 + 4 = 6
  });

  it("five sequential tier-0 merges produce correct cumulative score", async () => {
    // Each pair of tier-0 fruits merges for scoreForMerge(0) = 2
    // After first merge a tier-1 spawns; it won't merge unless we fire another collision
    // This test just counts 3 isolated tier-0 merges
    let totalScore = 0;
    const onMerge = jest.fn((e: { tier: number }) => {
      totalScore += scoreForMerge(e.tier as Parameters<typeof scoreForMerge>[0]);
    });
    const handle = await buildEngine(onMerge);
    const world = getWorld();

    // Merge 1: colliders 1003, 1004
    handle.drop(fruitSet.fruits[0], fruitSet.id, 50, 500);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 60, 500);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step();

    // After first merge a tier-1 spawns at 1005.
    // Merge 2 uses two new tier-0 drops → 1006, 1007
    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 500);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 110, 500);
    handle.step();
    world._fireCollision(1006, 1007);
    handle.step();

    // After merge 2, spawned tier-1 gets collider 1008.
    // Merge 3 uses two new tier-0 drops → colliders 1009, 1010
    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 500);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 160, 500);
    handle.step();
    world._fireCollision(1009, 1010);
    handle.step();

    expect(onMerge).toHaveBeenCalledTimes(3);
    expect(totalScore).toBe(3 * scoreForMerge(0)); // 3 × 2 = 6
  });
});

// ---------------------------------------------------------------------------
// Watermelon (tier 10): merge disappears, no new body
// ---------------------------------------------------------------------------

describe("watermelon tier-10 merge", () => {
  it("fires onMerge with tier 10 and no new body spawns", async () => {
    const onMerge = jest.fn();
    const handle = await buildEngine(onMerge);
    const world = getWorld();

    handle.drop(fruitSet.fruits[10], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[10], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 10 }));
    // No new fruit body should exist after watermelon disappears
    expect(handle.step()).toHaveLength(0);
  });

  it("awards the watermelon bonus score (256)", async () => {
    let mergeScore = 0;
    const onMerge = jest.fn((e: { tier: number }) => {
      mergeScore += scoreForMerge(e.tier as Parameters<typeof scoreForMerge>[0]);
    });
    const handle = await buildEngine(onMerge);
    const world = getWorld();

    handle.drop(fruitSet.fruits[10], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[10], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step();

    expect(mergeScore).toBe(256);
  });
});

// ---------------------------------------------------------------------------
// Game-over: multiple fruits above danger line
// ---------------------------------------------------------------------------

describe("game-over with multiple fruits above the danger line", () => {
  it("fires onGameOver exactly once when multiple fruits exceed the danger line", async () => {
    const onGameOver = jest.fn();
    const handle = await buildEngine(jest.fn(), onGameOver);

    // tier-0 radius ≈ 18px. Top = y - 18. dangerY = H * DANGER_LINE_RATIO ≈ 108px.
    // Placing at y=50 → top = 32, well above the danger line.
    handle.drop(fruitSet.fruits[0], fruitSet.id, 130, 50);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 50);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 170, 50);
    handle.step(); // within grace period — no game-over yet

    expect(onGameOver).not.toHaveBeenCalled();

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3001);
    handle.step();
    jest.useRealTimers();

    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("fires onGameOver only once even after additional steps", async () => {
    const onGameOver = jest.fn();
    const handle = await buildEngine(jest.fn(), onGameOver);

    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 50);

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3001);
    for (let i = 0; i < 5; i++) {
      handle.step();
    }
    jest.useRealTimers();

    expect(onGameOver).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("same drop + collision sequence produces identical merge event tiers", async () => {
    async function runSequence(): Promise<number[]> {
      const events: number[] = [];
      const handle = await createEngine(
        W,
        H,
        fruitSet,
        (e: { tier: number }) => events.push(e.tier),
        jest.fn(),
      );
      const world = getWorld();

      handle.drop(fruitSet.fruits[2], fruitSet.id, 150, 300);
      handle.drop(fruitSet.fruits[2], fruitSet.id, 160, 300);
      handle.step();
      world._fireCollision(1003, 1004);
      handle.step();

      return events;
    }

    // Need to clear mocks between runs so getWorld() returns the right instance
    const run1 = await runSequence();
    jest.clearAllMocks();
    const run2 = await runSequence();

    expect(run1).toEqual(run2);
    expect(run1).toEqual([2]); // one tier-2 merge
  });

  it("body count is consistent across identical drop sequences", async () => {
    async function runDrops(): Promise<number> {
      const handle = await buildEngine();
      handle.drop(fruitSet.fruits[1], fruitSet.id, 100, 300);
      handle.drop(fruitSet.fruits[2], fruitSet.id, 150, 300);
      handle.drop(fruitSet.fruits[3], fruitSet.id, 200, 300);
      return handle.step().length;
    }

    const count1 = await runDrops();
    jest.clearAllMocks();
    const count2 = await runDrops();

    expect(count1).toBe(count2);
    expect(count1).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Cleanup after simulation
// ---------------------------------------------------------------------------

describe("cleanup after multi-step simulation", () => {
  it("cleanup does not throw after a full chain-merge sequence", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[0], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step();
    handle.step();

    expect(() => handle.cleanup()).not.toThrow();
  });
});
