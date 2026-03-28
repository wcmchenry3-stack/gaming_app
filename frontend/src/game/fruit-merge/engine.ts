import { FruitDefinition, FruitSet, FruitTier } from "../../theme/fruitSets";
import { getVerticesForFruit } from "./fruitVertices";

export const WALL_THICKNESS = 16;
// Fruits drop into the top of the container; danger line sits below the drop zone
export const DANGER_LINE_RATIO = 0.18; // 18% from top — game over if settled fruit crosses this
const GAME_OVER_GRACE_MS = 3000; // ignore newly-dropped fruit for 3 seconds

// --- Physics tuning constants ---
// Low restitution = THUD feel (original Suika); fruits barely bounce.
// Moderate friction = fruits grip each other and settle into place.
const FRUIT_RESTITUTION = 0.1;
const FRUIT_FRICTION = 0.3;
const FRUIT_DENSITY = 1.0;

// Scale factor: 1 Rapier unit = SCALE pixels.
// Using SI-like units (100px ≈ 1m) with standard gravity gives natural fall speed.
const SCALE = 0.01; // px → Rapier units (÷ by SCALE when reading back)
const GRAVITY_Y = 14.0; // m/s² in Rapier units (~1.4g) — tune visually if needed

export interface FruitBody {
  handle: number; // Rapier rigid body handle
  fruitTier: FruitTier;
  fruitSetId: string;
  isMerging: boolean;
  createdAt: number;
  fruitRadius: number; // in pixels
}

export interface BodySnapshot {
  id: number;
  x: number; // pixels
  y: number; // pixels
  tier: number;
  angle: number; // radians
}

export interface MergeEvent {
  tier: FruitTier;
  x: number; // pixels
  y: number; // pixels
}

export interface EngineHandle {
  /** Advance physics one step and return current body positions in pixels.
   *  @param dt  Elapsed time in seconds since the last step. When provided,
   *             overrides Rapier's fixed timestep so physics runs at wall-clock
   *             speed regardless of display refresh rate. */
  step: (dt?: number) => BodySnapshot[];
  /** Drop a fruit at the given pixel coordinates. */
  drop: (def: FruitDefinition, fruitSetId: string, x: number, y: number) => void;
  cleanup: () => void;
}

// Legacy alias used by tests and components
export type EngineSetup = EngineHandle;

// Import type only for typing purposes (no runtime import at module level)
import type RAPIER_TYPE from "@dimforge/rapier2d-compat";
type RapierLib = typeof RAPIER_TYPE;

// WASM is loaded lazily on first createEngine call; promise is cached after that.
// Uses require() rather than import() so Jest's module mock system intercepts it.
let _rapierPromise: Promise<RapierLib> | null = null;
async function getRapier(): Promise<RapierLib> {
  if (!_rapierPromise) {
    _rapierPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@dimforge/rapier2d-compat") as { default?: RapierLib } | RapierLib;
      const R = (mod as { default?: RapierLib }).default ?? (mod as RapierLib);
      await R.init();
      return R;
    })();
  }
  return _rapierPromise;
}

export async function createEngine(
  W: number,
  H: number,
  fruitSet: FruitSet,
  onMerge: (event: MergeEvent) => void,
  onGameOver: () => void
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

  function spawnAt(def: FruitDefinition, setId: string, x: number, y: number): FruitBody {
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
      const midX = ((posA.x + posB.x) / 2) / SCALE; // back to pixels
      const midY = ((posA.y + posB.y) / 2) / SCALE;

      removeBody(ha);
      removeBody(hb);
      onMerge({ tier, x: midX, y: midY });

      if (tier < 10) {
        const nextDef = fruitSet.fruits[(tier + 1) as FruitTier];
        spawnAt(nextDef, fruitSet.id, midX, midY);
      }
    }
    mergeQueue.length = 0;
  }

  return {
    step(dt?: number): BodySnapshot[] {
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

      // Collect body snapshots (pixel coordinates)
      const snapshots: BodySnapshot[] = [];
      fruitMap.forEach((fb, handle) => {
        const rb = world.getRigidBody(handle);
        if (!rb) return;
        const pos = rb.translation();
        snapshots.push({
          id: handle,
          x: pos.x / SCALE,
          y: pos.y / SCALE,
          tier: fb.fruitTier,
          angle: rb.rotation(),
        });
      });
      return snapshots;
    },

    drop(def: FruitDefinition, fruitSetId: string, x: number, y: number): void {
      spawnAt(def, fruitSetId, x, y);
    },

    cleanup(): void {
      fruitMap.clear();
      colliderToBody.clear();
      eventQueue.free();
      world.free();
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
