export type EnemyTier = "Grunt" | "Elite" | "Boss";

/** Four-state AI machine + SwoopIn entry animation. */
export type EnemyPhase =
  | "SwoopIn" // following Bézier path onto screen into formation slot
  | "Formation" // holding grid position
  | "Diving" // heading toward player's captured X
  | "Circling" // looping around a fixed center point
  | "Returning"; // following Bézier path back to formation slot

export type GamePhase =
  | "SwoopIn" // wave intro — enemies filling the grid
  | "Playing" // normal combat
  | "ChallengingStage" // non-hostile bonus wave
  | "WaveClear" // brief pause before next wave
  | "GameOver";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface CubicBezier {
  readonly p0: Vec2;
  readonly p1: Vec2;
  readonly p2: Vec2;
  readonly p3: Vec2;
}

export interface Enemy {
  readonly id: number;
  readonly tier: EnemyTier;
  readonly phase: EnemyPhase;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Target formation grid center. */
  readonly formationX: number;
  readonly formationY: number;
  /** Active Bézier path (SwoopIn / Returning phases). */
  readonly path: CubicBezier | null;
  /**
   * Progress along `path` (0–1).
   * Negative values encode stagger delay: enemy stays at p0 until pathT >= 0.
   */
  readonly pathT: number;
  /** Duration (ms) to traverse `path` from t=0 to t=1. */
  readonly pathDuration: number;
  /** Velocity vector used in Diving phase (px/ms). */
  readonly vel: Vec2;
  /** Circle center (Circling phase). */
  readonly circleCx: number;
  readonly circleCy: number;
  readonly circleRadius: number;
  /** Current angle on circle in radians (Circling phase). */
  readonly circleAngle: number;
  /** Angular speed rad/ms (Circling phase). */
  readonly circleSpeed: number;
  /** ms until this enemy fires next (Formation phase only). */
  readonly shootTimer: number;
  /** Player X captured when dive was initiated. */
  readonly diveTargetX: number;
  readonly hp: number;
  readonly isAlive: boolean;
}

export interface Bullet {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly owner: "player" | "enemy";
  readonly width: number;
  readonly height: number;
  readonly damage: number;
}

export interface Player {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lives: number;
  /** Post-spawn invincibility ms remaining; player cannot be hit while > 0. */
  readonly invincibleTimer: number;
  /** ms until player can fire again. */
  readonly shootCooldown: number;
}

export interface Explosion {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Current frame index (0–19). */
  readonly frame: number;
  /** ms until next frame advance. */
  readonly frameTimer: number;
}

export interface StarSwarmState {
  readonly phase: GamePhase;
  readonly wave: number;
  readonly score: number;
  readonly player: Player;
  readonly enemies: readonly Enemy[];
  readonly playerBullets: readonly Bullet[];
  readonly enemyBullets: readonly Bullet[];
  readonly explosions: readonly Explosion[];
  /** General-purpose countdown timer (WaveClear pause, etc.). */
  readonly phaseTimer: number;
  readonly canvasW: number;
  readonly canvasH: number;
  /** Hits accumulated during the current Challenging Stage. */
  readonly challengingHits: number;
  /** ms until the next dive-AI trigger fires. */
  readonly nextDiveTimer: number;
  /** Current left/right sway offset applied to all Formation enemies (px). */
  readonly formationSwayX: number;
  /** Direction the formation is currently travelling: +1 = right, -1 = left. */
  readonly formationSwayDir: 1 | -1;
}

/** Input snapshot consumed by each `tick` call. */
export interface StarSwarmInput {
  /** Desired player center X in logical canvas pixels. */
  readonly playerX: number;
  /** true while auto-fire is active. */
  readonly fire: boolean;
  /** One-shot: fire a charge bullet this tick (Controls resets to false after one frame). */
  readonly chargeShot: boolean;
}
