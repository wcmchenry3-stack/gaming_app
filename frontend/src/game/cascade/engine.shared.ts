import { FruitDefinition, FruitTier } from "../../theme/fruitSets";
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
