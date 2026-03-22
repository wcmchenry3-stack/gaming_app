import Matter from "matter-js";
import { FruitDefinition, FruitSet, FruitTier } from "../../theme/fruitSets";

export const WALL_THICKNESS = 16;
// Fruits drop into the top of the container; danger line sits below the drop zone
export const DANGER_LINE_RATIO = 0.18; // 18% from top — game over if settled fruit crosses this
const GAME_OVER_GRACE_MS = 2000; // ignore newly-dropped fruit for 2 seconds

export interface FruitBody extends Matter.Body {
  fruitTier: FruitTier;
  fruitSetId: string;
  isMerging: boolean;
  createdAt: number;
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
  const engine = Matter.Engine.create({ gravity: { y: 2 } });
  const world = engine.world;

  // Walls sit INSIDE the canvas so physics and rendering match.
  // Left wall inner surface = WALL_THICKNESS; right = W - WALL_THICKNESS.
  const floor = Matter.Bodies.rectangle(W / 2, H + WALL_THICKNESS / 2, W, WALL_THICKNESS, {
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
        }
      }, 0);
    }
  });

  // Game-over: a settled fruit (alive > grace period) above the danger line
  const dangerY = H * DANGER_LINE_RATIO;
  let gameOverFired = false;

  Matter.Events.on(engine, "afterUpdate", () => {
    if (gameOverFired) return;
    const now = Date.now();
    for (const body of Matter.Composite.allBodies(world)) {
      const fb = body as FruitBody;
      if (
        fb.fruitTier === undefined ||
        fb.isStatic ||
        fb.isMerging ||
        now - fb.createdAt < GAME_OVER_GRACE_MS
      )
        continue;

      // Top of the fruit circle
      if (body.position.y - (fb.circleRadius ?? 0) < dangerY) {
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
    restitution: 0.3,
    friction: 0.5,
    frictionAir: 0.01,
    density: 0.002,
    label: `fruit-${def.tier}`,
  }) as FruitBody;

  body.fruitTier = def.tier;
  body.fruitSetId = fruitSetId;
  body.isMerging = false;
  body.createdAt = Date.now();

  Matter.World.add(world, body);
  return body;
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
