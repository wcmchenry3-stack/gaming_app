import { FruitSet } from "../../theme/fruitSets";
import { getVerticesForFruit } from "./fruitVertices";

// Re-export all shared types and constants so existing imports from './engine' keep working
export {
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
  GAME_OVER_GRACE_MS,
  FRUIT_RESTITUTION,
  FRUIT_FRICTION,
  FRUIT_DENSITY,
  SCALE,
  GRAVITY_Y,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
} from "./engine.shared";
import type { FruitBody, BodySnapshot, MergeEvent, EngineHandle } from "./engine.shared";

// Import type only for typing purposes (no runtime import at module level)
import type RAPIER_TYPE from "@dimforge/rapier2d-compat";
type RapierLib = typeof RAPIER_TYPE;

// WASM is loaded lazily on first createEngine call; promise is cached after that.
// Uses require() rather than import() so Jest's module mock system intercepts it.
let _rapierPromise: Promise<RapierLib> | null = null;
async function getRapier(): Promise<RapierLib> {
  if (!_rapierPromise) {
    _rapierPromise = (async () => {
      // Hermes (React Native's JS engine on iOS/Android) does not support WebAssembly.
      // Fail fast with a clear message rather than letting rapier throw a cryptic
      // ReferenceError deep inside its WASM loader.
      if (typeof WebAssembly === "undefined") {
        throw new Error("WebAssembly is not available in this environment (Hermes)");
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@dimforge/rapier2d-compat") as { default?: RapierLib } | RapierLib;
      const R = (mod as { default?: RapierLib }).default ?? (mod as RapierLib);
      await R.init();
      return R;
    })();
  }
  return _rapierPromise;
}

export interface BoundaryEscapeEvent {
  tier: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function createEngine(
  W: number,
  H: number,
  fruitSet: FruitSet,
  onMerge: (event: MergeEvent) => void,
  onGameOver: () => void,
  onBoundaryEscape?: (event: BoundaryEscapeEvent) => void
): Promise<EngineHandle> {
  const R = await getRapier();

  const world = new R.World({ x: 0.0, y: GRAVITY_Y });
  const eventQueue = new R.EventQueue(true);

  // fruitMap: rigidBody.handle → FruitBody metadata
  const fruitMap = new Map<number, FruitBody>();
  // collider.handle → rigidBody.handle (for collision event lookup)
  const colliderToBody = new Map<number, number>();

  // --- Static walls and floor ---
  // Rapier cuboid takes half-extents, so divide sizes by 2.
  // Positions are the centre of each wall.

  // Floor (top surface at H - WALL_THICKNESS)
  world.createCollider(
    R.ColliderDesc.cuboid((W / 2) * SCALE, (WALL_THICKNESS / 2) * SCALE).setTranslation(
      (W / 2) * SCALE,
      (H - WALL_THICKNESS / 2) * SCALE
    )
  );
  // Left wall (inner surface at WALL_THICKNESS)
  world.createCollider(
    R.ColliderDesc.cuboid((WALL_THICKNESS / 2) * SCALE, H * SCALE).setTranslation(
      (WALL_THICKNESS / 2) * SCALE,
      (H / 2) * SCALE
    )
  );
  // Right wall (inner surface at W - WALL_THICKNESS)
  world.createCollider(
    R.ColliderDesc.cuboid((WALL_THICKNESS / 2) * SCALE, H * SCALE).setTranslation(
      (W - WALL_THICKNESS / 2) * SCALE,
      (H / 2) * SCALE
    )
  );

  const dangerY = H * DANGER_LINE_RATIO; // pixels
  let gameOverFired = false;

  // Merges are queued during collision events and processed synchronously after draining.
  const mergeQueue: Array<[number, number]> = [];

  function spawnAt(
    def: FruitDefinition,
    setId: string,
    x: number,
    y: number,
    source: "player" | "merge" = "player"
  ): FruitBody {
    console.log(
      `[Engine] spawn tier=${def.tier} source=${source} totalBefore=${fruitMap.size} t=${Date.now()}`
    );
    const rbDesc = R.RigidBodyDesc.dynamic().setTranslation(x * SCALE, y * SCALE);
    const rb = world.createRigidBody(rbDesc);

    const nameKey = (def as { nameKey?: string }).nameKey ?? def.name.toLowerCase();
    const verts = getVerticesForFruit(setId, nameKey);

    let collider: RAPIER_TYPE.Collider;

    if (verts && verts.length >= 3) {
      const flat = new Float32Array(verts.length * 2);
      verts.forEach(({ x: vx, y: vy }, i) => {
        flat[i * 2] = vx * def.radius * SCALE;
        flat[i * 2 + 1] = vy * def.radius * SCALE;
      });
      const hullDesc = R.ColliderDesc.convexHull(flat);
      const desc = hullDesc
        ? hullDesc
            .setRestitution(FRUIT_RESTITUTION)
            .setFriction(FRUIT_FRICTION)
            .setDensity(FRUIT_DENSITY)
            .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS)
        : R.ColliderDesc.ball(def.radius * SCALE)
            .setRestitution(FRUIT_RESTITUTION)
            .setFriction(FRUIT_FRICTION)
            .setDensity(FRUIT_DENSITY)
            .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      collider = world.createCollider(desc, rb);
    } else {
      collider = world.createCollider(
        R.ColliderDesc.ball(def.radius * SCALE)
          .setRestitution(FRUIT_RESTITUTION)
          .setFriction(FRUIT_FRICTION)
          .setDensity(FRUIT_DENSITY)
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        rb
      );
    }

    const fb: FruitBody = {
      handle: rb.handle,
      fruitTier: def.tier,
      fruitSetId: setId,
      isMerging: false,
      createdAt: Date.now(),
      fruitRadius: def.radius,
      collisionVerts: verts,
    };
    fruitMap.set(rb.handle, fb);
    colliderToBody.set(collider.handle, rb.handle);
    return fb;
  }

  function removeBody(bodyHandle: number): void {
    const rb = world.getRigidBody(bodyHandle);
    if (rb) {
      // Unmap all colliders attached to this body
      const numColliders = rb.numColliders();
      for (let i = 0; i < numColliders; i++) {
        const c = rb.collider(i);
        colliderToBody.delete(c.handle);
      }
      world.removeRigidBody(rb);
    }
    fruitMap.delete(bodyHandle);
  }

  function processMerges(): void {
    if (mergeQueue.length > 0) {
      console.log(`[Engine] processMerges queueLen=${mergeQueue.length} t=${Date.now()}`);
    }
    for (const [ha, hb] of mergeQueue) {
      const fa = fruitMap.get(ha);
      const fb = fruitMap.get(hb);
      if (!fa || !fb || fa.isMerging || fb.isMerging) continue;
      if (fa.fruitTier !== fb.fruitTier) continue;

      fa.isMerging = true;
      fb.isMerging = true;

      const tier = fa.fruitTier;
      const rba = world.getRigidBody(ha);
      const rbb = world.getRigidBody(hb);
      if (!rba || !rbb) continue;

      const posA = rba.translation();
      const posB = rbb.translation();
      const midX = (posA.x + posB.x) / 2 / SCALE; // back to pixels
      const midY = (posA.y + posB.y) / 2 / SCALE;
      console.log(`[Engine] merge tier=${tier} midX=${midX.toFixed(0)} midY=${midY.toFixed(0)}`);

      removeBody(ha);
      removeBody(hb);
      onMerge({ tier, x: midX, y: midY });

      if (tier < 10) {
        const nextDef = fruitSet.fruits[(tier + 1) as FruitTier];
        spawnAt(nextDef, fruitSet.id, midX, midY, "merge");
      }
    }
    mergeQueue.length = 0;
  }

  let disposed = false;
  let stepCount = 0;

  return {
    step(dt?: number): BodySnapshot[] {
      if (disposed) return [];
      stepCount += 1;
      const countBefore = fruitMap.size;

      if (dt !== undefined) {
        // Clamp: min 1/120s (avoid micro-steps), max 1/30s (avoid spiral of death on slow frames)
        world.integrationParameters.dt = Math.max(1 / 120, Math.min(dt, 1 / 30));
      }
      world.step(eventQueue);

      // Drain collision events → queue same-tier pairs for merging
      eventQueue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
        if (!started) return;
        const rbh1 = colliderToBody.get(h1);
        const rbh2 = colliderToBody.get(h2);
        if (rbh1 === undefined || rbh2 === undefined) return;
        const fa = fruitMap.get(rbh1);
        const fb = fruitMap.get(rbh2);
        if (!fa || !fb || fa.isMerging || fb.isMerging) return;
        if (fa.fruitTier === fb.fruitTier) {
          mergeQueue.push([rbh1, rbh2]);
        }
      });

      processMerges();

      // Game-over: a settled fruit (past grace period) with its top above the danger line
      if (!gameOverFired) {
        const now = Date.now();
        fruitMap.forEach((fb, handle) => {
          if (gameOverFired || fb.isMerging) return;
          if (now - fb.createdAt < GAME_OVER_GRACE_MS) return;
          const rb = world.getRigidBody(handle);
          if (!rb) return;
          const pos = rb.translation();
          const topY = pos.y / SCALE - fb.fruitRadius; // top edge in pixels
          if (topY < dangerY) {
            gameOverFired = true;
            onGameOver();
          }
        });
      }

      // Per-step fruit-count delta check
      const delta = fruitMap.size - countBefore;
      if (delta > 1) {
        console.warn(
          `[Engine] step added ${delta} fruits in one tick — expected 1 from a single player drop`
        );
      }

      // Periodic bin snapshot (~5 s at 60 fps)
      if (stepCount % 300 === 0) {
        const tierCounts: Record<number, number> = {};
        fruitMap.forEach((fb) => {
          tierCounts[fb.fruitTier] = (tierCounts[fb.fruitTier] ?? 0) + 1;
        });
        console.log("[Engine] bin snapshot", tierCounts, "total=", fruitMap.size);
      }

      // Collect body snapshots (pixel coordinates) and detect boundary escapes
      const snapshots: BodySnapshot[] = [];
      const escapedHandles: number[] = [];
      fruitMap.forEach((fb, handle) => {
        const rb = world.getRigidBody(handle);
        if (!rb) return;
        const pos = rb.translation();
        const px = pos.x / SCALE;
        const py = pos.y / SCALE;

        // Detect bodies that have escaped the play area (with margin)
        const margin = fb.fruitRadius * 2;
        if (px < -margin || px > W + margin || py > H + margin) {
          escapedHandles.push(handle);
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
          id: handle,
          x: px,
          y: py,
          tier: fb.fruitTier,
          angle: rb.rotation(),
          collisionVerts: fb.collisionVerts,
        });
      });
      // Clean up escaped bodies
      for (const h of escapedHandles) {
        removeBody(h);
      }
      return snapshots;
    },

    drop(def: FruitDefinition, fruitSetId: string, x: number, y: number): void {
      spawnAt(def, fruitSetId, x, y);
    },

    cleanup(): void {
      disposed = true;
      fruitMap.clear();
      colliderToBody.clear();
      try {
        eventQueue.free();
      } catch {
        /* already freed */
      }
      try {
        world.free();
      } catch {
        /* already freed */
      }
    },
  };
}

/**
 * Convenience wrapper kept for backward compatibility with canvas components.
 * Prefer calling engineHandle.drop() directly.
 */
export function dropFruit(
  engineHandle: EngineHandle,
  def: FruitDefinition,
  fruitSetId: string,
  x: number,
  spawnY: number
): void {
  engineHandle.drop(def, fruitSetId, x, spawnY);
}
