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

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const _engine: typeof import("../engine") = require(
  require("path").resolve(__dirname, "..", "engine.ts")
);
const { createEngine } = _engine;
import type { EngineHandle, BodySnapshot } from "../engine.shared";
import { DANGER_LINE_RATIO, WALL_THICKNESS } from "../engine.shared";
import { FRUIT_SETS } from "../../../theme/fruitSets";
import { MockWorld } from "../../../../__mocks__/@dimforge/rapier2d-compat";

// Access the live mock module so tests can inspect call counts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RAPIER_MOCK = require("@dimforge/rapier2d-compat").default;

const fruitSet = FRUIT_SETS["fruits"];
const W = 300;
const H = 600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the MockWorld instance created by the most recent createEngine call. */
function getWorld(): MockWorld {
  const results = (RAPIER_MOCK.World as jest.Mock).mock.results;
  return results[results.length - 1].value as MockWorld;
}

async function buildEngine(onMerge = jest.fn(), onGameOver = jest.fn()): Promise<EngineHandle> {
  return createEngine(W, H, fruitSet, onMerge, onGameOver);
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
  it("returns empty array when no fruits have been dropped", async () => {
    const handle = await buildEngine();
    expect(handle.step()).toEqual([]);
  });

  it("returns a snapshot for each dropped fruit", async () => {
    const handle = await buildEngine();
    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 100);
    handle.drop(fruitSet.fruits[1], fruitSet.id, 160, 100);
    expect(handle.step()).toHaveLength(2);
  });

  it("snapshot positions are close to drop coordinates (pixels)", async () => {
    const handle = await buildEngine();
    handle.drop(fruitSet.fruits[2], fruitSet.id, 150, 100);
    const [snap] = handle.step();
    expect(snap.x).toBeCloseTo(150, 0);
    expect(snap.y).toBeCloseTo(100, 0);
  });

  it("snapshot has id, tier, and angle fields", async () => {
    const handle = await buildEngine();
    handle.drop(fruitSet.fruits[3], fruitSet.id, 150, 200);
    const [snap] = handle.step() as BodySnapshot[];
    expect(snap).toHaveProperty("id");
    expect(snap.tier).toBe(3);
    expect(typeof snap.angle).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// drop()
// ---------------------------------------------------------------------------

describe("drop", () => {
  it("spawns a fruit visible in the next step", async () => {
    const handle = await buildEngine();
    handle.drop(fruitSet.fruits[1], fruitSet.id, 150, 100);
    const snaps = handle.step();
    expect(snaps).toHaveLength(1);
    expect(snaps[0].tier).toBe(1);
  });

  it("uses ball collider for sets without vertex data (gems)", async () => {
    const handle = await createEngine(W, H, FRUIT_SETS["gems"], jest.fn(), jest.fn());
    handle.drop(FRUIT_SETS["gems"].fruits[0], "gems", 150, 100);
    expect(RAPIER_MOCK.ColliderDesc.ball).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Merge detection
// ---------------------------------------------------------------------------

describe("merge detection", () => {
  it("calls onMerge when two same-tier fruits collide", async () => {
    const onMerge = jest.fn();
    const handle = await createEngine(W, H, fruitSet, onMerge, jest.fn());
    const world = getWorld();

    handle.drop(fruitSet.fruits[1], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[1], fruitSet.id, 110, 300);
    handle.step(); // register bodies; world assigns collider handles 1003 & 1004

    // Wall colliders get 1000–1002; fruit colliders get 1003–1004
    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 1 }));
  });

  it("does NOT call onMerge for different-tier fruits", async () => {
    const onMerge = jest.fn();
    const handle = await createEngine(W, H, fruitSet, onMerge, jest.fn());
    const world = getWorld();

    handle.drop(fruitSet.fruits[0], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[2], fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).not.toHaveBeenCalled();
  });

  it("merges only once even if the same pair fires twice", async () => {
    const onMerge = jest.fn();
    const handle = await createEngine(W, H, fruitSet, onMerge, jest.fn());
    const world = getWorld();

    handle.drop(fruitSet.fruits[2], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[2], fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    world._fireCollision(1003, 1004); // duplicate
    handle.step();

    expect(onMerge).toHaveBeenCalledTimes(1);
  });

  it("spawns a tier+1 fruit after merge when tier < 10", async () => {
    const onMerge = jest.fn();
    const handle = await createEngine(W, H, fruitSet, onMerge, jest.fn());
    const world = getWorld();

    handle.drop(fruitSet.fruits[3], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[3], fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 3 }));
    const tiers = handle.step().map((s) => s.tier);
    expect(tiers).toContain(4);
  });

  it("does NOT spawn a new fruit when merging tier 10 (watermelon disappears)", async () => {
    const onMerge = jest.fn();
    const handle = await createEngine(W, H, fruitSet, onMerge, jest.fn());
    const world = getWorld();

    handle.drop(fruitSet.fruits[10], fruitSet.id, 100, 300);
    handle.drop(fruitSet.fruits[10], fruitSet.id, 110, 300);
    handle.step();

    world._fireCollision(1003, 1004);
    handle.step();

    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 10 }));
    expect(handle.step()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Game-over detection
// ---------------------------------------------------------------------------

describe("game-over detection", () => {
  // dangerY = H * DANGER_LINE_RATIO = 108px; used as reference in test comments below

  it("fires onGameOver when a settled fruit is above the danger line", async () => {
    const onGameOver = jest.fn();
    const handle = await createEngine(W, H, fruitSet, jest.fn(), onGameOver);

    // tier-0 radius = 18. Top = y - 18. For top < dangerY (108): y < 126.
    // Spawn at y=50 (top = 32, well above the danger line).
    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 50);
    handle.step(); // freshly created — within grace period, no game over yet

    expect(onGameOver).not.toHaveBeenCalled();

    // Advance time past the 2-second grace period
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3000);
    handle.step();
    jest.useRealTimers();

    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onGameOver during the grace period", async () => {
    const onGameOver = jest.fn();
    const handle = await createEngine(W, H, fruitSet, jest.fn(), onGameOver);

    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 50);
    handle.step(); // within 2s grace period

    expect(onGameOver).not.toHaveBeenCalled();
  });

  it("does NOT fire onGameOver when fruit is safely below the danger line", async () => {
    const onGameOver = jest.fn();
    const handle = await createEngine(W, H, fruitSet, jest.fn(), onGameOver);

    // tier-0 radius=18, y=300 → top = 282 > dangerY (108) → safe
    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 300);

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3000);
    handle.step();
    jest.useRealTimers();

    expect(onGameOver).not.toHaveBeenCalled();
  });

  it("fires onGameOver only once across multiple steps", async () => {
    const onGameOver = jest.fn();
    const handle = await createEngine(W, H, fruitSet, jest.fn(), onGameOver);

    handle.drop(fruitSet.fruits[0], fruitSet.id, 150, 50);

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 3000);
    handle.step();
    handle.step(); // second step should not re-fire
    jest.useRealTimers();

    expect(onGameOver).toHaveBeenCalledTimes(1);
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
    const snap: BodySnapshot = { id: 1, x: 100, y: 200, tier: 3, angle: 0.5 };
    expect(snap.angle).toBe(0.5);
  });
});
