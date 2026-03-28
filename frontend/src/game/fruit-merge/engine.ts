import Matter from "matter-js";
import { FruitDefinition, FruitSet, FruitTier } from "../../theme/fruitSets";

export const WALL_THICKNESS = 16;
// Fruits drop into the top of the container; danger line sits below the drop zone
export const DANGER_LINE_RATIO = 0.18; // 18% from top — game over if settled fruit crosses this
const GAME_OVER_GRACE_MS = 2000; // ignore newly-dropped fruit for 2 seconds

// --- Physics tuning constants (aligned with Suika Game / Matter.js clone references) ---
const FRUIT_RESTITUTION = 0.45;
const FRUIT_FRICTION = 0.05;
const FRUIT_FRICTION_AIR = 0.01;
const FRUIT_DENSITY = 0.001;

// Merge chain-reaction: wake sleeping neighbors within this radius so pile rebalances
const MERGE_WAKE_RADIUS_FACTOR = 3.5; // × merged-fruit radius

export interface FruitBody extends Matter.Body {
  fruitTier: FruitTier;
  fruitSetId: string;
  isMerging: boolean;
  createdAt: number;
  fruitRadius: number; // always set; used by renderers to determine draw radius
}

export interface BodySnapshot {
  id: number;
  x: number;
  y: number;
  tier: number;
  angle: number; // body rotation in radians — used to orient PNG images in renderers
}

export interface MergeEvent {
  tier: FruitTier;
  x: number;
  y: number;
}

export interface EngineSetup {
  engine: Matter.Engine;
  world: Matter.World;
  runner: Matter.Runner;
  cleanup: () => void;
}

export function createEngine(
  W: number,
  H: number,
  fruitSet: FruitSet,
  onMerge: (event: MergeEvent) => void,
  onGameOver: () => void
): EngineSetup {
  const engine = Matter.Engine.create({
    gravity: { y: 1.5 },
    enableSleeping: true,
    positionIterations: 8,
    velocityIterations: 8,
  });
  const world = engine.world;

  // Walls sit INSIDE the canvas so physics and rendering match.
  // Left wall inner surface = WALL_THICKNESS; right = W - WALL_THICKNESS.
  // Floor top surface at H - WALL_THICKNESS, matching the visual floor bar drawn by the renderer.
  const floor = Matter.Bodies.rectangle(W / 2, H - WALL_THICKNESS / 2, W, WALL_THICKNESS, {
    isStatic: true,
    label: "floor",
  });
  const wallLeft = Matter.Bodies.rectangle(WALL_THICKNESS / 2, H / 2, WALL_THICKNESS, H * 2, {
    isStatic: true,
    label: "wall",
  });
  const wallRight = Matter.Bodies.rectangle(W - WALL_THICKNESS / 2, H / 2, WALL_THICKNESS, H * 2, {
    isStatic: true,
    label: "wall",
  });
  Matter.World.add(world, [floor, wallLeft, wallRight]);

  // Merge detection
  const mergeSet = new Set<string>();

  Matter.Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA as FruitBody;
      const b = pair.bodyB as FruitBody;

      if (
        a.fruitTier === undefined ||
        b.fruitTier === undefined ||
        a.fruitTier !== b.fruitTier ||
        a.isMerging ||
        b.isMerging
      )
        continue;

      const key = [a.id, b.id].sort().join("-");
      if (mergeSet.has(key)) continue;
      mergeSet.add(key);

      a.isMerging = true;
      b.isMerging = true;

      const tier = a.fruitTier;
      const midX = (a.position.x + b.position.x) / 2;
      const midY = (a.position.y + b.position.y) / 2;

      setTimeout(() => {
        mergeSet.delete(key);
        Matter.World.remove(world, [a, b]);
        onMerge({ tier, x: midX, y: midY });

        if (tier < 10) {
          const nextDef = fruitSet.fruits[(tier + 1) as FruitTier];
          spawnFruitAt(world, nextDef, fruitSet.id, midX, midY);

          // Wake sleeping bodies near the merge so chain reactions fire correctly
          const wakeRadius = nextDef.radius * MERGE_WAKE_RADIUS_FACTOR;
          for (const b of Matter.Composite.allBodies(world)) {
            const fb2 = b as FruitBody;
            if (fb2.fruitTier === undefined || fb2.isStatic) continue;
            if (Math.hypot(b.position.x - midX, b.position.y - midY) <= wakeRadius) {
              Matter.Sleeping.set(b, false);
            }
          }
        }
      }, 0);
    }
  });

  // Game-over: a settled fruit (alive > grace period) above the danger line
  const dangerY = H * DANGER_LINE_RATIO;
  const leftBoundary = WALL_THICKNESS;
  const rightBoundary = W - WALL_THICKNESS;
  const floorY = H - WALL_THICKNESS; // top surface of the visual floor bar
  let gameOverFired = false;

  Matter.Events.on(engine, "afterUpdate", () => {
    if (gameOverFired) return;
    const now = Date.now();
    for (const body of Matter.Composite.allBodies(world)) {
      const fb = body as FruitBody;
      if (fb.fruitTier !== undefined && !fb.isStatic) {
        let correctedX: number | null = null;
        let correctedY: number | null = null;

        const bLeft = body.bounds.min.x;
        const bRight = body.bounds.max.x;
        const bBottom = body.bounds.max.y;

        if (bLeft < leftBoundary) {
          correctedX = body.position.x + (leftBoundary - bLeft);
        } else if (bRight > rightBoundary) {
          correctedX = body.position.x - (bRight - rightBoundary);
        }

        if (bBottom > floorY) {
          correctedY = body.position.y - (bBottom - floorY);
        }

        if (correctedX !== null || correctedY !== null) {
          // Zero velocity on corrected axes BEFORE setPosition so that the
          // subsequent Bounds.update (called inside setPosition) computes
          // bounds without a velocity extension on those axes.
          Matter.Body.setVelocity(body, {
            x: correctedX !== null ? 0 : body.velocity.x,
            y: correctedY !== null && body.velocity.y > 0 ? 0 : body.velocity.y,
          });
          Matter.Body.setPosition(body, {
            x: correctedX ?? body.position.x,
            y: correctedY ?? body.position.y,
          });
        }
      }

      if (
        fb.fruitTier === undefined ||
        fb.isStatic ||
        fb.isMerging ||
        now - fb.createdAt < GAME_OVER_GRACE_MS
      )
        continue;

      // Top of the fruit body
      if (body.bounds.min.y < dangerY) {
        gameOverFired = true;
        onGameOver();
        return;
      }
    }
  });

  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);

  function cleanup() {
    Matter.Runner.stop(runner);
    Matter.Events.off(engine, "collisionStart");
    Matter.Events.off(engine, "afterUpdate");
    Matter.Engine.clear(engine);
  }

  return { engine, world, runner, cleanup };
}

export function spawnFruitAt(
  world: Matter.World,
  def: FruitDefinition,
  fruitSetId: string,
  x: number,
  y: number
): FruitBody {
  const body = Matter.Bodies.circle(x, y, def.radius, {
    restitution: FRUIT_RESTITUTION,
    friction: FRUIT_FRICTION,
    frictionAir: FRUIT_FRICTION_AIR,
    density: FRUIT_DENSITY,
    label: `fruit-${def.tier}`,
  });

  const fb = body as FruitBody;
  fb.fruitTier = def.tier;
  fb.fruitSetId = fruitSetId;
  fb.isMerging = false;
  fb.createdAt = Date.now();
  fb.fruitRadius = def.radius;

  Matter.World.add(world, fb);
  return fb;
}

export function dropFruit(
  world: Matter.World,
  def: FruitDefinition,
  fruitSetId: string,
  x: number,
  spawnY: number
): FruitBody {
  return spawnFruitAt(world, def, fruitSetId, x, spawnY);
}
