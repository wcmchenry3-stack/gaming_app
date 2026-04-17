import Matter from "matter-js";
import { FruitDefinition, FruitSet, FruitTier } from "../../theme/fruitSets";
import { getVerticesForFruit } from "./fruitVertices";

// Re-export shared types so imports from './engine' resolve correctly on native
export {
  WORLD_W,
  WORLD_H,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
  GAME_OVER_GRACE_MS,
  FRUIT_RESTITUTION,
  FRUIT_FRICTION,
  FRUIT_DENSITY,
  SCALE,
  GRAVITY_Y,
} from "./engine.shared";
export type {
  FruitBody,
  BodySnapshot,
  MergeEvent,
  EngineHandle,
  EngineSetup,
} from "./engine.shared";

import {
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
  GAME_OVER_GRACE_MS,
  FRUIT_RESTITUTION,
  FRUIT_FRICTION,
} from "./engine.shared";
import type { FruitBody, BodySnapshot, MergeEvent, EngineHandle } from "./engine.shared";

export interface BoundaryEscapeEvent {
  tier: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// matter.js gravity scale: Rapier uses GRAVITY_Y=14 with SCALE=0.01, i.e. 1400 px/s².
// matter.js default gravity.scale = 0.001 and gravity.y = 1 → effective ≈ 1 px/tick².
// We want ~1400 px/s² at 60fps (dt=16.67ms). matter.js applies gravity as:
//   force = body.mass * gravity.y * gravity.scale  (per tick)
// With default scale 0.001 and y=1.4, that gives us a punchy-but-controllable fall.
const MATTER_GRAVITY_Y = 1.4;

// Fixed physics sub-step (60Hz). Matter warns at >16.67ms because collision
// detection starts missing thin walls. step() breaks larger frame deltas
// into N × FIXED_STEP_MS updates.
const FIXED_STEP_MS = 1000 / 60;

export async function createEngine(
  W: number,
  H: number,
  fruitSet: FruitSet,
  onMerge: (event: MergeEvent) => void,
  onGameOver: () => void,
  onBoundaryEscape?: (event: BoundaryEscapeEvent) => void
): Promise<EngineHandle> {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: MATTER_GRAVITY_Y },
  });

  const world = engine.world;

  // body.id → FruitBody metadata
  const fruitMap = new Map<number, FruitBody>();

  // --- Static walls and floor ---
  const floor = Matter.Bodies.rectangle(W / 2, H - WALL_THICKNESS / 2, W, WALL_THICKNESS, {
    isStatic: true,
    friction: FRUIT_FRICTION,
  });
  const leftWall = Matter.Bodies.rectangle(WALL_THICKNESS / 2, H / 2, WALL_THICKNESS, H, {
    isStatic: true,
    friction: FRUIT_FRICTION,
  });
  const rightWall = Matter.Bodies.rectangle(W - WALL_THICKNESS / 2, H / 2, WALL_THICKNESS, H, {
    isStatic: true,
    friction: FRUIT_FRICTION,
  });
  Matter.Composite.add(world, [floor, leftWall, rightWall]);

  const dangerY = H * DANGER_LINE_RATIO;
  let gameOverFired = false;

  const mergeQueue: Array<[number, number]> = [];

  // --- Collision handler ---
  Matter.Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      const fa = fruitMap.get(pair.bodyA.id);
      const fb = fruitMap.get(pair.bodyB.id);
      if (!fa || !fb || fa.isMerging || fb.isMerging) continue;
      if (fa.fruitTier === fb.fruitTier) {
        mergeQueue.push([pair.bodyA.id, pair.bodyB.id]);
      }
    }
  });

  function spawnAt(def: FruitDefinition, setId: string, x: number, y: number): FruitBody {
    const nameKey = (def as { nameKey?: string }).nameKey ?? def.name.toLowerCase();
    const verts = getVerticesForFruit(setId, nameKey);

    let body: Matter.Body;
    const bodyOpts = {
      restitution: FRUIT_RESTITUTION,
      friction: FRUIT_FRICTION,
      density: 0.001, // matter.js density is per-pixel-area; tuned for natural feel
    };

    if (verts && verts.length >= 3) {
      const matterVerts = verts.map((v) => ({
        x: v.x * def.radius,
        y: v.y * def.radius,
      }));
      const polyBody = Matter.Bodies.fromVertices(x, y, [matterVerts], bodyOpts);
      // fromVertices can return a body whose centre-of-mass differs from (x, y).
      // Force the position to the requested drop point so it matches the circle
      // fallback behaviour and the renderer's expectations.
      if (polyBody) {
        Matter.Body.setPosition(polyBody, { x, y });
        body = polyBody;
      } else {
        body = Matter.Bodies.circle(x, y, def.radius, bodyOpts);
      }
    } else {
      body = Matter.Bodies.circle(x, y, def.radius, bodyOpts);
    }

    Matter.Composite.add(world, body);

    const fb: FruitBody = {
      handle: body.id,
      fruitTier: def.tier,
      fruitSetId: setId,
      isMerging: false,
      createdAt: Date.now(),
      fruitRadius: def.radius,
      collisionVerts: verts,
    };
    fruitMap.set(body.id, fb);
    return fb;
  }

  function removeBody(bodyId: number): void {
    const bodies = Matter.Composite.allBodies(world);
    const body = bodies.find((b) => b.id === bodyId);
    if (body) {
      Matter.Composite.remove(world, body);
    }
    fruitMap.delete(bodyId);
  }

  function processMerges(): void {
    for (const [idA, idB] of mergeQueue) {
      const fa = fruitMap.get(idA);
      const fb = fruitMap.get(idB);
      if (!fa || !fb || fa.isMerging || fb.isMerging) continue;
      if (fa.fruitTier !== fb.fruitTier) continue;

      fa.isMerging = true;
      fb.isMerging = true;

      const tier = fa.fruitTier;
      const bodies = Matter.Composite.allBodies(world);
      const bodyA = bodies.find((b) => b.id === idA);
      const bodyB = bodies.find((b) => b.id === idB);
      if (!bodyA || !bodyB) continue;

      const midX = (bodyA.position.x + bodyB.position.x) / 2;
      const midY = (bodyA.position.y + bodyB.position.y) / 2;

      removeBody(idA);
      removeBody(idB);
      onMerge({ tier, x: midX, y: midY });

      if (tier < 10) {
        const nextDef = fruitSet.fruits[(tier + 1) as FruitTier];
        if (nextDef !== undefined) spawnAt(nextDef, fruitSet.id, midX, midY);
      }
    }
    mergeQueue.length = 0;
  }

  return {
    step(dt?: number): BodySnapshot[] {
      // Matter recommends physics steps ≤ 16.67ms; larger steps let
      // fast bodies tunnel through thin static walls (#499). Break a
      // large frame into fixed sub-steps. Clamp total elapsed to 1/6s
      // so a backgrounded tab can't schedule a hundred catch-up steps.
      const rawElapsed = dt ?? 1 / 60;
      let remainingMs = Math.min(rawElapsed, 1 / 6) * 1000;
      while (remainingMs > 0.01) {
        const stepMs = Math.min(remainingMs, FIXED_STEP_MS);
        Matter.Engine.update(engine, stepMs);
        remainingMs -= stepMs;
      }

      processMerges();

      // Game-over detection
      if (!gameOverFired) {
        const now = Date.now();
        fruitMap.forEach((fb, bodyId) => {
          if (gameOverFired || fb.isMerging) return;
          if (now - fb.createdAt < GAME_OVER_GRACE_MS) return;
          const bodies = Matter.Composite.allBodies(world);
          const body = bodies.find((b) => b.id === bodyId);
          if (!body) return;
          const topY = body.position.y - fb.fruitRadius;
          if (topY < dangerY) {
            gameOverFired = true;
            onGameOver();
          }
        });
      }

      // Collect snapshots and detect boundary escapes
      const snapshots: BodySnapshot[] = [];
      const escapedIds: number[] = [];
      const allBodies = Matter.Composite.allBodies(world);
      fruitMap.forEach((fb, bodyId) => {
        const body = allBodies.find((b) => b.id === bodyId);
        if (!body) return;
        const px = body.position.x;
        const py = body.position.y;

        // Detect bodies that have escaped the play area (with margin)
        const margin = fb.fruitRadius * 2;
        if (px < -margin || px > W + margin || py > H + margin) {
          escapedIds.push(bodyId);
          onBoundaryEscape?.({
            tier: fb.fruitTier,
            x: px,
            y: py,
            width: W,
            height: H,
          });
          return;
        }

        snapshots.push({
          id: bodyId,
          x: px,
          y: py,
          tier: fb.fruitTier,
          angle: body.angle,
          collisionVerts: fb.collisionVerts,
        });
      });
      // Clean up escaped bodies
      for (const id of escapedIds) {
        removeBody(id);
      }
      return snapshots;
    },

    drop(def: FruitDefinition, fruitSetId: string, x: number, y: number): void {
      spawnAt(def, fruitSetId, x, y);
    },

    cleanup(): void {
      Matter.Events.off(engine, "collisionStart");
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      fruitMap.clear();
    },
  };
}

export function dropFruit(
  engineHandle: EngineHandle,
  def: FruitDefinition,
  fruitSetId: string,
  x: number,
  spawnY: number
): void {
  engineHandle.drop(def, fruitSetId, x, spawnY);
}
