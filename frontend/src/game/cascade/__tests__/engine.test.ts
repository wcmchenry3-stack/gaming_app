/**
 * engine.test.ts — Rapier2D engine unit tests
 *
 * Uses the manual mock at frontend/__mocks__/@dimforge/rapier2d-compat.ts
 * so that tests run in Node.js without any WASM binary.
 *
 * jest-expo defaults to iOS/native platform, so haste resolves "../engine" to
 * engine.native.ts (matter.js).  We explicitly load engine.ts (Rapier/web) via
 * an absolute path to bypass haste platform resolution.
 */
jest.mock("@dimforge/rapier2d-compat");

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const _engine: typeof import("../engine") = require(
  require("path").resolve(__dirname, "..", "engine.ts")
);
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { createEngine } = _engine;
import type { EngineHandle, BodySnapshot } from "../engine.shared";
import { DANGER_LINE_RATIO, WALL_THICKNESS } from "../engine.shared";
import { FRUIT_SETS, FruitSet, FruitDefinition } from "../../../theme/fruitSets";
import { MockWorld } from "../../../../__mocks__/@dimforge/rapier2d-compat";

// Access the live mock module so tests can inspect call counts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RAPIER_MOCK = require("@dimforge/rapier2d-compat").default;

function requireFruitSet(id: string): FruitSet {
  const fs = FRUIT_SETS[id];
  if (fs === undefined) throw new Error(`FruitSet '${id}' not found`);
  return fs;
}
const fruitSet: FruitSet = requireFruitSet("fruits");

function fruit(tier: number): FruitDefinition {
  const f = fruitSet.fruits[tier];
  if (f === undefined) throw new Error(`No fruit for tier ${tier}`);
  return f;
}
const W = 300;
const H = 600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the MockWorld instance created by the most recent createEngine call. */
function getWorld(): MockWorld {
  const results = (RAPIER_MOCK.World as jest.Mock).mock.results;
  const last = results[results.length - 1];
  if (last === undefined) throw new Error("No World mock results");
  return last.value as MockWorld;
}

async function buildEngine(): Promise<EngineHandle> {
  return createEngine(W, H, fruitSet);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  jest.clearAllMocks();
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
  });

  it("creates 3 static wall/floor colliders via cuboid", async () => {
    await buildEngine();
    expect(RAPIER_MOCK.ColliderDesc.cuboid).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// step() — basic
// ---------------------------------------------------------------------------

describe("step", () => {
  it("returns empty snapshots when no fruits have been dropped", async () => {
    const handle = await buildEngine();
    expect(handle.step().snapshots).toEqual([]);
  });

  it("returns a snapshot for each dropped fruit", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(0), fruitSet.id, 150, 100);
    handle.drop(fruit(1), fruitSet.id, 160, 100);
    expect(handle.step().snapshots).toHaveLength(2);
  });

  it("snapshot positions are close to drop coordinates (pixels)", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(2), fruitSet.id, 150, 100);
    const snap = handle.step().snapshots[0];
    if (snap === undefined) throw new Error("Expected snapshot");
    expect(snap.x).toBeCloseTo(150, 0);
    expect(snap.y).toBeCloseTo(100, 0);
  });

  it("snapshot has id, tier, and angle fields", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(3), fruitSet.id, 150, 200);
    const snap = (handle.step().snapshots as BodySnapshot[])[0];
    if (snap === undefined) throw new Error("Expected snapshot");
    expect(snap).toHaveProperty("id");
    expect(snap.tier).toBe(3);
    expect(typeof snap.angle).toBe("number");
  });

  it("returns an events array alongside snapshots", async () => {
    const handle = await buildEngine();
    const result = handle.step();
    expect(result).toHaveProperty("snapshots");
    expect(result).toHaveProperty("events");
    expect(Array.isArray(result.events)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// drop()
// ---------------------------------------------------------------------------

describe("drop", () => {
  it("spawns a fruit visible in the next step", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(1), fruitSet.id, 150, 100);
    const { snapshots } = handle.step();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.tier).toBe(1);
  });

  it("uses ball collider for sets without vertex data", async () => {
    // Synthetic set with no vertex JSON — simulates a set that has no PNG assets
    const noVertexSet = {
      id: "test_no_verts",
      label: "Test",
      fruits: fruitSet.fruits.map((f) => ({ ...f, icon: undefined })),
    };
    const handle = await createEngine(W, H, noVertexSet);
    const noVertexFruit0 = noVertexSet.fruits[0];
    if (noVertexFruit0 === undefined) throw new Error("Expected fruit");
    handle.drop(noVertexFruit0, "test_no_verts", 150, 100);
    expect(RAPIER_MOCK.ColliderDesc.ball).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Merge detection (events)
// ---------------------------------------------------------------------------

describe("merge detection", () => {
  it("emits fruitMerge event when two same-tier fruits collide", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.step(); // register bodies; world assigns collider handles 1003 & 1004

    // Wall colliders get 1000–1002; fruit colliders get 1003–1004
    world._fireCollision(1003, 1004);
    const { events } = handle.step();

    const mergeEvts = events.filter((e) => e.type === "fruitMerge");
    expect(mergeEvts).toHaveLength(1);
    expect(mergeEvts[0]).toMatchObject({ type: "fruitMerge", tier: 1 });
  });

  it("does NOT emit fruitMerge for different-tier fruits", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(0), fruitSet.id, 100, 300);
    handle.drop(fruit(2), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    const { events } = handle.step();

    expect(events.filter((e) => e.type === "fruitMerge")).toHaveLength(0);
  });

  it("merges only once even if the same pair fires twice", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(2), fruitSet.id, 100, 300);
    handle.drop(fruit(2), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    world._fireCollision(1003, 1004); // duplicate
    const { events } = handle.step();

    expect(events.filter((e) => e.type === "fruitMerge")).toHaveLength(1);
  });

  it("spawns a tier+1 fruit after merge when tier < 10", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(3), fruitSet.id, 100, 300);
    handle.drop(fruit(3), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    const step2 = handle.step();
    expect(
      step2.events.some((e) => e.type === "fruitMerge" && (e as { tier: number }).tier === 3)
    ).toBe(true);
    const tiers = handle.step().snapshots.map((s) => s.tier);
    expect(tiers).toContain(4);
  });

  it("does NOT spawn a new fruit when merging tier 10 (watermelon disappears)", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(10), fruitSet.id, 100, 300);
    handle.drop(fruit(10), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    const step2 = handle.step();
    expect(
      step2.events.some((e) => e.type === "fruitMerge" && (e as { tier: number }).tier === 10)
    ).toBe(true);
    expect(handle.step().snapshots).toHaveLength(0);
  });

  it("fruitMerge event carries x and y position of the merge midpoint", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    const { events } = handle.step();

    const merge = events.find((e) => e.type === "fruitMerge");
    expect(merge).toBeDefined();
    expect(typeof (merge as { x: number }).x).toBe("number");
    expect(typeof (merge as { y: number }).y).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Game-over detection (events)
// ---------------------------------------------------------------------------

describe("game-over detection", () => {
  // dangerY = H * DANGER_LINE_RATIO = 108px; used as reference in test comments below

  it("emits gameOver when a settled fruit is above the danger line", async () => {
    const handle = await buildEngine();

    // tier-0 radius = 18. Top = y - 18. For top < dangerY (108): y < 126.
    // Spawn at y=50 (top = 32, well above the danger line).
    handle.drop(fruit(0), fruitSet.id, 150, 50);
    handle.step(); // freshly created — within grace period, no game over yet

    expect(handle.step().events.some((e) => e.type === "gameOver")).toBe(false);

    // Advance time past the 3-second grace period
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3000);
    const { events } = handle.step();
    jest.useRealTimers();

    expect(events.some((e) => e.type === "gameOver")).toBe(true);
  });

  it("does NOT emit gameOver during the grace period", async () => {
    const handle = await buildEngine();

    handle.drop(fruit(0), fruitSet.id, 150, 50);
    const { events } = handle.step(); // within 3s grace period

    expect(events.some((e) => e.type === "gameOver")).toBe(false);
  });

  it("does NOT emit gameOver when fruit is safely below the danger line", async () => {
    const handle = await buildEngine();

    // tier-0 radius=18, y=300 → top = 282 > dangerY (108) → safe
    handle.drop(fruit(0), fruitSet.id, 150, 300);

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3000);
    const { events } = handle.step();
    jest.useRealTimers();

    expect(events.some((e) => e.type === "gameOver")).toBe(false);
  });

  it("emits gameOver only once across multiple steps", async () => {
    const handle = await buildEngine();

    handle.drop(fruit(0), fruitSet.id, 150, 50);

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3000);
    const step1 = handle.step();
    const step2 = handle.step(); // second step should not re-fire
    jest.useRealTimers();

    const totalGameOverEvents =
      step1.events.filter((e) => e.type === "gameOver").length +
      step2.events.filter((e) => e.type === "gameOver").length;
    expect(totalGameOverEvents).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Boundary escape
// ---------------------------------------------------------------------------

describe("boundary escape", () => {
  // tier-0 radius = 18px, margin = 2 * 18 = 36px
  // SCALE = 0.01: physics coord = pixel * 0.01
  const RADIUS = fruit(0).radius; // 18
  const MARGIN = RADIUS * 2; // 36

  it("removes body when fruit escapes below floor", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(0), fruitSet.id, 150, 300);
    handle.step(); // register body (handle 0)
    const world = getWorld();
    const body = world._bodies.get(0)!;
    // Place below floor: py > H + margin
    body._y = (H + MARGIN + 10) * 0.01;
    handle.step();
    // Body removed from world
    expect(world._bodies.has(0)).toBe(false);
  });

  it("removes body when fruit escapes through left wall", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(0), fruitSet.id, 150, 300);
    handle.step();
    const world = getWorld();
    const body = world._bodies.get(0)!;
    // Place left of left wall: px < -margin
    body._x = (-MARGIN - 10) * 0.01;
    handle.step();
    expect(world._bodies.has(0)).toBe(false);
  });

  it("removes body when fruit escapes through right wall", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(0), fruitSet.id, 150, 300);
    handle.step();
    const world = getWorld();
    const body = world._bodies.get(0)!;
    // Place right of right wall: px > W + margin
    body._x = (W + MARGIN + 10) * 0.01;
    handle.step();
    expect(world._bodies.has(0)).toBe(false);
  });

  it("does NOT remove fruit inside the escape margin", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(0), fruitSet.id, 150, 300);
    handle.step();
    const world = getWorld();
    const body = world._bodies.get(0)!;
    // Place just inside the right margin: px = W + radius (< W + 2*radius)
    body._x = (W + RADIUS) * 0.01;
    handle.step();
    expect(world._bodies.has(0)).toBe(true);
  });

  it("escape does not trigger gameOver event", async () => {
    const handle = await buildEngine();
    handle.drop(fruit(0), fruitSet.id, 150, 300);
    handle.step();
    const world = getWorld();
    world._bodies.get(0)!._y = (H + MARGIN + 10) * 0.01;
    const { events } = handle.step();
    expect(world._bodies.has(0)).toBe(false);
    expect(events.some((e) => e.type === "gameOver")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cascade combo
// ---------------------------------------------------------------------------

describe("cascadeCombo event", () => {
  it("does not emit cascadeCombo for 1 merge", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(0), fruitSet.id, 100, 300);
    handle.drop(fruit(0), fruitSet.id, 110, 300);
    handle.step();
    world._fireCollision(1003, 1004);
    const { events } = handle.step();

    expect(events.some((e) => e.type === "cascadeCombo")).toBe(false);
  });

  it("does not emit cascadeCombo for 2 consecutive merges", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(0), fruitSet.id, 50, 300);
    handle.drop(fruit(0), fruitSet.id, 60, 300);
    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    const step1 = handle.step();
    expect(step1.events.some((e) => e.type === "cascadeCombo")).toBe(false);

    world._fireCollision(1005, 1006);
    const step2 = handle.step();
    expect(step2.events.some((e) => e.type === "cascadeCombo")).toBe(false);
  });

  it("emits cascadeCombo on the 3rd consecutive merge step", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(0), fruitSet.id, 50, 300);
    handle.drop(fruit(0), fruitSet.id, 60, 300);
    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.drop(fruit(2), fruitSet.id, 150, 300);
    handle.drop(fruit(2), fruitSet.id, 160, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step(); // merge 1

    world._fireCollision(1005, 1006);
    handle.step(); // merge 2

    world._fireCollision(1007, 1008);
    const step3 = handle.step(); // merge 3 — combo fires
    expect(step3.events.some((e) => e.type === "cascadeCombo")).toBe(true);
  });

  it("cascadeCombo carries a count ≥ 3", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(0), fruitSet.id, 50, 300);
    handle.drop(fruit(0), fruitSet.id, 60, 300);
    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.drop(fruit(2), fruitSet.id, 150, 300);
    handle.drop(fruit(2), fruitSet.id, 160, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step();
    world._fireCollision(1005, 1006);
    handle.step();
    world._fireCollision(1007, 1008);
    const step3 = handle.step();

    const combo = step3.events.find((e) => e.type === "cascadeCombo");
    expect(combo).toBeDefined();
    expect((combo as { count: number }).count).toBeGreaterThanOrEqual(3);
  });

  it("emits cascadeCombo only once per chain", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(0), fruitSet.id, 50, 300);
    handle.drop(fruit(0), fruitSet.id, 60, 300);
    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.drop(fruit(2), fruitSet.id, 150, 300);
    handle.drop(fruit(2), fruitSet.id, 160, 300);
    handle.drop(fruit(3), fruitSet.id, 200, 300);
    handle.drop(fruit(3), fruitSet.id, 210, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step(); // merge 1
    world._fireCollision(1005, 1006);
    handle.step(); // merge 2
    world._fireCollision(1007, 1008);
    const step3 = handle.step(); // merge 3 — combo fires
    world._fireCollision(1009, 1010);
    const step4 = handle.step(); // merge 4 — combo already fired, no re-emit

    expect(step3.events.filter((e) => e.type === "cascadeCombo")).toHaveLength(1);
    expect(step4.events.filter((e) => e.type === "cascadeCombo")).toHaveLength(0);
  });

  it("resets combo chain after a step with no merges", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(0), fruitSet.id, 50, 300);
    handle.drop(fruit(0), fruitSet.id, 60, 300);
    handle.drop(fruit(1), fruitSet.id, 100, 300);
    handle.drop(fruit(1), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step(); // merge 1 in chain

    handle.step(); // step with no merges — chain resets

    world._fireCollision(1005, 1006);
    const afterReset = handle.step(); // first merge of a new chain
    expect(afterReset.events.some((e) => e.type === "cascadeCombo")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cleanup
// ---------------------------------------------------------------------------

describe("cleanup", () => {
  it("frees the world without throwing", async () => {
    const handle = await buildEngine();
    expect(() => handle.cleanup()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tier-snapshot guard (handle-reuse protection)
// ---------------------------------------------------------------------------

describe("tier-snapshot guard", () => {
  /**
   * Simulate Rapier's generational-arena handle recycling:
   *
   *  1. Drop three tier-2 fruits (bodies 0, 1, 2; colliders 1003–1005).
   *  2. Fire two collisions: [1003,1004] (body 0+1) and [1003,1005] (body 0+2).
   *     Both pairs are same-tier at drain time, so both are enqueued as
   *     [0,1,tier=2] and [0,2,tier=2].
   *  3. Force the next body handle to 0 so the tier-3 fruit spawned from the
   *     first merge reuses body handle 0.
   *  4. processMerges processes [0,1,2]: merges correctly → fruitMerge fires once.
   *     fruitMap[0] now points to the newly spawned tier-3 body.
   *  5. processMerges processes [0,2,2]: fruitMap[0].fruitTier(3) !== enqueuedTier(2)
   *     → guard fires, merge skipped → fruitMerge is NOT emitted a second time.
   */
  it("skips a merge pair when the body tier no longer matches the enqueued tier", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    // bodies 0, 1, 2 are tier-2; colliders 1003, 1004, 1005
    handle.drop(fruit(2), fruitSet.id, 100, 300);
    handle.drop(fruit(2), fruitSet.id, 110, 300);
    handle.drop(fruit(2), fruitSet.id, 120, 300);
    handle.step();

    // Two collision events sharing body 0 — both look same-tier at drain time.
    world._fireCollision(1003, 1004); // [body0, body1] → enqueued [0,1,tier=2]
    world._fireCollision(1003, 1005); // [body0, body2] → enqueued [0,2,tier=2]

    // Force the tier-3 fruit spawned by the first merge to reuse handle 0.
    // This simulates Rapier's arena recycling the freed slot immediately.
    world._forceNextHandle(0);

    const { events } = handle.step(); // drain + processMerges

    // First pair [0,1,2] merges cleanly: fruitMerge fires once for tier 2.
    // Second pair [0,2,2]: fruitMap[0] is now tier 3 (recycled body) —
    // the snapshot guard rejects it, so no second merge fires.
    const mergeEvts = events.filter((e) => e.type === "fruitMerge");
    expect(mergeEvts).toHaveLength(1);
    expect((mergeEvts[0] as { tier: number }).tier).toBe(2);
  });

  it("still merges normally when no handle reuse occurs", async () => {
    const handle = await buildEngine();
    const world = getWorld();

    handle.drop(fruit(3), fruitSet.id, 100, 300);
    handle.drop(fruit(3), fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    const { events } = handle.step();

    const mergeEvts = events.filter((e) => e.type === "fruitMerge");
    expect(mergeEvts).toHaveLength(1);
    expect((mergeEvts[0] as { tier: number }).tier).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// CCD (Continuous Collision Detection)
// ---------------------------------------------------------------------------

describe("CCD enablement", () => {
  it("calls setCcdEnabled(true) on every spawned fruit body", async () => {
    const setCcdSpy = jest.fn().mockImplementation(function (this: unknown) {
      return this;
    });
    const origDynamic = RAPIER_MOCK.RigidBodyDesc.dynamic;
    RAPIER_MOCK.RigidBodyDesc.dynamic = () => {
      const builder = origDynamic();
      builder.setCcdEnabled = setCcdSpy;
      return builder;
    };

    try {
      const handle = await buildEngine();
      handle.drop(fruit(1), fruitSet.id, 150, 300);
      handle.drop(fruit(2), fruitSet.id, 160, 300);
      handle.step();
      expect(setCcdSpy).toHaveBeenCalledTimes(2);
      expect(setCcdSpy).toHaveBeenCalledWith(true);
    } finally {
      RAPIER_MOCK.RigidBodyDesc.dynamic = origDynamic;
    }
  });

  it("calls setCcdEnabled(true) on the body spawned by a merge", async () => {
    const setCcdSpy = jest.fn().mockImplementation(function (this: unknown) {
      return this;
    });
    const origDynamic = RAPIER_MOCK.RigidBodyDesc.dynamic;
    RAPIER_MOCK.RigidBodyDesc.dynamic = () => {
      const builder = origDynamic();
      builder.setCcdEnabled = setCcdSpy;
      return builder;
    };

    try {
      const handle = await buildEngine();
      const world = getWorld();

      handle.drop(fruit(2), fruitSet.id, 100, 300);
      handle.drop(fruit(2), fruitSet.id, 110, 300);
      handle.step(); // 2 drops → 2 CCD calls so far
      setCcdSpy.mockClear();

      world._fireCollision(1003, 1004);
      handle.step(); // merge fires → spawns tier-3 body → 1 more CCD call

      expect(setCcdSpy).toHaveBeenCalledTimes(1);
      expect(setCcdSpy).toHaveBeenCalledWith(true);
    } finally {
      RAPIER_MOCK.RigidBodyDesc.dynamic = origDynamic;
    }
  });
});

// ---------------------------------------------------------------------------
// Exported types / constants
// ---------------------------------------------------------------------------

describe("exported constants and types", () => {
  it("WALL_THICKNESS is a positive number", () => {
    expect(WALL_THICKNESS).toBeGreaterThan(0);
  });

  it("DANGER_LINE_RATIO is between 0 and 1", () => {
    expect(DANGER_LINE_RATIO).toBeGreaterThan(0);
    expect(DANGER_LINE_RATIO).toBeLessThan(1);
  });

  it("BodySnapshot type includes angle field", () => {
    const snap: BodySnapshot = { id: 1, x: 100, y: 200, tier: 3, angle: 0.5, collisionVerts: null };
    expect(snap.angle).toBe(0.5);
  });
});
