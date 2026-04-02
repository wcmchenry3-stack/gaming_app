import { FruitDefinition, FruitTier } from "../../theme/fruitSets";

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
  /** Advance physics one step and return current body positions in pixels. */
  step: (dt?: number) => BodySnapshot[];
  /** Drop a fruit at the given pixel coordinates. */
  drop: (def: FruitDefinition, fruitSetId: string, x: number, y: number) => void;
  cleanup: () => void;
}

/** Legacy alias used by tests and components */
export type EngineSetup = EngineHandle;
