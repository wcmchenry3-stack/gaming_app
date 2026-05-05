import { FruitDefinition, FruitSet, FruitTier } from "../../theme/fruitSets.engine";
import { getVerticesForFruit } from "./fruitVertices";

// Re-export all shared types and constants so existing imports from './engine' keep working
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
  FIXED_STEP_MS,
  RAPIER_SOLVER_ITERATIONS,
  MATTER_POSITION_ITERATIONS,
  MATTER_VELOCITY_ITERATIONS,
  MATTER_SLEEP_THRESHOLD,
  MAX_FRUIT_SPEED_PX_S,
} from "./engine.shared";
export type {
  FruitBody,
  BodySnapshot,
  MergeEvent,
  EngineHandle,
  EngineSetup,
} from "./engine.shared";
export type { GameEvent } from "./types";

import {
  GAME_OVER_GRACE_MS,
  FRUIT_RESTITUTION,
  FRUIT_FRICTION,
  FRUIT_DENSITY,
  SCALE,
  GRAVITY_Y,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
  FIXED_STEP_MS,
  RAPIER_SOLVER_ITERATIONS,
  MAX_FRUIT_SPEED_PX_S,
} from "./engine.shared";
import type { FruitBody, BodySnapshot, EngineHandle } from "./engine.shared";
import type { GameEvent } from "./types";

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

/** @deprecated Callbacks removed in #834 — events now returned from step(). Kept for type compat. */
export interface BoundaryEscapeEvent {
  tier: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Merges in a chain needed before a cascadeCombo event fires. */
const COMBO_THRESHOLD = 3;

export async function createEngine(
  W: number,
  H: number,
  fruitSet: FruitSet
): Promise<EngineHandle> {
  const R = await getRapier();

  const world = new R.World({ x: 0.0, y: GRAVITY_Y });
  // Rapier defaults to 4 solver iterations; 8 resolves penetration in 15-deep stacks.
  world.integrationParameters.numSolverIterations = RAPIER_SOLVER_ITERATIONS;
  // Fix the timestep so every sub-step runs at exactly 60 Hz.
  world.integrationParameters.dt = FIXED_STEP_MS / 1000;
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
  let comboMergeCount = 0;
  let comboFired = false;
  // Accumulator for the fixed-step loop; carries leftover ms across frames.
  let accumulatorMs = 0;

  // Merges are queued during collision events and processed synchronously after draining.
  // The third element is the tier snapshotted at enqueue time; processMerges re-verifies
  // both body tiers against this snapshot to guard against Rapier arena handle reuse
  // (a body removed during a merge can have its handle recycled for the newly spawned
  // body, making fruitMap.get(handle) return the wrong tier in subsequent queue entries).
  const mergeQueue: Array<[number, number, number]> = []; // [handleA, handleB, tier]

  function spawnAt(def: FruitDefinition, setId: string, x: number, y: number): FruitBody {
    const rbDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(x * SCALE, y * SCALE)
      .setCcdEnabled(true)
      .setCanSleep(true);
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

  function processMerges(events: GameEvent[]): void {
    for (const [ha, hb, enqueuedTier] of mergeQueue) {
      const fa = fruitMap.get(ha);
      const fb = fruitMap.get(hb);
      if (!fa || !fb || fa.isMerging || fb.isMerging) continue;
      // Re-verify tiers against the snapshot captured at enqueue time.
      // Rapier's generational arena can reuse a handle after removeRigidBody,
      // so fruitMap.get(ha) may now point to a newly spawned body with a
      // different tier — causing a phantom cross-tier merge if unchecked.
      if (fa.fruitTier !== enqueuedTier || fb.fruitTier !== enqueuedTier) continue;

      fa.isMerging = true;
      fb.isMerging = true;

      const tier = enqueuedTier;
      const rba = world.getRigidBody(ha);
      const rbb = world.getRigidBody(hb);
      if (!rba || !rbb) continue;

      const posA = rba.translation();
      const posB = rbb.translation();
      const midX = (posA.x + posB.x) / 2 / SCALE; // back to pixels
      const midY = (posA.y + posB.y) / 2 / SCALE;

      removeBody(ha);
      removeBody(hb);
      events.push({ type: "fruitMerge", tier, x: midX, y: midY });

      if (tier < 10) {
        const nextDef = fruitSet.fruits[(tier + 1) as FruitTier];
        if (nextDef !== undefined) {
          const newFb = spawnAt(nextDef, fruitSet.id, midX, midY);
          // Wake any sleeping neighbors within 2× spawn radius so they react to the new body.
          const wakeRadiusSq = (nextDef.radius * 2) ** 2;
          fruitMap.forEach((_fb2, wHandle) => {
            if (wHandle === newFb.handle) return;
            const wrb = world.getRigidBody(wHandle);
            if (!wrb) return;
            const wpos = wrb.translation();
            const dx = wpos.x / SCALE - midX;
            const dy = wpos.y / SCALE - midY;
            if (dx * dx + dy * dy < wakeRadiusSq) {
              wrb.wakeUp();
            }
          });
        }
      }
    }
    mergeQueue.length = 0;
  }

  let disposed = false;

  return {
    step(dt?: number): { snapshots: BodySnapshot[]; events: GameEvent[] } {
      if (disposed) return { snapshots: [], events: [] };
      const countBefore = fruitMap.size;

      const events: GameEvent[] = [];

      // Fixed-step accumulator: clamp total elapsed to 1/6 s to prevent a spiral of death
      // on backgrounded tabs, then consume whole 60 Hz sub-steps from the accumulator.
      // Using ms throughout avoids the float-precision gap between 1/60*1000 and 1000/60.
      const rawElapsedMs = Math.min((dt ?? 1 / 60) * 1000, 1000 / 6);
      accumulatorMs += rawElapsedMs;
      while (accumulatorMs >= FIXED_STEP_MS - 0.001) {
        world.step(eventQueue);
        accumulatorMs = Math.max(0, accumulatorMs - FIXED_STEP_MS);
      }

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
          mergeQueue.push([rbh1, rbh2, fa.fruitTier]); // snapshot tier at enqueue
        }
      });

      // Capture merge count before processing (processMerges clears the queue).
      const mergesThisStep = mergeQueue.length;
      processMerges(events);

      // Cascade combo: fire when a chain of consecutive-step merges reaches COMBO_THRESHOLD.
      if (mergesThisStep > 0) {
        comboMergeCount += mergesThisStep;
        if (!comboFired && comboMergeCount >= COMBO_THRESHOLD) {
          events.push({ type: "cascadeCombo", count: comboMergeCount });
          comboFired = true;
        }
      } else {
        comboMergeCount = 0;
        comboFired = false;
      }

      // Velocity clamp: prevent unbounded free-fall from producing tunneling speeds.
      // Runs after the sub-step loop; maxPhysSpeed is in Rapier physics units/s (px/s × SCALE).
      {
        const maxPhysSpeed = MAX_FRUIT_SPEED_PX_S * SCALE;
        const maxPhysSpeedSq = maxPhysSpeed * maxPhysSpeed;
        fruitMap.forEach((_fb, handle) => {
          const rb = world.getRigidBody(handle);
          if (!rb) return;
          const vel = rb.linvel();
          const speedSq = vel.x * vel.x + vel.y * vel.y;
          if (speedSq > maxPhysSpeedSq) {
            const factor = maxPhysSpeed / Math.sqrt(speedSq);
            rb.setLinvel({ x: vel.x * factor, y: vel.y * factor }, true);
          }
        });
      }

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
            events.push({ type: "gameOver" });
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

      // Collect body snapshots (pixel coordinates) and detect boundary escapes
      const snapshots: BodySnapshot[] = [];
      const escapedHandles: number[] = [];
      fruitMap.forEach((fb, handle) => {
        const rb = world.getRigidBody(handle);
        if (!rb) return;
        const pos = rb.translation();
        const px = pos.x / SCALE;
        const py = pos.y / SCALE;

        // Bodies escaping the play area are silently removed.
        const margin = fb.fruitRadius * 2;
        if (px < -margin || px > W + margin || py > H + margin) {
          console.warn(
            `[Engine] boundary escape tier=${fb.fruitTier} px=${Math.round(px)} py=${Math.round(py)}`
          );
          escapedHandles.push(handle);
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
      return { snapshots, events };
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
