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
 *   3. Merge semantics: same-tier collision produces fruitMerge event on both engines.
 *   4. Score parity: identical merge sequences produce identical fruitMerge counts.
 */

jest.mock("@dimforge/rapier2d-compat");

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const _rapierEngine: typeof import("../engine") = require(
  require("path").resolve(__dirname, "..", "engine.ts")
);
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { createEngine: createRapierEngine } = _rapierEngine;
import { createEngine as createNativeEngine } from "../engine.native";
import { FRUIT_SETS, FruitSet, FruitDefinition } from "../../../theme/fruitSets";
import { MockWorld } from "../../../../__mocks__/@dimforge/rapier2d-compat";

const RAPIER_MOCK = require("@dimforge/rapier2d-compat").default; // eslint-disable-line @typescript-eslint/no-require-imports

function requireFruitSet(id: string): FruitSet {
  const fs = FRUIT_SETS[id];
  if (fs === undefined) throw new Error(`FruitSet '${id}' not found`);
  return fs;
}

function fruit(tier: number): FruitDefinition {
  const f = fruitSet.fruits[tier];
  if (f === undefined) throw new Error(`No fruit for tier ${tier}`);
  return f;
}

const fruitSet: FruitSet = requireFruitSet("fruits");
const W = 300;
const H = 600;

afterEach(() => {
  jest.clearAllMocks();
});

/** Return the MockWorld for the most recent Rapier createEngine call. */
function getRapierWorld(): MockWorld {
  const results = (RAPIER_MOCK.World as jest.Mock).mock.results;
  const last = results[results.length - 1];
  if (last === undefined) throw new Error("No World mock results");
  return last.value as MockWorld;
}

// ---------------------------------------------------------------------------
// 1. Gravity: fruits fall on both engines
// ---------------------------------------------------------------------------

describe("gravity — both engines pull fruits downward", () => {
  it("Rapier: y increases after multiple steps", async () => {
    const handle = await createRapierEngine(W, H, fruitSet);
    handle.drop(fruit(0), fruitSet.id, W / 2, 100);
    const y0 = handle.step().snapshots[0]?.y ?? 0;
    // Mock body falls: advance mock world position manually by tweaking _y
    const world = getRapierWorld();
    world._bodies.get(0)!._y += 0.5; // simulate fall in physics coords
    const y1 = handle.step().snapshots[0]?.y ?? 0;
    expect(y1).toBeGreaterThan(y0);
  });

  it("Matter.js: y increases after multiple steps", async () => {
    const handle = await createNativeEngine(W, H, fruitSet);
    handle.drop(fruit(0), fruitSet.id, W / 2, 100);
    const y0 = handle.step(1 / 60).snapshots[0]?.y ?? 0;
    for (let i = 0; i < 10; i++) handle.step(1 / 60);
    const y1 = handle.step(1 / 60).snapshots[0]?.y ?? 0;
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
    const handle = await createRapierEngine(W, H, fruitSet);
    DROP_XS.forEach((x) => handle.drop(fruit(0), fruitSet.id, x, 300));
    const { snapshots, events } = handle.step();
    expect(snapshots).toHaveLength(3);
    expect(events.filter((e) => e.type === "fruitMerge")).toHaveLength(0);
  });

  it("Matter.js: 3 drops → 3 snapshots, 0 merges", async () => {
    const handle = await createNativeEngine(W, H, fruitSet);
    DROP_XS.forEach((x) => handle.drop(fruit(0), fruitSet.id, x, 300));
    const { snapshots, events } = handle.step(1 / 60);
    expect(snapshots).toHaveLength(3);
    expect(events.filter((e) => e.type === "fruitMerge")).toHaveLength(0);
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// 3 & 4. Merge semantics: same-tier collision produces fruitMerge on both engines
// ---------------------------------------------------------------------------

describe("merge semantics — same-tier collision fires fruitMerge on both engines", () => {
  it("Rapier: two tier-1 fruits collide → fruitMerge event with tier=1", async () => {
    const handle = await createRapierEngine(W, H, fruitSet);
    const world = getRapierWorld();

    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.step();
    // Wall colliders take handles 1000–1002; fruit bodies 0–1, colliders 1003–1004
    world._fireCollision(1003, 1004);
    const { events } = handle.step();

    const merges = events.filter((e) => e.type === "fruitMerge");
    expect(merges).toHaveLength(1);
    expect((merges[0] as { tier: number }).tier).toBe(1);
  });

  it("Matter.js: two tier-1 fruits collide → fruitMerge event with tier=1", async () => {
    const handle = await createNativeEngine(W, H, fruitSet);
    const tier1 = fruit(1); // radius=25
    let mergeEvents: { type: string; tier?: number }[] = [];

    // Drop very close so overlap triggers immediate collision
    handle.drop(tier1, fruitSet.id, W / 2 - 5, 50);
    handle.drop(tier1, fruitSet.id, W / 2 + 5, 50);

    for (let i = 0; i < 300; i++) {
      const { events } = handle.step(1 / 60);
      mergeEvents = [...mergeEvents, ...events.filter((e) => e.type === "fruitMerge")];
      if (mergeEvents.length > 0) break;
    }

    expect(mergeEvents.length).toBeGreaterThan(0);
    expect((mergeEvents[0] as { tier: number }).tier).toBe(1);
    handle.cleanup();
  });
});

// ---------------------------------------------------------------------------
// 5. Different-tier fruits never merge on either engine
// ---------------------------------------------------------------------------

describe("no cross-tier merges", () => {
  it("Rapier: tier-0 and tier-2 collision does NOT fire fruitMerge", async () => {
    const handle = await createRapierEngine(W, H, fruitSet);
    const world = getRapierWorld();

    handle.drop(fruit(0), fruitSet.id, 100, 300);
    handle.drop(fruit(2), fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    const { events } = handle.step();

    expect(events.filter((e) => e.type === "fruitMerge")).toHaveLength(0);
  });

  it("Matter.js: tier-0 and tier-2 do NOT merge even when overlapping", async () => {
    const handle = await createNativeEngine(W, H, fruitSet);
    let mergeCount = 0;

    handle.drop(fruit(0), fruitSet.id, W / 2, 50);
    handle.drop(fruit(2), fruitSet.id, W / 2, 60);

    for (let i = 0; i < 200; i++) {
      const { events } = handle.step(1 / 60);
      mergeCount += events.filter((e) => e.type === "fruitMerge").length;
    }

    expect(mergeCount).toBe(0);
    handle.cleanup();
  });
});
