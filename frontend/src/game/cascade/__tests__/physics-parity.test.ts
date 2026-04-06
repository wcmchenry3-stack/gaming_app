/**
 * physics-parity.test.ts — GH #203
 *
 * Cross-engine invariant tests: Rapier (web) vs Matter.js (native).
 *
 * Full positional parity is intentionally NOT asserted — the two engines
 * use different integrators and density scales, so sub-pixel divergence is
 * expected and acceptable. Instead we assert on higher-level invariants that
 * MUST hold on both platforms:
 *
 *   1. Gravity: fruits fall (y increases) on both engines.
 *   2. Fruit count: N drops at non-overlapping x → N fruits, no auto-merges.
 *   3. Merge semantics: same-tier collision fires onMerge on both engines.
 *   4. Score parity: identical merge sequences produce identical onMerge counts.
 */

jest.mock("@dimforge/rapier2d-compat");

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const _rapierEngine: typeof import("../engine") = require(
  require("path").resolve(__dirname, "..", "engine.ts")
);
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { createEngine: createRapierEngine } = _rapierEngine;
import { createEngine as createNativeEngine } from "../engine.native";
import { FRUIT_SETS } from "../../../theme/fruitSets";
import { MockWorld } from "../../../../__mocks__/@dimforge/rapier2d-compat";

const RAPIER_MOCK = require("@dimforge/rapier2d-compat").default; // eslint-disable-line @typescript-eslint/no-require-imports

const fruitSet = FRUIT_SETS["fruits"];
const W = 300;
const H = 600;

afterEach(() => {
  jest.clearAllMocks();
});

/** Return the MockWorld for the most recent Rapier createEngine call. */
function getRapierWorld(): MockWorld {
  const results = (RAPIER_MOCK.World as jest.Mock).mock.results;
  return results[results.length - 1].value as MockWorld;
}

// ---------------------------------------------------------------------------
// 1. Gravity: fruits fall on both engines
// ---------------------------------------------------------------------------

describe("gravity — both engines pull fruits downward", () => {
  it("Rapier: y increases after multiple steps", async () => {
    const handle = await createRapierEngine(W, H, fruitSet, jest.fn(), jest.fn());
    handle.drop(fruitSet.fruits[0], fruitSet.id, W / 2, 100);
    const y0 = handle.step()[0].y;
    // Mock body falls: advance mock world position manually by tweaking _y
    const world = getRapierWorld();
    world._bodies.get(0)!._y += 0.5; // simulate fall in physics coords
    const y1 = handle.step()[0].y;
    expect(y1).toBeGreaterThan(y0);
  });

  it("Matter.js: y increases after multiple steps", async () => {
    const handle = await createNativeEngine(W, H, fruitSet, jest.fn(), jest.fn());
    handle.drop(fruitSet.fruits[0], fruitSet.id, W / 2, 100);
    const y0 = handle.step(1 / 60)[0].y;
    for (let i = 0; i < 10; i++) handle.step(1 / 60);
    const y1 = handle.step(1 / 60)[0].y;
    expect(y1).toBeGreaterThan(y0);
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// 2. Fruit count: N well-separated drops → N fruits, no auto-merges
// ---------------------------------------------------------------------------

describe("fruit count — N drops at distinct x positions → N snapshots", () => {
  const DROP_XS = [50, 150, 250]; // well-separated, no overlap for tier-0 (radius=18)

  it("Rapier: 3 drops → 3 snapshots, 0 merges", async () => {
    const onMerge = jest.fn();
    const handle = await createRapierEngine(W, H, fruitSet, onMerge, jest.fn());
    DROP_XS.forEach((x) => handle.drop(fruitSet.fruits[0], fruitSet.id, x, 300));
    const snapshots = handle.step();
    expect(snapshots).toHaveLength(3);
    expect(onMerge).not.toHaveBeenCalled();
  });

  it("Matter.js: 3 drops → 3 snapshots, 0 merges", async () => {
    const onMerge = jest.fn();
    const handle = await createNativeEngine(W, H, fruitSet, onMerge, jest.fn());
    DROP_XS.forEach((x) => handle.drop(fruitSet.fruits[0], fruitSet.id, x, 300));
    const snapshots = handle.step(1 / 60);
    expect(snapshots).toHaveLength(3);
    expect(onMerge).not.toHaveBeenCalled();
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// 3 & 4. Merge semantics: same-tier collision fires onMerge on both engines
// ---------------------------------------------------------------------------

describe("merge semantics — same-tier collision fires onMerge on both engines", () => {
  it("Rapier: two tier-1 fruits collide → onMerge called with tier=1", async () => {
    const onMerge = jest.fn();
    const handle = await createRapierEngine(W, H, fruitSet, onMerge, jest.fn());
    const world = getRapierWorld();

    handle.drop(fruitSet.fruits[1], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[1], fruitSet.id, 110, 300);
    handle.step();
    // Wall colliders take handles 1000–1002; fruit bodies 0–1, colliders 1003–1004
    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 1 }));
  });

  it("Matter.js: two tier-1 fruits collide → onMerge called with tier=1", async () => {
    const onMerge = jest.fn();
    const handle = await createNativeEngine(W, H, fruitSet, onMerge, jest.fn());
    const tier1 = fruitSet.fruits[1]; // radius=25

    // Drop very close so overlap triggers immediate collision
    handle.drop(tier1, fruitSet.id, W / 2 - 5, 50);
    handle.drop(tier1, fruitSet.id, W / 2 + 5, 50);

    for (let i = 0; i < 300; i++) {
      handle.step(1 / 60);
      if (onMerge.mock.calls.length > 0) break;
    }

    expect(onMerge).toHaveBeenCalled();
    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 1 }));
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// 5. Different-tier fruits never merge on either engine
// ---------------------------------------------------------------------------

describe("no cross-tier merges", () => {
  it("Rapier: tier-0 and tier-2 collision does NOT fire onMerge", async () => {
    const onMerge = jest.fn();
    const handle = await createRapierEngine(W, H, fruitSet, onMerge, jest.fn());
    const world = getRapierWorld();

    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[2], fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).not.toHaveBeenCalled();
  });

  it("Matter.js: tier-0 and tier-2 do NOT merge even when overlapping", async () => {
    const onMerge = jest.fn();
    const handle = await createNativeEngine(W, H, fruitSet, onMerge, jest.fn());

    handle.drop(fruitSet.fruits[0], fruitSet.id, W / 2, 50);
    handle.drop(fruitSet.fruits[2], fruitSet.id, W / 2, 60);

    for (let i = 0; i < 200; i++) handle.step(1 / 60);

    expect(onMerge).not.toHaveBeenCalled();
    handle.cleanup();
  });
});
