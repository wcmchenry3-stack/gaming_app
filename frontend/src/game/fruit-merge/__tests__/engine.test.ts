import Matter from "matter-js";
import {
  createEngine,
  spawnFruitAt,
  FruitBody,
  BodySnapshot,
  DANGER_LINE_RATIO,
  EngineSetup,
  WALL_THICKNESS,
} from "../engine";
import { FRUIT_SETS } from "../../../theme/fruitSets";

const fruitSet = FRUIT_SETS["fruits"];
const W = 300;
const H = 600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 1;

/**
 * Build a minimal FruitBody stub.
 * - `type: 'body'` is required for Matter.World.add / Composite.allBodies to work.
 * - ageMs defaults to 3000 so the body is past the 2-second grace period.
 */
function makeFakeBody(tier: number, x: number, y: number, ageMs = 3000): FruitBody {
  return {
    id: idCounter++,
    type: "body",
    fruitTier: tier,
    fruitSetId: fruitSet.id,
    isMerging: false,
    isStatic: false,
    createdAt: Date.now() - ageMs,
    fruitRadius: fruitSet.fruits[tier].radius,
    position: { x, y },
  } as unknown as FruitBody;
}

function fireCollision(engine: Matter.Engine, a: FruitBody, b: FruitBody): void {
  Matter.Events.trigger(engine as object, "collisionStart", {
    pairs: [{ bodyA: a, bodyB: b }],
  });
}

function fireUpdate(engine: Matter.Engine): void {
  Matter.Events.trigger(engine as object, "afterUpdate", {});
}

// ---------------------------------------------------------------------------
// Setup / Teardown
//
// We stop the runner (so physics never ticks) but keep event listeners alive.
// Full cleanup is deferred to afterEach so handlers are present during tests.
// ---------------------------------------------------------------------------

let current: EngineSetup & {
  onMerge: jest.Mock;
  onGameOver: jest.Mock;
};

function setup(): typeof current {
  const onMerge = jest.fn();
  const onGameOver = jest.fn();
  const es = createEngine(W, H, fruitSet, onMerge, onGameOver);
  // Stop the physics runner — we fire events manually in every test.
  Matter.Runner.stop(es.runner);
  current = { ...es, onMerge, onGameOver };
  return current;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  current?.cleanup();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// spawnFruitAt
// ---------------------------------------------------------------------------

describe("spawnFruitAt", () => {
  it("returns a body with the correct tier and fruitSetId", () => {
    const { world } = setup();
    const def = fruitSet.fruits[2];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 100);

    expect(body.fruitTier).toBe(2);
    expect(body.fruitSetId).toBe(fruitSet.id);
    expect(body.isMerging).toBe(false);
  });

  it("sets createdAt close to Date.now()", () => {
    const { world } = setup();
    const before = Date.now();
    const body = spawnFruitAt(world, fruitSet.fruits[0], fruitSet.id, 150, 100);

    expect(body.createdAt).toBeGreaterThanOrEqual(before);
    expect(body.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("adds the body to the world", () => {
    const { world } = setup();
    const body = spawnFruitAt(world, fruitSet.fruits[1], fruitSet.id, 150, 100);
    const allBodies = Matter.Composite.allBodies(world);

    expect(allBodies).toContain(body);
  });
});

// ---------------------------------------------------------------------------
// Merge detection
// ---------------------------------------------------------------------------

describe("merge detection", () => {
  it("calls onMerge when two same-tier fruits collide", () => {
    const { engine, onMerge } = setup();

    const a = makeFakeBody(1, 100, 300);
    const b = makeFakeBody(1, 110, 300);
    fireCollision(engine, a, b);
    jest.runAllTimers();

    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 1 }));
  });

  it("reports the midpoint of the two bodies", () => {
    const { engine, onMerge } = setup();

    const a = makeFakeBody(0, 100, 200);
    const b = makeFakeBody(0, 140, 260);
    fireCollision(engine, a, b);
    jest.runAllTimers();

    expect(onMerge).toHaveBeenCalledWith({ tier: 0, x: 120, y: 230 });
  });

  it("does NOT call onMerge for different-tier fruits", () => {
    const { engine, onMerge } = setup();

    const a = makeFakeBody(1, 100, 300);
    const b = makeFakeBody(2, 110, 300);
    fireCollision(engine, a, b);
    jest.runAllTimers();

    expect(onMerge).not.toHaveBeenCalled();
  });

  it("does NOT call onMerge if bodyA.isMerging is true", () => {
    const { engine, onMerge } = setup();

    const a = makeFakeBody(2, 100, 300);
    const b = makeFakeBody(2, 110, 300);
    a.isMerging = true;
    fireCollision(engine, a, b);
    jest.runAllTimers();

    expect(onMerge).not.toHaveBeenCalled();
  });

  it("does NOT call onMerge if bodyB.isMerging is true", () => {
    const { engine, onMerge } = setup();

    const a = makeFakeBody(3, 100, 300);
    const b = makeFakeBody(3, 110, 300);
    b.isMerging = true;
    fireCollision(engine, a, b);
    jest.runAllTimers();

    expect(onMerge).not.toHaveBeenCalled();
  });

  it("calls onMerge only once when the same pair fires twice (mergeSet dedup)", () => {
    const { engine, onMerge } = setup();

    const a = makeFakeBody(1, 100, 300);
    const b = makeFakeBody(1, 110, 300);
    fireCollision(engine, a, b);
    fireCollision(engine, a, b); // same pair again — should be skipped
    jest.runAllTimers();

    expect(onMerge).toHaveBeenCalledTimes(1);
  });

  it("adds a new tier+1 fruit to the world when tier < 10", () => {
    const { engine, world } = setup();

    const a = makeFakeBody(3, 100, 300);
    const b = makeFakeBody(3, 110, 300);
    fireCollision(engine, a, b);
    jest.runAllTimers();

    const fruitBodies = Matter.Composite.allBodies(world).filter((b) => !b.isStatic);
    expect(fruitBodies.length).toBe(1);
    expect((fruitBodies[0] as FruitBody).fruitTier).toBe(4);
  });

  it("does NOT add a new fruit when tier 10 (watermelon disappears)", () => {
    const { engine, world, onMerge } = setup();

    const a = makeFakeBody(10, 150, 300);
    const b = makeFakeBody(10, 160, 300);
    fireCollision(engine, a, b);
    jest.runAllTimers();

    expect(onMerge).toHaveBeenCalledWith(expect.objectContaining({ tier: 10 }));
    const fruitBodies = Matter.Composite.allBodies(world).filter((b) => !b.isStatic);
    expect(fruitBodies.length).toBe(0);
  });

  it("handles two separate pairs colliding in the same event independently", () => {
    const { engine, onMerge } = setup();

    const a1 = makeFakeBody(0, 100, 300);
    const b1 = makeFakeBody(0, 110, 300);
    const a2 = makeFakeBody(2, 150, 300);
    const b2 = makeFakeBody(2, 160, 300);

    Matter.Events.trigger(engine as object, "collisionStart", {
      pairs: [
        { bodyA: a1, bodyB: b1 },
        { bodyA: a2, bodyB: b2 },
      ],
    });
    jest.runAllTimers();

    expect(onMerge).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Game-over detection
// ---------------------------------------------------------------------------

describe("game-over detection", () => {
  // At H=600, danger line is at 600 * 0.18 = 108px from the top.
  const dangerY = H * DANGER_LINE_RATIO;

  /**
   * Spawn a real fruit body using spawnFruitAt, then teleport it and adjust
   * its age. We use real bodies so Matter.Composite.allBodies returns them.
   */
  function spawnAt(world: Matter.World, tier: number, y: number, ageMs = 3000): FruitBody {
    const def = fruitSet.fruits[tier];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 500); // spawn safely off-screen
    // Teleport to target position
    Matter.Body.setPosition(body, { x: 150, y });
    body.createdAt = Date.now() - ageMs;
    return body;
  }

  it("fires onGameOver when a settled fruit is above the danger line", () => {
    const { engine, world, onGameOver } = setup();

    // Top of fruit = position.y - radius. With tier-0 radius=18, positioning
    // at dangerY - 1 puts the top at dangerY - 19, which is above dangerY.
    spawnAt(world, 0, dangerY - 1);
    fireUpdate(engine);

    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onGameOver during the grace period (newly dropped fruit)", () => {
    const { engine, world, onGameOver } = setup();

    // Same dangerous position but only 500ms old — within the 2s grace period
    spawnAt(world, 0, dangerY - 1, 500);
    fireUpdate(engine);

    expect(onGameOver).not.toHaveBeenCalled();
  });

  it("does NOT fire onGameOver when fruit is safely below the danger line", () => {
    const { engine, world, onGameOver } = setup();

    spawnAt(world, 0, dangerY + 100);
    fireUpdate(engine);

    expect(onGameOver).not.toHaveBeenCalled();
  });

  it("does NOT fire onGameOver for a fruit with isMerging=true", () => {
    const { engine, world, onGameOver } = setup();

    const body = spawnAt(world, 0, dangerY - 1);
    body.isMerging = true;
    fireUpdate(engine);

    expect(onGameOver).not.toHaveBeenCalled();
  });

  it("fires onGameOver only once even if multiple fruits are above the danger line", () => {
    const { engine, world, onGameOver } = setup();

    spawnAt(world, 0, dangerY - 1);
    spawnAt(world, 0, dangerY - 1);
    fireUpdate(engine);
    fireUpdate(engine); // second tick — gameOverFired flag should block re-fire

    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onGameOver for static bodies (walls/floor)", () => {
    const { engine, onGameOver } = setup();

    // Walls and floor are already in the world — just trigger an update
    fireUpdate(engine);

    expect(onGameOver).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// spawnFruitAt — polygon vs circle body creation
// ---------------------------------------------------------------------------

describe("spawnFruitAt — polygon body creation", () => {
  const SQUARE_VERTS = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];

  it("always sets fruitRadius to def.radius regardless of body type", () => {
    const { world } = setup();
    const def = fruitSet.fruits[2];

    const circleBody = spawnFruitAt(world, def, fruitSet.id, 150, 100);
    expect(circleBody.fruitRadius).toBe(def.radius);

    const polyBody = spawnFruitAt(world, def, fruitSet.id, 150, 200, SQUARE_VERTS);
    expect(polyBody.fruitRadius).toBe(def.radius);
  });

  it("polygon body has fruitRadius set while circle body has a positive circleRadius", () => {
    const { world } = setup();
    const def = fruitSet.fruits[1];

    const circleBody = spawnFruitAt(world, def, fruitSet.id, 150, 100);
    expect((circleBody as unknown as { circleRadius?: number }).circleRadius).toBeGreaterThan(0);

    const polyBody = spawnFruitAt(world, def, fruitSet.id, 150, 200, SQUARE_VERTS);
    // fruitRadius is always reliable regardless of body type
    expect(polyBody.fruitRadius).toBe(def.radius);
  });

  it("falls back to circle when vertices array has fewer than 3 points", () => {
    const { world } = setup();
    const def = fruitSet.fruits[0];
    const tooFew = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 100, tooFew);
    // Circle body always has circleRadius
    expect((body as unknown as { circleRadius?: number }).circleRadius).toBeDefined();
    expect(body.fruitRadius).toBe(def.radius);
  });

  it("falls back to circle when vertices is null", () => {
    const { world } = setup();
    const def = fruitSet.fruits[0];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 100, null);
    expect((body as unknown as { circleRadius?: number }).circleRadius).toBeDefined();
  });

  it("polygon body position matches requested (x, y) after fromVertices centroid correction", () => {
    const { world } = setup();
    const def = fruitSet.fruits[2]; // Lemon, radius 33
    const asymmetricVerts = [
      { x: -1, y: -0.3 },
      { x: 0.2, y: -1 },
      { x: 1, y: 0.1 },
      { x: 0.5, y: 1 },
      { x: -0.8, y: 0.7 },
    ];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 200, asymmetricVerts);
    expect(body.position.x).toBeCloseTo(150, 0); // within ±0.5px
    expect(body.position.y).toBeCloseTo(200, 0);
  });

  it("polygon body bounds stay within container after clamping", () => {
    const { engine, world } = setup();
    const def = fruitSet.fruits[2];
    const squareVerts = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 300, squareVerts);
    Matter.Body.setPosition(body, { x: WALL_THICKNESS - 5, y: 300 });
    fireUpdate(engine);
    expect(body.bounds.min.x).toBeGreaterThanOrEqual(WALL_THICKNESS);
  });

  it("BodySnapshot type includes angle field", () => {
    // Compile-time check: ensure BodySnapshot has angle
    const snap: BodySnapshot = { id: 1, x: 100, y: 200, tier: 3, angle: 0.5 };
    expect(snap.angle).toBe(0.5);
  });
});

describe("world boundary clamping", () => {
  it("keeps fruits above the floor if they drift below the playfield", () => {
    const { engine, world } = setup();
    const def = fruitSet.fruits[1];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 100);

    Matter.Body.setPosition(body, { x: 150, y: H + 20 });
    Matter.Body.setVelocity(body, { x: 0, y: 12 });
    fireUpdate(engine);

    expect(body.bounds.max.y).toBeLessThanOrEqual(H - WALL_THICKNESS); // top of visual floor bar
    expect(body.velocity.y).toBeLessThanOrEqual(0);
  });

  it("keeps fruits inside the left and right walls", () => {
    const { engine, world } = setup();
    const def = fruitSet.fruits[1];
    const body = spawnFruitAt(world, def, fruitSet.id, 150, 100);

    Matter.Body.setPosition(body, { x: WALL_THICKNESS - 8, y: 200 });
    Matter.Body.setVelocity(body, { x: -5, y: 0 });
    fireUpdate(engine);
    expect(body.bounds.min.x).toBeGreaterThanOrEqual(WALL_THICKNESS);
    expect(body.velocity.x).toBeGreaterThanOrEqual(0);

    Matter.Body.setPosition(body, { x: W - WALL_THICKNESS + 8, y: 200 });
    Matter.Body.setVelocity(body, { x: 5, y: 0 });
    fireUpdate(engine);
    expect(body.bounds.max.x).toBeLessThanOrEqual(W - WALL_THICKNESS);
    expect(body.velocity.x).toBeLessThanOrEqual(0);
  });
});
