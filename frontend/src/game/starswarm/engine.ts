import type {
  StarSwarmState,
  Enemy,
  Bullet,
  Explosion,
  Player,
  Vec2,
  CubicBezier,
  EnemyTier,
  StarSwarmInput,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CANVAS_W = 360;
export const CANVAS_H = 640;

const PLAYER_W = 34;
const PLAYER_H = 34;
const PLAYER_Y_FROM_BOTTOM = 72;
const PLAYER_SHOOT_COOLDOWN = 280; // ms
const PLAYER_INVINCIBLE_MS = 2600; // ms of post-spawn invincibility

const BULLET_P_W = 5;
const BULLET_P_H = 14;
const BULLET_P_VY = -0.56; // px/ms upward

export const BULLET_C_W = 12; // charge shot — wider
const BULLET_C_H = 22;
export const CHARGE_SHOOT_COOLDOWN = 900; // ms; longer cooldown than auto-fire

const BULLET_E_W = 5;
const BULLET_E_H = 10;
const BULLET_E_VY = 0.2; // px/ms downward

const FORMATION_COLS = 8;
const FORMATION_COL_W = 38;
const FORMATION_ROW_H = 46;
const FORMATION_TOP = 90;

const SWOOP_DURATION = 1400; // ms per enemy traversal
const SWOOP_STAGGER = 55; // ms delay between successive enemies

const DIVE_SPEED = 0.27; // px/ms
const CIRCLE_RADIUS = 42;
const CIRCLE_SPEED = 0.0032; // rad/ms
const RETURN_DURATION = 1900; // ms for return path

const DIVE_INTERVAL_BASE = 3200; // ms between dive triggers
const DIVE_INTERVAL_MIN = 900; // floor regardless of wave

const WAVE_CLEAR_PAUSE = 1600; // ms
const CHALLENGING_CLEAR_PAUSE = 2200; // ms

const SHOOT_INTERVAL_BASE = 2600; // ms base
const SHOOT_INTERVAL_JITTER = 1400; // ms random addend

const EXPLOSION_FRAME_MS = 28;
const EXPLOSION_FRAMES = 20;

const WAVE_CLEAR_BONUS_BASE = 500;

// Score diving enemies get a 2× multiplier.
const DIVE_SCORE_MULT = 2;

// #923 Formation sway
const SWAY_SPEED_BASE = 0.03; // px/ms at wave 1
const SWAY_SPEED_PER_WAVE = 0.008; // px/ms added per wave
const MAX_SWAY = 40; // max offset from center in px

// #924 Aimed shots
const AIMED_SHOT_WAVE_START = 4;
const AIMED_SHOT_FRACTION = 0.25; // 25% of shots aimed at wave 4, +5% per wave, cap 60%

const TIER_SCORE: Record<EnemyTier, number> = { Grunt: 100, Elite: 200, Boss: 400 };
const TIER_HP: Record<EnemyTier, number> = { Grunt: 1, Elite: 2, Boss: 3 };
const TIER_SIZE: Record<EnemyTier, { w: number; h: number }> = {
  Grunt: { w: 24, h: 24 },
  Elite: { w: 28, h: 28 },
  Boss: { w: 36, h: 32 },
};

// ---------------------------------------------------------------------------
// LCG RNG — deterministic and seedable for tests
// ---------------------------------------------------------------------------

let _seed = 42;

export function seedRng(seed: number): void {
  _seed = seed >>> 0;
}

function rng(): number {
  _seed = (Math.imul(1664525, _seed) + 1013904223) >>> 0;
  return _seed / 0xffffffff;
}

// ---------------------------------------------------------------------------
// ID counter
// ---------------------------------------------------------------------------

let _nextId = 1;

function nextId(): number {
  return _nextId++;
}

/** Reset for testing only. */
export function _resetIds(): void {
  _nextId = 1;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function evalCubic(c: CubicBezier, t: number): Vec2 {
  const u = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: u3 * c.p0.x + 3 * u2 * t * c.p1.x + 3 * u * t2 * c.p2.x + t3 * c.p3.x,
    y: u3 * c.p0.y + 3 * u2 * t * c.p1.y + 3 * u * t2 * c.p2.y + t3 * c.p3.y,
  };
}

/** AABB overlap — positions are centers, w/h are full extents. */
function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return (
    ax - aw / 2 < bx + bw / 2 &&
    ax + aw / 2 > bx - bw / 2 &&
    ay - ah / 2 < by + bh / 2 &&
    ay + ah / 2 > by - bh / 2
  );
}

// ---------------------------------------------------------------------------
// Formation layout helpers
// ---------------------------------------------------------------------------

interface SlotDef {
  tier: EnemyTier;
  row: number;
  col: number;
  rowCols: number;
}

function waveSlots(wave: number): SlotDef[] {
  const slots: SlotDef[] = [];

  // Boss row: 4 enemies, centered
  for (let c = 0; c < 4; c++) slots.push({ tier: "Boss", row: 0, col: c, rowCols: 4 });

  // Two Elite rows
  for (let r = 1; r <= 2; r++)
    for (let c = 0; c < FORMATION_COLS; c++)
      slots.push({ tier: "Elite", row: r, col: c, rowCols: FORMATION_COLS });

  // Grunt rows: 2 at wave 1, +1 every other wave, max 5
  const gruntRows = Math.min(2 + Math.floor((wave - 1) / 2), 5);
  for (let r = 3; r < 3 + gruntRows; r++)
    for (let c = 0; c < FORMATION_COLS; c++)
      slots.push({ tier: "Grunt", row: r, col: c, rowCols: FORMATION_COLS });

  return slots;
}

function slotToWorld(slot: SlotDef, canvasW: number): { fx: number; fy: number } {
  const rowWidth = slot.rowCols * FORMATION_COL_W;
  const left = (canvasW - rowWidth) / 2 + FORMATION_COL_W / 2;
  return {
    fx: left + slot.col * FORMATION_COL_W,
    fy: FORMATION_TOP + slot.row * FORMATION_ROW_H,
  };
}

// ---------------------------------------------------------------------------
// Path factories
// ---------------------------------------------------------------------------

function swoopPath(idx: number, fx: number, fy: number, canvasW: number): CubicBezier {
  const fromLeft = idx % 2 === 0;
  const p0: Vec2 = fromLeft ? { x: -40, y: -50 } : { x: canvasW + 40, y: -50 };
  const p1: Vec2 = fromLeft
    ? { x: canvasW * 0.72, y: CANVAS_H * 0.32 }
    : { x: canvasW * 0.28, y: CANVAS_H * 0.32 };
  const p2: Vec2 = { x: fx + (fromLeft ? -55 : 55), y: fy + 70 };
  const p3: Vec2 = { x: fx, y: fy };
  return { p0, p1, p2, p3 };
}

function returnPath(ex: number, ey: number, fx: number, fy: number): CubicBezier {
  const jitter = rng() * 50 - 25;
  return {
    p0: { x: ex, y: ey },
    p1: { x: (ex + fx) / 2, y: ey - 110 },
    p2: { x: fx + jitter, y: fy + 55 },
    p3: { x: fx, y: fy },
  };
}

function challengePath(idx: number, total: number, canvasW: number, canvasH: number): CubicBezier {
  const col = idx % FORMATION_COLS;
  const startX = (canvasW / FORMATION_COLS) * col + canvasW / (FORMATION_COLS * 2);
  const amp = canvasW * 0.28;
  const sign = idx % 2 === 0 ? 1 : -1;
  return {
    p0: { x: startX, y: -60 - Math.floor(idx / FORMATION_COLS) * 55 },
    p1: { x: Math.min(canvasW - 20, Math.max(20, startX + sign * amp)), y: canvasH * 0.28 },
    p2: { x: Math.min(canvasW - 20, Math.max(20, startX - sign * amp)), y: canvasH * 0.62 },
    p3: { x: startX, y: canvasH + 80 },
  };
}

// ---------------------------------------------------------------------------
// Enemy factories
// ---------------------------------------------------------------------------

function makeEnemy(idx: number, slot: SlotDef, canvasW: number): Enemy {
  const { fx, fy } = slotToWorld(slot, canvasW);
  const size = TIER_SIZE[slot.tier];
  const path = swoopPath(idx, fx, fy, canvasW);
  const p0 = evalCubic(path, 0);
  const delay = (idx * SWOOP_STAGGER) / SWOOP_DURATION;

  return {
    id: nextId(),
    tier: slot.tier,
    phase: "SwoopIn",
    x: p0.x,
    y: p0.y,
    width: size.w,
    height: size.h,
    formationX: fx,
    formationY: fy,
    path,
    pathT: -delay, // negative = waiting; advances to 0 before path traversal begins
    pathDuration: SWOOP_DURATION,
    vel: { x: 0, y: 0 },
    circleCx: 0,
    circleCy: 0,
    circleRadius: CIRCLE_RADIUS + rng() * 10,
    circleAngle: 0,
    circleSpeed: CIRCLE_SPEED * (0.85 + rng() * 0.3),
    shootTimer: rng() * (SHOOT_INTERVAL_BASE + SHOOT_INTERVAL_JITTER),
    diveTargetX: 0,
    hp: TIER_HP[slot.tier],
    isAlive: true,
  };
}

function makeChallengeEnemy(idx: number, total: number, canvasW: number, canvasH: number): Enemy {
  const tier: EnemyTier = idx % 6 === 0 ? "Boss" : idx % 3 === 0 ? "Elite" : "Grunt";
  const size = TIER_SIZE[tier];
  const path = challengePath(idx, total, canvasW, canvasH);
  const p0 = evalCubic(path, 0);
  const delay = (idx * 80) / 3200;

  return {
    id: nextId(),
    tier,
    phase: "SwoopIn",
    x: p0.x,
    y: p0.y,
    width: size.w,
    height: size.h,
    formationX: path.p3.x,
    formationY: path.p3.y,
    path,
    pathT: -delay,
    pathDuration: 3200,
    vel: { x: 0, y: 0 },
    circleCx: 0,
    circleCy: 0,
    circleRadius: CIRCLE_RADIUS,
    circleAngle: 0,
    circleSpeed: CIRCLE_SPEED,
    shootTimer: 9_999_999, // never shoots
    diveTargetX: 0,
    hp: TIER_HP[tier],
    isAlive: true,
  };
}

// ---------------------------------------------------------------------------
// Wave helpers
// ---------------------------------------------------------------------------

function diveInterval(wave: number): number {
  return Math.max(DIVE_INTERVAL_MIN, DIVE_INTERVAL_BASE * Math.pow(0.88, wave - 1));
}

function isChallengingWave(wave: number): boolean {
  return wave % 3 === 0;
}

// #926: how many enemies may dive simultaneously at a given wave
function maxDivers(wave: number): number {
  if (wave <= 2) return 1;
  if (wave <= 4) return 2;
  if (wave <= 6) return 3;
  return 4;
}

// #924: compute vx for an enemy bullet — non-zero only at wave 4+
function aimedBulletVx(enemyX: number, playerX: number, wave: number): number {
  if (wave < AIMED_SHOT_WAVE_START) return 0;
  const fraction = Math.min(0.6, AIMED_SHOT_FRACTION + (wave - AIMED_SHOT_WAVE_START) * 0.05);
  if (rng() > fraction) return 0;
  return Math.sign(playerX - enemyX) * BULLET_E_VY * 0.5;
}

// ---------------------------------------------------------------------------
// Public: initStarSwarm
// ---------------------------------------------------------------------------

export function initStarSwarm(
  canvasW: number,
  canvasH: number,
  wave = 1,
  seed = 42
): StarSwarmState {
  seedRng(seed);
  _resetIds();

  const player: Player = {
    x: canvasW / 2,
    y: canvasH - PLAYER_Y_FROM_BOTTOM,
    width: PLAYER_W,
    height: PLAYER_H,
    lives: 3,
    invincibleTimer: 0,
    shootCooldown: 0,
  };

  return buildWaveState(canvasW, canvasH, wave, player, 0);
}

function buildWaveState(
  canvasW: number,
  canvasH: number,
  wave: number,
  player: Player,
  score: number
): StarSwarmState {
  let enemies: Enemy[];
  let phase: StarSwarmState["phase"];

  if (isChallengingWave(wave)) {
    const total = FORMATION_COLS * 3;
    enemies = Array.from({ length: total }, (_, i) =>
      makeChallengeEnemy(i, total, canvasW, canvasH)
    );
    phase = "ChallengingStage";
  } else {
    const slots = waveSlots(wave);
    enemies = slots.map((slot, idx) => makeEnemy(idx, slot, canvasW));
    phase = "SwoopIn";
  }

  return {
    phase,
    wave,
    score,
    player,
    enemies,
    playerBullets: [],
    enemyBullets: [],
    explosions: [],
    phaseTimer: 0,
    canvasW,
    canvasH,
    challengingHits: 0,
    nextDiveTimer: diveInterval(wave),
    formationSwayX: 0,
    formationSwayDir: 1,
  };
}

// ---------------------------------------------------------------------------
// Public: tick
// ---------------------------------------------------------------------------

export function tick(state: StarSwarmState, dtMs: number, input: StarSwarmInput): StarSwarmState {
  if (state.phase === "GameOver") return state;

  if (state.phase === "WaveClear") {
    const timer = state.phaseTimer - dtMs;
    if (timer <= 0) return startNextWave(state);
    return { ...state, phaseTimer: timer };
  }

  let s = tickPlayer(state, dtMs, input);
  s = tickEnemies(s, dtMs);
  s = tickBullets(s, dtMs);
  s = tickCollisions(s);
  s = tickExplosions(s, dtMs);
  s = checkPhaseTransitions(s);
  return s;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function tickPlayer(state: StarSwarmState, dtMs: number, input: StarSwarmInput): StarSwarmState {
  const p = state.player;
  const hw = p.width / 2;
  const newX = Math.max(hw, Math.min(state.canvasW - hw, input.playerX));
  const invincibleTimer = Math.max(0, p.invincibleTimer - dtMs);
  const shootCooldown = Math.max(0, p.shootCooldown - dtMs);

  const player: Player = { ...p, x: newX, invincibleTimer, shootCooldown };

  if (shootCooldown === 0) {
    if (input.chargeShot) {
      const bullet: Bullet = {
        id: nextId(),
        x: newX,
        y: p.y - p.height / 2,
        vx: 0,
        vy: BULLET_P_VY,
        owner: "player",
        width: BULLET_C_W,
        height: BULLET_C_H,
        damage: 2,
      };
      return {
        ...state,
        player: { ...player, shootCooldown: CHARGE_SHOOT_COOLDOWN },
        playerBullets: [...state.playerBullets, bullet],
      };
    }
    if (input.fire) {
      const bullet: Bullet = {
        id: nextId(),
        x: newX,
        y: p.y - p.height / 2,
        vx: 0,
        vy: BULLET_P_VY,
        owner: "player",
        width: BULLET_P_W,
        height: BULLET_P_H,
        damage: 1,
      };
      return {
        ...state,
        player: { ...player, shootCooldown: PLAYER_SHOOT_COOLDOWN },
        playerBullets: [...state.playerBullets, bullet],
      };
    }
  }

  return { ...state, player };
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

interface EnemyTickResult {
  enemy: Enemy;
  bullet: Bullet | null;
}

function tickSingleEnemy(
  enemy: Enemy,
  dtMs: number,
  playerX: number,
  canvasH: number,
  shouldDive: boolean,
  wave: number
): EnemyTickResult {
  if (!enemy.isAlive) return { enemy, bullet: null };

  switch (enemy.phase) {
    case "SwoopIn":
      return tickSwoopIn(enemy, dtMs);
    case "Formation":
      return tickFormation(enemy, dtMs, playerX, shouldDive, wave);
    case "Diving":
      return tickDiving(enemy, dtMs, canvasH);
    case "Circling":
      return tickCircling(enemy, dtMs);
    case "Returning":
      return tickReturning(enemy, dtMs);
  }
}

function tickSwoopIn(enemy: Enemy, dtMs: number): EnemyTickResult {
  const newT = enemy.pathT + dtMs / enemy.pathDuration;

  if (newT < 0) {
    // Still waiting (stagger delay)
    return { enemy: { ...enemy, pathT: newT }, bullet: null };
  }

  if (newT >= 1) {
    // Arrived — snap to formation position
    return {
      enemy: {
        ...enemy,
        phase: "Formation",
        x: enemy.formationX,
        y: enemy.formationY,
        pathT: 1,
        path: null,
      },
      bullet: null,
    };
  }

  const pos = evalCubic(enemy.path!, newT);
  return { enemy: { ...enemy, x: pos.x, y: pos.y, pathT: newT }, bullet: null };
}

function tickFormation(
  enemy: Enemy,
  dtMs: number,
  playerX: number,
  shouldDive: boolean,
  wave: number
): EnemyTickResult {
  const shootTimer = enemy.shootTimer - dtMs;
  let bullet: Bullet | null = null;

  if (shouldDive) {
    return {
      enemy: {
        ...enemy,
        phase: "Diving",
        diveTargetX: playerX,
        vel: { x: 0, y: DIVE_SPEED },
        shootTimer,
      },
      bullet: null,
    };
  }

  if (shootTimer <= 0) {
    bullet = {
      id: nextId(),
      x: enemy.x,
      y: enemy.y + enemy.height / 2,
      vx: aimedBulletVx(enemy.x, playerX, wave),
      vy: BULLET_E_VY,
      owner: "enemy",
      width: BULLET_E_W,
      height: BULLET_E_H,
      damage: 1,
    };
    return {
      enemy: {
        ...enemy,
        shootTimer: SHOOT_INTERVAL_BASE + rng() * SHOOT_INTERVAL_JITTER,
      },
      bullet,
    };
  }

  return { enemy: { ...enemy, shootTimer }, bullet: null };
}

function tickDiving(enemy: Enemy, dtMs: number, canvasH: number): EnemyTickResult {
  // Steer toward diveTargetX
  const dx = enemy.diveTargetX - enemy.x;
  const dist = Math.abs(dx);
  const hSpeed = dist > 2 ? (dx / dist) * DIVE_SPEED * 0.6 : 0;

  const newX = enemy.x + hSpeed * dtMs;
  const newY = enemy.y + DIVE_SPEED * dtMs;

  // Transition to Circling when past 60% of canvas height
  if (newY > canvasH * 0.6) {
    const circleCx = newX;
    const circleCy = newY;
    return {
      enemy: {
        ...enemy,
        phase: "Circling",
        x: newX,
        y: newY,
        circleCx,
        circleCy,
        circleAngle: Math.PI / 2, // start at bottom of circle
        vel: { x: hSpeed, y: DIVE_SPEED },
      },
      bullet: null,
    };
  }

  return { enemy: { ...enemy, x: newX, y: newY, vel: { x: hSpeed, y: DIVE_SPEED } }, bullet: null };
}

function tickCircling(enemy: Enemy, dtMs: number): EnemyTickResult {
  const newAngle = enemy.circleAngle + enemy.circleSpeed * dtMs;
  const newX = enemy.circleCx + Math.cos(newAngle) * enemy.circleRadius;
  const newY = enemy.circleCy + Math.sin(newAngle) * enemy.circleRadius;

  // After ~1 full revolution (2π rad), start returning
  if (newAngle - Math.PI / 2 >= Math.PI * 2) {
    const path = returnPath(newX, newY, enemy.formationX, enemy.formationY);
    return {
      enemy: {
        ...enemy,
        phase: "Returning",
        x: newX,
        y: newY,
        circleAngle: newAngle,
        path,
        pathT: 0,
        pathDuration: RETURN_DURATION,
      },
      bullet: null,
    };
  }

  return { enemy: { ...enemy, x: newX, y: newY, circleAngle: newAngle }, bullet: null };
}

function tickReturning(enemy: Enemy, dtMs: number): EnemyTickResult {
  const newT = enemy.pathT + dtMs / enemy.pathDuration;

  if (newT >= 1) {
    return {
      enemy: {
        ...enemy,
        phase: "Formation",
        x: enemy.formationX,
        y: enemy.formationY,
        pathT: 1,
        path: null,
        shootTimer: SHOOT_INTERVAL_BASE + rng() * SHOOT_INTERVAL_JITTER,
      },
      bullet: null,
    };
  }

  const pos = evalCubic(enemy.path!, newT);
  return { enemy: { ...enemy, x: pos.x, y: pos.y, pathT: newT }, bullet: null };
}

function tickEnemies(state: StarSwarmState, dtMs: number): StarSwarmState {
  // #926 Dive AI: pick up to maxDivers(wave) formation enemies to send diving
  let nextDiveTimer = state.nextDiveTimer;
  const diveIndices = new Set<number>();

  if (state.phase === "Playing") {
    nextDiveTimer -= dtMs;
    if (nextDiveTimer <= 0) {
      nextDiveTimer = diveInterval(state.wave);
      const candidates = state.enemies
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.isAlive && e.phase === "Formation");
      const max = maxDivers(state.wave);
      for (let k = 0; k < max && candidates.length > 0; k++) {
        const pick = Math.floor(rng() * candidates.length);
        diveIndices.add(candidates[pick]!.i);
        candidates.splice(pick, 1);
      }
    }
  }

  // #923 Formation sway: advance offset, bounce at ±MAX_SWAY
  const swaySpeed = SWAY_SPEED_BASE + (state.wave - 1) * SWAY_SPEED_PER_WAVE;
  let swayX = state.formationSwayX + state.formationSwayDir * swaySpeed * dtMs;
  let swayDir = state.formationSwayDir;
  if (swayX >= MAX_SWAY) {
    swayX = MAX_SWAY;
    swayDir = -1;
  } else if (swayX <= -MAX_SWAY) {
    swayX = -MAX_SWAY;
    swayDir = 1;
  }

  const newEnemyBullets: Bullet[] = [...state.enemyBullets];
  let enemies = state.enemies.map((enemy, idx) => {
    const shouldDive = diveIndices.has(idx);
    const result = tickSingleEnemy(
      enemy,
      dtMs,
      state.player.x,
      state.canvasH,
      shouldDive,
      state.wave
    );
    let e = result.enemy;
    // Apply sway offset to enemies holding Formation position
    if (e.isAlive && e.phase === "Formation") {
      e = { ...e, x: e.formationX + swayX };
    }
    if (result.bullet) newEnemyBullets.push(result.bullet);
    return e;
  });

  // #934: challenge enemies follow a path that exits off the bottom; once they
  // cross canvasH they can't be shot, so mark them dead to unblock WaveClear.
  if (state.phase === "ChallengingStage") {
    enemies = enemies.map((e) =>
      e.isAlive && e.y > state.canvasH + 60 ? { ...e, isAlive: false } : e
    );
  }

  return {
    ...state,
    enemies,
    enemyBullets: newEnemyBullets,
    nextDiveTimer,
    formationSwayX: swayX,
    formationSwayDir: swayDir,
  };
}

// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------

function tickBullets(state: StarSwarmState, dtMs: number): StarSwarmState {
  const { canvasW, canvasH } = state;

  const playerBullets = state.playerBullets
    .map((b) => ({ ...b, x: b.x + b.vx * dtMs, y: b.y + b.vy * dtMs }))
    .filter((b) => b.y + b.height / 2 > 0 && b.x > -10 && b.x < canvasW + 10);

  const enemyBullets = state.enemyBullets
    .map((b) => ({ ...b, x: b.x + b.vx * dtMs, y: b.y + b.vy * dtMs }))
    .filter((b) => b.y - b.height / 2 < canvasH && b.x > -10 && b.x < canvasW + 10);

  return { ...state, playerBullets, enemyBullets };
}

// ---------------------------------------------------------------------------
// Collisions
// ---------------------------------------------------------------------------

function spawnExplosion(x: number, y: number): Explosion {
  return { id: nextId(), x, y, frame: 0, frameTimer: EXPLOSION_FRAME_MS };
}

function tickCollisions(state: StarSwarmState): StarSwarmState {
  const { player } = state;
  let { score, challengingHits } = state;
  const newExplosions: Explosion[] = [...state.explosions];

  // ── Player bullets ↔ enemies ──────────────────────────────────────────────
  const hitBulletIds = new Set<number>();
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.isAlive) return enemy;

    for (const b of state.playerBullets) {
      if (hitBulletIds.has(b.id)) continue;
      if (!aabb(b.x, b.y, b.width, b.height, enemy.x, enemy.y, enemy.width, enemy.height)) continue;

      hitBulletIds.add(b.id);
      const newHp = enemy.hp - b.damage;

      if (newHp <= 0) {
        newExplosions.push(spawnExplosion(enemy.x, enemy.y));
        const base = TIER_SCORE[enemy.tier];
        const mult = enemy.phase === "Diving" || enemy.phase === "Circling" ? DIVE_SCORE_MULT : 1;
        const bonus = state.phase === "ChallengingStage" ? 1 : mult;
        score += base * bonus;
        if (state.phase === "ChallengingStage") challengingHits += 1;
        return { ...enemy, hp: 0, isAlive: false };
      }

      return { ...enemy, hp: newHp };
    }
    return enemy;
  });

  const playerBullets = state.playerBullets.filter((b) => !hitBulletIds.has(b.id));

  // ── Enemy contact ↔ player (bullets + #925 diving/circling ships) ──────────
  if (player.invincibleTimer <= 0) {
    const hitByBullet = state.enemyBullets.some((b) =>
      aabb(b.x, b.y, b.width, b.height, player.x, player.y, player.width, player.height)
    );
    const hitByShip =
      !hitByBullet &&
      enemies.some(
        (e) =>
          e.isAlive &&
          (e.phase === "Diving" || e.phase === "Circling") &&
          aabb(e.x, e.y, e.width, e.height, player.x, player.y, player.width, player.height)
      );

    if (hitByBullet || hitByShip) {
      const newLives = player.lives - 1;
      newExplosions.push(spawnExplosion(player.x, player.y));
      const enemyBullets = hitByBullet
        ? state.enemyBullets.filter(
            (b) =>
              !aabb(b.x, b.y, b.width, b.height, player.x, player.y, player.width, player.height)
          )
        : state.enemyBullets;

      if (newLives <= 0) {
        return {
          ...state,
          enemies,
          playerBullets,
          enemyBullets,
          explosions: newExplosions,
          score,
          challengingHits,
          player: { ...player, lives: 0 },
          phase: "GameOver",
        };
      }

      return {
        ...state,
        enemies,
        playerBullets,
        enemyBullets,
        explosions: newExplosions,
        score,
        challengingHits,
        player: { ...player, lives: newLives, invincibleTimer: PLAYER_INVINCIBLE_MS },
      };
    }
  }

  return { ...state, enemies, playerBullets, score, challengingHits, explosions: newExplosions };
}

// ---------------------------------------------------------------------------
// Explosions
// ---------------------------------------------------------------------------

function tickExplosions(state: StarSwarmState, dtMs: number): StarSwarmState {
  const explosions = state.explosions
    .map((ex) => {
      const frameTimer = ex.frameTimer - dtMs;
      if (frameTimer <= 0) {
        return { ...ex, frame: ex.frame + 1, frameTimer: EXPLOSION_FRAME_MS };
      }
      return { ...ex, frameTimer };
    })
    .filter((ex) => ex.frame < EXPLOSION_FRAMES);

  return { ...state, explosions };
}

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

function checkPhaseTransitions(state: StarSwarmState): StarSwarmState {
  const liveEnemies = state.enemies.filter((e) => e.isAlive);

  // SwoopIn → Playing once all enemies are in Formation (or Challenging started)
  if (state.phase === "SwoopIn") {
    const allArrived = liveEnemies.every((e) => e.phase !== "SwoopIn");
    if (allArrived) return { ...state, phase: "Playing" };
    return state;
  }

  // ChallengingStage → WaveClear once all challenge enemies have exited
  if (state.phase === "ChallengingStage") {
    // Enemies exit when their path completes (they reach formationY which is off-screen bottom)
    const anyAlive = liveEnemies.length > 0;
    if (!anyAlive) {
      const waveClearBonus = state.wave * WAVE_CLEAR_BONUS_BASE;
      return {
        ...state,
        score: state.score + waveClearBonus + state.challengingHits * 50,
        phase: "WaveClear",
        phaseTimer: CHALLENGING_CLEAR_PAUSE,
      };
    }
    return state;
  }

  // Playing → WaveClear once all enemies dead
  if (state.phase === "Playing") {
    if (liveEnemies.length === 0) {
      const waveClearBonus = state.wave * WAVE_CLEAR_BONUS_BASE;
      return {
        ...state,
        score: state.score + waveClearBonus,
        phase: "WaveClear",
        phaseTimer: WAVE_CLEAR_PAUSE,
      };
    }
    return state;
  }

  return state;
}

function startNextWave(state: StarSwarmState): StarSwarmState {
  const nextWave = state.wave + 1;
  return buildWaveState(state.canvasW, state.canvasH, nextWave, state.player, state.score);
}

// ---------------------------------------------------------------------------
// Derived helpers (useful for renderers)
// ---------------------------------------------------------------------------

/** True while any enemy is still in the SwoopIn entry animation. */
export function isSwooping(state: StarSwarmState): boolean {
  return state.enemies.some((e) => e.isAlive && e.phase === "SwoopIn");
}

/** Number of enemies currently airborne (Diving or Circling). */
export function diverCount(state: StarSwarmState): number {
  return state.enemies.filter((e) => e.isAlive && (e.phase === "Diving" || e.phase === "Circling"))
    .length;
}
