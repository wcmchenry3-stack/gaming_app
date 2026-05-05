import { FruitDefinition, FruitTier } from "../../theme/fruitSets.engine";
import type { GameEvent } from "./types";

// --- Canonical physics world dimensions (px) ---
// Physics always runs at this fixed size. The renderer scales the canvas to fit
// the device container — see CascadeScreen for the scale computation.
export const WORLD_W = 400;
export const WORLD_H = 700;

// --- Layout constants ---
export const WALL_THICKNESS = 16;
/** 18% from top — game over if settled fruit crosses this */
export const DANGER_LINE_RATIO = 0.18;
export const GAME_OVER_GRACE_MS = 3000;

// --- Physics tuning constants ---
/** Low restitution = THUD feel (original Suika); fruits barely bounce. */
export const FRUIT_RESTITUTION = 0.1;
/** Moderate friction = fruits grip each other and settle into place. */
export const FRUIT_FRICTION = 0.3;
export const FRUIT_DENSITY = 1.0;

// --- Rapier-specific constants (used only by engine.ts / web) ---
export const SCALE = 0.01;
export const GRAVITY_Y = 14.0;

// --- Fixed physics timestep ---
/** Fixed physics sub-step duration (ms). Both engines run at 60 Hz regardless of frame rate. */
export const FIXED_STEP_MS = 1000 / 60;

// --- Solver iteration counts ---
// O(N × iterations) cost per step — raise to fix penetration in deep stacks,
// lower if the physics budget grows tight on low-end devices.
// Validated against 15-deep piles; these counts resolve cleanly without visible jitter.
/** Rapier constraint solver iterations (default 4). 8 resolves 15-deep stacks cleanly. */
export const RAPIER_SOLVER_ITERATIONS = 8;
/** Matter.js position correction iterations (default 6). 10 prevents jitter in deep stacks. */
export const MATTER_POSITION_ITERATIONS = 10;
/** Matter.js velocity correction iterations (default 4). 6 matches Rapier's constraint budget. */
export const MATTER_VELOCITY_ITERATIONS = 6;

// --- Body sleeping ---
/** Ticks of low velocity before a Matter.js body sleeps (default 60 ≈ 1 s at 60 Hz). */
export const MATTER_SLEEP_THRESHOLD = 60;

// --- Terminal velocity guard ---
/** Max fruit speed in px/s. Tier-0 at 1200 px/s travels 20 px per 1/60s frame — within CCD range. */
export const MAX_FRUIT_SPEED_PX_S = 1200;

// --- Shared interfaces ---

export interface FruitBody {
  handle: number;
  fruitTier: FruitTier;
  fruitSetId: string;
  isMerging: boolean;
  createdAt: number;
  fruitRadius: number; // in pixels
  /** Normalized collision hull vertices in [-1, 1] per axis, matching sprite rendering.
   *  Multiply by fruitRadius to get pixel-space polygon. */
  collisionVerts: { x: number; y: number }[] | null;
}

export interface BodySnapshot {
  id: number;
  x: number; // pixels
  y: number; // pixels
  tier: number;
  angle: number; // radians
  /** Normalized collision vertices for debug overlay (null = circle fallback). */
  collisionVerts: { x: number; y: number }[] | null;
}

export interface MergeEvent {
  tier: FruitTier;
  x: number; // pixels
  y: number; // pixels
}

export interface EngineHandle {
  /** Advance physics one step and return snapshots + any game events that fired. */
  step: (dt?: number) => { snapshots: BodySnapshot[]; events: GameEvent[] };
  /** Drop a fruit at the given pixel coordinates. */
  drop: (def: FruitDefinition, fruitSetId: string, x: number, y: number) => void;
  cleanup: () => void;
}

/** Legacy alias used by tests and components */
export type EngineSetup = EngineHandle;
