import Matter from "matter-js";
import { FruitDefinition, FruitSet, FruitTier } from "../../theme/fruitSets";

export const WALL_THICKNESS = 20;
export const CONTAINER_COLOR = "#334155";

export interface FruitBody extends Matter.Body {
  fruitTier: FruitTier;
  fruitSetId: string;
  isMerging: boolean;
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
  canvas: HTMLCanvasElement,
  fruitSet: FruitSet,
  onMerge: (event: MergeEvent) => void,
  onGameOver: () => void,
): EngineSetup {
  const W = canvas.width;
  const H = canvas.height;

  const engine = Matter.Engine.create({ gravity: { y: 1.5 } });
  const world = engine.world;

  // Container walls: floor, left, right
  const floor = Matter.Bodies.rectangle(W / 2, H + WALL_THICKNESS / 2, W, WALL_THICKNESS, {
    isStatic: true,
    label: "floor",
    render: { fillStyle: CONTAINER_COLOR },
  });
  const wallLeft = Matter.Bodies.rectangle(-WALL_THICKNESS / 2, H / 2, WALL_THICKNESS, H * 2, {
    isStatic: true,
    label: "wall",
    render: { fillStyle: CONTAINER_COLOR },
  });
  const wallRight = Matter.Bodies.rectangle(W + WALL_THICKNESS / 2, H / 2, WALL_THICKNESS, H * 2, {
    isStatic: true,
    label: "wall",
    render: { fillStyle: CONTAINER_COLOR },
  });
  Matter.World.add(world, [floor, wallLeft, wallRight]);

  // Collision: detect same-tier fruit pairs and merge them
  const mergeQueue = new Set<string>();

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
      ) {
        continue;
      }

      const key = [a.id, b.id].sort().join("-");
      if (mergeQueue.has(key)) continue;
      mergeQueue.add(key);

      const tier = a.fruitTier;
      const midX = (a.position.x + b.position.x) / 2;
      const midY = (a.position.y + b.position.y) / 2;

      // Mark as merging to prevent double-merge
      (a as FruitBody).isMerging = true;
      (b as FruitBody).isMerging = true;

      // Defer removal + spawn to next tick to avoid physics mid-step mutation
      setTimeout(() => {
        mergeQueue.delete(key);
        Matter.World.remove(world, a);
        Matter.World.remove(world, b);

        onMerge({ tier, x: midX, y: midY });

        // Watermelon + Watermelon = disappear (no spawn)
        if (tier < 10) {
          const nextTier = (tier + 1) as FruitTier;
          const def = fruitSet.fruits[nextTier];
          spawnFruitAt(world, def, fruitSet.id, midX, midY);
        }
      }, 0);
    }
  });

  // Game-over: check if any fruit body has risen above the danger line (10% from top)
  const dangerY = H * 0.1;
  let gameOverFired = false;

  Matter.Events.on(engine, "afterUpdate", () => {
    if (gameOverFired) return;
    for (const body of world.bodies) {
      const fb = body as FruitBody;
      if (
        fb.fruitTier !== undefined &&
        !fb.isStatic &&
        !fb.isMerging &&
        body.position.y - fb.circleRadius! < dangerY
      ) {
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
    Matter.Engine.clear(engine);
    Matter.Events.off(engine, "collisionStart");
    Matter.Events.off(engine, "afterUpdate");
  }

  return { engine, world, runner, cleanup };
}

export function spawnFruitAt(
  world: Matter.World,
  def: FruitDefinition,
  fruitSetId: string,
  x: number,
  y: number,
): FruitBody {
  const body = Matter.Bodies.circle(x, y, def.radius, {
    restitution: 0.2,
    friction: 0.5,
    frictionAir: 0.01,
    label: `fruit-${def.tier}`,
    render: { fillStyle: def.color },
  }) as FruitBody;

  body.fruitTier = def.tier;
  body.fruitSetId = fruitSetId;
  body.isMerging = false;

  Matter.World.add(world, body);
  return body;
}

export function dropFruit(
  world: Matter.World,
  def: FruitDefinition,
  fruitSetId: string,
  x: number,
  spawnY: number,
): FruitBody {
  return spawnFruitAt(world, def, fruitSetId, x, spawnY);
}
