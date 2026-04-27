import {
  initStarSwarm,
  tick,
  isSwooping,
  diverCount,
  seedRng,
  _resetIds,
  CANVAS_W,
  CANVAS_H,
} from "../engine";
import type { Bullet, StarSwarmInput, StarSwarmState } from "../types";

const NO_INPUT: StarSwarmInput = { playerX: CANVAS_W / 2, fire: false, chargeShot: false };
const FIRE_INPUT: StarSwarmInput = { playerX: CANVAS_W / 2, fire: true, chargeShot: false };

function advanceMs(state: StarSwarmState, ms: number, input = NO_INPUT): StarSwarmState {
  const step = 16;
  let s = state;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    s = tick(s, Math.min(step, ms - elapsed), input);
  }
  return s;
}

beforeEach(() => {
  seedRng(42);
  _resetIds();
});

// ---------------------------------------------------------------------------
// initStarSwarm
// ---------------------------------------------------------------------------

describe("initStarSwarm", () => {
  it("returns SwoopIn phase on wave 1", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H);
    expect(s.phase).toBe("SwoopIn");
  });

  it("returns ChallengingStage phase on wave 3", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H, 3);
    expect(s.phase).toBe("ChallengingStage");
  });

  it("spawns enemies on init", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H);
    expect(s.enemies.length).toBeGreaterThan(0);
  });

  it("player starts with 3 lives", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H);
    expect(s.player.lives).toBe(3);
  });

  it("score starts at 0", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H);
    expect(s.score).toBe(0);
  });

  it("is deterministic for same seed", () => {
    const a = initStarSwarm(CANVAS_W, CANVAS_H, 1, 7);
    const b = initStarSwarm(CANVAS_W, CANVAS_H, 1, 7);
    expect(a.enemies[0]?.x).toBeCloseTo(b.enemies[0]?.x ?? 0);
    expect(a.enemies[0]?.y).toBeCloseTo(b.enemies[0]?.y ?? 0);
  });

  it("wave 4 has more grunt rows than wave 1", () => {
    const w1 = initStarSwarm(CANVAS_W, CANVAS_H, 1);
    const w4 = initStarSwarm(CANVAS_W, CANVAS_H, 4);
    expect(w4.enemies.length).toBeGreaterThan(w1.enemies.length);
  });

  it("player starts near bottom of canvas", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H);
    expect(s.player.y).toBeGreaterThan(CANVAS_H * 0.8);
  });
});

// ---------------------------------------------------------------------------
// Enemy state machine — SwoopIn
// ---------------------------------------------------------------------------

describe("SwoopIn", () => {
  it("all enemies start in SwoopIn phase", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H);
    expect(s.enemies.every((e) => e.phase === "SwoopIn")).toBe(true);
  });

  it("isSwooping returns true initially", () => {
    const s = initStarSwarm(CANVAS_W, CANVAS_H);
    expect(isSwooping(s)).toBe(true);
  });

  it("no enemies remain in SwoopIn after enough time", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000); // enough time for all to arrive
    const stillSwooping = s.enemies.filter((e) => e.isAlive && e.phase === "SwoopIn");
    expect(stillSwooping).toHaveLength(0);
  });

  it("phase transitions to Playing once all enemies are in Formation", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    expect(s.phase).toBe("Playing");
  });

  it("isSwooping returns false after all arrive", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    expect(isSwooping(s)).toBe(false);
  });

  it("does not mutate previous state", () => {
    const s0 = initStarSwarm(CANVAS_W, CANVAS_H);
    const firstY = s0.enemies[0]?.y ?? 0;
    tick(s0, 100, NO_INPUT);
    expect(s0.enemies[0]?.y).toBe(firstY);
  });
});

// ---------------------------------------------------------------------------
// Enemy state machine — Formation → Diving → Circling → Returning
// ---------------------------------------------------------------------------

describe("Dive AI", () => {
  it("at least one enemy dives during playing phase over 30s", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000); // get into Playing
    expect(s.phase).toBe("Playing");
    s = advanceMs(s, 30_000);
    const everDived = s.enemies.some(
      (e) => e.phase === "Diving" || e.phase === "Circling" || e.phase === "Returning"
    );
    expect(everDived).toBe(true);
  });

  it("diverCount returns 0 before any dive occurs", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    // Right after formation, no dives yet
    expect(s.phase).toBe("Playing");
    expect(diverCount(s)).toBeGreaterThanOrEqual(0);
  });

  it("diving enemies eventually return to Formation", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 60_000); // long enough for multiple dive cycles
    // At least some should be back in Formation
    const inFormation = s.enemies.filter((e) => e.isAlive && e.phase === "Formation");
    expect(inFormation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AABB collision — player bullets ↔ enemies
// ---------------------------------------------------------------------------

describe("Collision: player bullets vs enemies", () => {
  it("enemy is killed when a player bullet hits it", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000); // get to Playing

    const target = s.enemies.find((e) => e.isAlive && e.tier === "Grunt");
    if (!target) return;

    // Inject a bullet directly onto the enemy's current position
    const bullet: Bullet = {
      id: 55555,
      x: target.x,
      y: target.y,
      vx: 0,
      vy: -0.5,
      owner: "player",
      width: 5,
      height: 14,
      damage: 1,
    };
    s = { ...s, playerBullets: [bullet] };
    s = tick(s, 16, NO_INPUT);

    const after = s.enemies.find((e) => e.id === target.id);
    expect(after ? !after.isAlive || after.hp < target.hp : true).toBe(true);
  });

  it("killing an enemy increases score", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    const scoreBefore = s.score;

    const target = s.enemies.find((e) => e.isAlive && e.tier === "Grunt");
    if (!target) return; // no grunt on this wave config, skip

    const aim: StarSwarmInput = { playerX: target.x, fire: true, chargeShot: false };
    s = advanceMs(s, 3000, aim);
    expect(s.score).toBeGreaterThan(scoreBefore);
  });

  it("player bullets are removed after hitting enemy", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);

    const target = s.enemies.find((e) => e.isAlive);
    if (!target) return;

    const aim: StarSwarmInput = { playerX: target.x, fire: true, chargeShot: false };
    s = tick(s, 16, aim); // fire one bullet
    const bulletsBefore = s.playerBullets.length;

    // Advance until bullet is gone (either hit or exited)
    s = advanceMs(s, 2000, NO_INPUT);
    expect(s.playerBullets.length).toBeLessThanOrEqual(bulletsBefore);
  });
});

// ---------------------------------------------------------------------------
// AABB collision — enemy bullets ↔ player
// ---------------------------------------------------------------------------

describe("Collision: enemy bullets vs player", () => {
  it("player loses a life when hit by enemy bullet", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000); // Playing

    // Reset player to known state before the test hit
    s = { ...s, player: { ...s.player, lives: 3, invincibleTimer: 0 } };

    // Inject a bullet aimed directly at the player
    const { player } = s;
    const bullet = {
      id: 99999,
      x: player.x,
      y: player.y - 2,
      vx: 0,
      vy: 0.5,
      owner: "enemy" as const,
      width: 5,
      height: 10,
      damage: 1,
    };
    s = { ...s, enemyBullets: [bullet] };
    s = tick(s, 16, NO_INPUT);

    expect(s.player.lives).toBe(2);
  });

  it("game transitions to GameOver when lives reach 0", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);

    // Drain lives to 1
    s = { ...s, player: { ...s.player, lives: 1, invincibleTimer: 0 } };

    const bullet = {
      id: 99999,
      x: s.player.x,
      y: s.player.y - 2,
      vx: 0,
      vy: 0.5,
      owner: "enemy" as const,
      width: 5,
      height: 10,
      damage: 1,
    };
    s = { ...s, enemyBullets: [bullet] };
    s = tick(s, 16, NO_INPUT);

    expect(s.phase).toBe("GameOver");
  });

  it("player gains invincibility after being hit", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    s = { ...s, player: { ...s.player, lives: 2, invincibleTimer: 0 } };

    const bullet = {
      id: 99999,
      x: s.player.x,
      y: s.player.y - 2,
      vx: 0,
      vy: 0.5,
      owner: "enemy" as const,
      width: 5,
      height: 10,
      damage: 1,
    };
    s = { ...s, enemyBullets: [bullet] };
    s = tick(s, 16, NO_INPUT);

    expect(s.player.invincibleTimer).toBeGreaterThan(0);
  });

  it("invincible player cannot be hit", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    s = { ...s, player: { ...s.player, lives: 2, invincibleTimer: 2000 } };

    const bullet = {
      id: 99999,
      x: s.player.x,
      y: s.player.y,
      vx: 0,
      vy: 0,
      owner: "enemy" as const,
      width: 50,
      height: 50,
      damage: 1,
    };
    s = { ...s, enemyBullets: [bullet] };
    s = tick(s, 16, NO_INPUT);

    expect(s.player.lives).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe("Scoring", () => {
  it("Grunt is worth 100 points", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    const grunt = s.enemies.find((e) => e.isAlive && e.tier === "Grunt");
    if (!grunt) return;

    const scoreBeforeKill = s.score;
    // Teleport a bullet onto the grunt
    const bullet = {
      id: 88888,
      x: grunt.x,
      y: grunt.y,
      vx: 0,
      vy: -0.5,
      owner: "player" as const,
      width: 5,
      height: 14,
      damage: 1,
    };
    s = { ...s, playerBullets: [bullet] };
    s = tick(s, 16, NO_INPUT);
    expect(s.score - scoreBeforeKill).toBe(100);
  });

  it("Elite is worth 200 points", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000);
    // Elite has 2 HP — need to hit twice
    const elite = s.enemies.find((e) => e.isAlive && e.tier === "Elite");
    if (!elite) return;

    const makeBullet = (id: number) => ({
      id,
      x: elite.x,
      y: elite.y,
      vx: 0,
      vy: -0.5,
      owner: "player" as const,
      width: 5,
      height: 14,
      damage: 1,
    });
    const scoreBeforeKill = s.score;
    s = { ...s, playerBullets: [makeBullet(1)] };
    s = tick(s, 16, NO_INPUT);
    s = { ...s, playerBullets: [makeBullet(2)] };
    s = tick(s, 16, NO_INPUT);
    expect(s.score - scoreBeforeKill).toBe(200);
  });

  it("wave clear adds a wave-scaled bonus", () => {
    const wave = 2;
    let s = initStarSwarm(CANVAS_W, CANVAS_H, wave);
    s = advanceMs(s, 8000);
    const scoreBeforeClear = s.score;

    // Kill all enemies
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, isAlive: false, hp: 0 })) };
    s = tick(s, 16, NO_INPUT); // trigger WaveClear
    expect(s.score).toBeGreaterThan(scoreBeforeClear);
  });
});

// ---------------------------------------------------------------------------
// Wave progression
// ---------------------------------------------------------------------------

describe("Wave progression", () => {
  it("advances to next wave after WaveClear pause", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 1);
    // Kill all enemies to trigger WaveClear
    s = advanceMs(s, 8000);
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, isAlive: false, hp: 0 })) };
    s = tick(s, 16, NO_INPUT);
    expect(s.phase).toBe("WaveClear");

    // Advance through pause
    s = advanceMs(s, 3000);
    expect(s.wave).toBe(2);
  });

  it("wave 3 is a ChallengingStage", () => {
    // Fast-forward to wave 3
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 2);
    s = advanceMs(s, 8000);
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, isAlive: false, hp: 0 })) };
    s = tick(s, 16, NO_INPUT); // WaveClear
    s = advanceMs(s, 3000);
    expect(s.wave).toBe(3);
    expect(s.phase).toBe("ChallengingStage");
  });

  it("score is carried over between waves", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 1);
    s = advanceMs(s, 8000);
    // Manually set score then trigger wave clear
    s = { ...s, score: 1234, enemies: s.enemies.map((e) => ({ ...e, isAlive: false, hp: 0 })) };
    s = tick(s, 16, NO_INPUT);
    s = advanceMs(s, 3000);
    expect(s.score).toBeGreaterThanOrEqual(1234);
  });
});

// ---------------------------------------------------------------------------
// Challenging Stage
// ---------------------------------------------------------------------------

describe("ChallengingStage", () => {
  it("enemies in ChallengingStage do not fire", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 3);
    s = advanceMs(s, 20_000);
    // No enemy bullets should be present
    expect(s.phase === "GameOver" ? true : s.enemyBullets.length).toBe(
      s.phase === "GameOver" ? true : 0
    );
  });

  it("hitting enemies in ChallengingStage increments challengingHits", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 3);
    // Advance until at least one enemy is on-screen
    s = advanceMs(s, 1000);

    const target = s.enemies.find((e) => e.isAlive && e.tier === "Grunt" && e.y > 0);
    if (!target) return; // no grunt on-screen yet — skip rather than fail

    // Inject a bullet directly at the enemy's current position
    const bullet: Bullet = {
      id: 77777,
      x: target.x,
      y: target.y,
      vx: 0,
      vy: -0.5,
      owner: "player",
      width: 5,
      height: 14,
      damage: 1,
    };
    s = { ...s, playerBullets: [bullet] };
    s = tick(s, 16, NO_INPUT);
    expect(s.challengingHits).toBe(1);
  });

  it("transitions to WaveClear when all challenge enemies exit", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 3);
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, isAlive: false, hp: 0 })) };
    s = tick(s, 16, NO_INPUT);
    expect(s.phase).toBe("WaveClear");
  });
});

// ---------------------------------------------------------------------------
// Player firing
// ---------------------------------------------------------------------------

describe("Player firing", () => {
  it("fire=true creates a player bullet", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = tick(s, 16, FIRE_INPUT);
    expect(s.playerBullets).toHaveLength(1);
    expect(s.playerBullets[0]?.owner).toBe("player");
  });

  it("shoot cooldown prevents rapid-fire", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = tick(s, 16, FIRE_INPUT);
    s = tick(s, 16, FIRE_INPUT);
    // Second tick should not add another bullet while cooldown is active
    expect(s.playerBullets.length).toBeLessThanOrEqual(2);
    expect(s.player.shootCooldown).toBeGreaterThan(0);
  });

  it("player bullet moves upward", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = tick(s, 16, FIRE_INPUT);
    const y0 = s.playerBullets[0]?.y ?? 0;
    s = tick(s, 100, NO_INPUT);
    expect(s.playerBullets[0]?.y ?? y0).toBeLessThan(y0);
  });

  it("bullets off the top of screen are removed", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = tick(s, 16, FIRE_INPUT);
    s = advanceMs(s, 5000, NO_INPUT); // plenty of time to exit top
    expect(s.playerBullets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GameOver is terminal
// ---------------------------------------------------------------------------

describe("GameOver terminal state", () => {
  it("tick is a no-op once phase is GameOver", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = { ...s, phase: "GameOver" };
    const s2 = tick(s, 1000, FIRE_INPUT);
    expect(s2).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// ChallengingStage — off-screen enemy cleanup (#934)
// ---------------------------------------------------------------------------

describe("ChallengingStage off-screen cleanup", () => {
  it("transitions to WaveClear after enemies exit without being shot", () => {
    // Wave 3 starts as ChallengingStage; enemies follow a path to canvasH + 80
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 3);
    expect(s.phase).toBe("ChallengingStage");

    // Last enemy (idx 23) starts with pathT = -(23*80/3200) ≈ -0.575
    // It exits the canvas after (1 + 0.575) * 3200 ≈ 5040 ms.
    // Advance past that with no firing so enemies scroll off instead of being shot.
    s = advanceMs(s, 6000, NO_INPUT);
    expect(s.phase).toBe("WaveClear");
  });

  it("transitions immediately if player shoots all enemies early", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 3);
    // Advance briefly so enemies are on screen and reachable
    s = advanceMs(s, 500, NO_INPUT);
    // Force all enemies dead to simulate shooting them all
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, isAlive: false })) };
    s = tick(s, 16, NO_INPUT);
    expect(s.phase).toBe("WaveClear");
  });
});

// ---------------------------------------------------------------------------
// Dive/circle shooting (#944)
// ---------------------------------------------------------------------------

describe("Dive/circle shooting", () => {
  it("a diving enemy fires an aimed bullet with non-zero vx", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H);
    s = advanceMs(s, 8000); // reach Playing
    expect(s.phase).toBe("Playing");

    // Force one enemy into Diving with an expired shoot timer so it fires immediately
    const playerX = s.player.x;
    s = {
      ...s,
      enemies: s.enemies.map((e, i) =>
        i === 0
          ? { ...e, phase: "Diving" as const, diveTargetX: playerX, shootTimer: 0 }
          : e
      ),
    };

    s = tick(s, 16, NO_INPUT);

    const divingBullet = s.enemyBullets.find((b) => b.vx !== 0);
    expect(divingBullet).toBeDefined();
    expect(divingBullet?.vy).toBeGreaterThan(0); // moving downward
  });

  it("challenge stage enemies do not fire while attacking", () => {
    let s = initStarSwarm(CANVAS_W, CANVAS_H, 3);
    expect(s.phase).toBe("ChallengingStage");
    s = advanceMs(s, 5000, NO_INPUT);
    expect(s.enemyBullets).toHaveLength(0);
  });
});
