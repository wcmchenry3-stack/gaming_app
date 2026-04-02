/**
 * engine.native.test.ts — matter.js native engine tests
 *
 * Uses the real matter.js library (pure JS, no mocks needed).
 * Explicitly imports engine.native.ts to bypass Jest's default resolution.
 */
import { createEngine } from "../engine.native";
import type { EngineHandle } from "../engine.shared";
import { FRUIT_SETS } from "../../../theme/fruitSets";

const fruitSet = FRUIT_SETS["fruits"];
const W = 300;
const H = 600;

async function buildEngine(
  onMerge = jest.fn(),
  onGameOver = jest.fn()
): Promise<EngineHandle & { _onMerge: jest.Mock; _onGameOver: jest.Mock }> {
  const handle = await createEngine(W, H, fruitSet, onMerge, onGameOver);
  return Object.assign(handle, { _onMerge: onMerge, _onGameOver: onGameOver });
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// createEngine basics
// ---------------------------------------------------------------------------

describe("createEngine", () => {
  it("resolves to an EngineHandle with step, drop, and cleanup", async () => {
    const handle = await buildEngine();
    expect(typeof handle.step).toBe("function");
    expect(typeof handle.drop).toBe("function");
    expect(typeof handle.cleanup).toBe("function");
    handle.cleanup();
  });

  it("step returns empty array when no fruits exist", async () => {
    const handle = await buildEngine();
    const snapshots = handle.step(1 / 60);
    expect(snapshots).toEqual([]);
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// drop + step
// ---------------------------------------------------------------------------

describe("drop and step", () => {
  it("returns a snapshot with correct tier after dropping a fruit", async () => {
    const handle = await buildEngine();
    const tier0 = fruitSet.fruits[0];
    handle.drop(tier0, "fruits", W / 2, 30);
    const snapshots = handle.step(1 / 60);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].tier).toBe(0);
    expect(typeof snapshots[0].x).toBe("number");
    expect(typeof snapshots[0].y).toBe("number");
    expect(typeof snapshots[0].angle).toBe("number");
    handle.cleanup();
  });

  it("fruits fall under gravity (y increases over time)", async () => {
    const handle = await buildEngine();
    const tier0 = fruitSet.fruits[0];
    handle.drop(tier0, "fruits", W / 2, 50);
    handle.step(1 / 60);
    const y1 = handle.step(1 / 60)[0].y;
    // Step many more frames
    for (let i = 0; i < 10; i++) handle.step(1 / 60);
    const y2 = handle.step(1 / 60)[0].y;
    expect(y2).toBeGreaterThan(y1);
    handle.cleanup();
  });

  it("multiple drops produce multiple snapshots", async () => {
    const handle = await buildEngine();
    handle.drop(fruitSet.fruits[0], "fruits", W / 4, 30);
    handle.drop(fruitSet.fruits[1], "fruits", (3 * W) / 4, 30);
    const snapshots = handle.step(1 / 60);
    expect(snapshots).toHaveLength(2);
    const tiers = snapshots.map((s) => s.tier).sort();
    expect(tiers).toEqual([0, 1]);
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// Merge detection
// ---------------------------------------------------------------------------

describe("merge detection", () => {
  it("same-tier fruits merge when they collide", async () => {
    const onMerge = jest.fn();
    const handle = await buildEngine(onMerge);
    const tier0 = fruitSet.fruits[0];

    // Drop two same-tier fruits close together so they collide when falling
    handle.drop(tier0, "fruits", W / 2 - 5, 30);
    handle.drop(tier0, "fruits", W / 2 + 5, 30);

    // Run enough steps for them to fall and collide
    for (let i = 0; i < 300; i++) {
      handle.step(1 / 60);
      if (onMerge.mock.calls.length > 0) break;
    }

    expect(onMerge).toHaveBeenCalled();
    expect(onMerge.mock.calls[0][0].tier).toBe(0);
    handle.cleanup();
  });

  it("merge spawns tier+1 fruit", async () => {
    const onMerge = jest.fn();
    const handle = await buildEngine(onMerge);
    const tier0 = fruitSet.fruits[0];

    // Drop two tier-0 fruits on top of each other
    handle.drop(tier0, "fruits", W / 2, 30);
    handle.drop(tier0, "fruits", W / 2, 50);

    // Step until merge fires
    for (let i = 0; i < 300; i++) {
      handle.step(1 / 60);
      if (onMerge.mock.calls.length > 0) break;
    }

    if (onMerge.mock.calls.length > 0) {
      // After merge, step once more and check for tier-1 body
      const snapshots = handle.step(1 / 60);
      const tier1Bodies = snapshots.filter((s) => s.tier === 1);
      expect(tier1Bodies.length).toBeGreaterThanOrEqual(1);
    }
    handle.cleanup();
  });

  it("different-tier fruits do NOT merge", async () => {
    const onMerge = jest.fn();
    const handle = await buildEngine(onMerge);

    // Drop tier 0 and tier 1 close together
    handle.drop(fruitSet.fruits[0], "fruits", W / 2, 30);
    handle.drop(fruitSet.fruits[1], "fruits", W / 2, 60);

    for (let i = 0; i < 200; i++) {
      handle.step(1 / 60);
    }

    // onMerge should not have been called for a tier mismatch
    expect(onMerge).not.toHaveBeenCalled();
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

describe("game over", () => {
  it("fires when a settled fruit is above the danger line", async () => {
    const onGameOver = jest.fn();
    // Mock Date.now so the fruit is immediately past the grace period
    const fakeNow = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(fakeNow);

    const handle = await buildEngine(jest.fn(), onGameOver);

    // Drop a fruit above the danger line (dangerY = H * 0.18 = 108px)
    // The fruit's top edge (y - radius) must be < 108
    const tier0 = fruitSet.fruits[0];
    handle.drop(tier0, "fruits", W / 2, 50);

    // Step once so the fruit exists in the world
    handle.step(1 / 60);

    // Advance time past the grace period (3000ms)
    (Date.now as jest.Mock).mockReturnValue(fakeNow + 5000);

    // Step again — game over should fire since the fruit is above the danger line
    // The fruit has only fallen for ~1 frame so it's still near y=50
    handle.step(1 / 60);

    expect(onGameOver).toHaveBeenCalled();
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// cleanup
// ---------------------------------------------------------------------------

describe("cleanup", () => {
  it("does not throw", async () => {
    const handle = await buildEngine();
    handle.drop(fruitSet.fruits[0], "fruits", W / 2, 30);
    handle.step(1 / 60);
    expect(() => handle.cleanup()).not.toThrow();
  });
});
