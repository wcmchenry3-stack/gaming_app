import { FruitTier, MAX_SPAWN_TIER } from "../../theme/fruitSets";

const SPAWN_TIER_COUNT = MAX_SPAWN_TIER + 1;

// Base probability shares; these remain the main driver of selection.
export const BASE_SPAWN_WEIGHTS: number[] = [5, 4, 3, 2, 1];
export const DROUGHT_CORRECTION_STRENGTH = 0.08;
export const DROUGHT_BOOST_START_AFTER = 4;
export const RECENT_HISTORY_WINDOW = 6;
export const RECENT_REPEAT_PENALTY_STRENGTH = 0.12;
export const DANGER_STATE_ADJUSTMENT_STRENGTH = 0.12;
export const DANGER_HIGH_TIER_START: FruitTier = 3;
export const ANTI_STREAK_THRESHOLD = 4;
export const ANTI_STREAK_MULTIPLIER = 0.45;

export interface SpawnSelectionContext {
  /**
   * Optional danger signal in [0, 1]. 0 means calm board, 1 means very high stack.
   * Not currently wired from gameplay yet; kept optional for easy future tuning.
   */
  dangerLevel?: number;
}

export interface SpawnStats {
  frequencyByTier: number[];
  longestDroughtByTier: number[];
  longestRepeatStreak: number;
}

export type RandomSource = () => number;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return new Array(SPAWN_TIER_COUNT).fill(1 / SPAWN_TIER_COUNT);
  }
  return weights.map((weight) => weight / total);
}

export function selectWeightedTier(weights: number[], rng: RandomSource = Math.random): FruitTier {
  const normalized = normalizeWeights(weights);
  let roll = rng();

  for (let tier = 0; tier < SPAWN_TIER_COUNT; tier++) {
    roll -= normalized[tier];
    if (roll <= 0) return tier as FruitTier;
  }

  return MAX_SPAWN_TIER;
}

export function randomSpawnTierPure(rng: RandomSource = Math.random): FruitTier {
  return selectWeightedTier(BASE_SPAWN_WEIGHTS, rng);
}

export class ControlledSpawnSelector {
  private readonly rng: RandomSource;
  private readonly dropsSinceSeen: number[];
  private readonly recentHistory: FruitTier[];
  private currentStreakTier: FruitTier | null;
  private currentStreakLength: number;

  constructor(rng: RandomSource = Math.random) {
    this.rng = rng;
    this.dropsSinceSeen = new Array(SPAWN_TIER_COUNT).fill(0);
    this.recentHistory = [];
    this.currentStreakTier = null;
    this.currentStreakLength = 0;
  }

  next(context: SpawnSelectionContext = {}): FruitTier {
    const dangerLevel = clamp01(context.dangerLevel ?? 0);
    const adjustedWeights: number[] = [];

    for (let tier = 0; tier < SPAWN_TIER_COUNT; tier++) {
      const baseWeight = BASE_SPAWN_WEIGHTS[tier] ?? 1;
      const droughtDrops = this.dropsSinceSeen[tier];
      const droughtBoost =
        droughtDrops <= DROUGHT_BOOST_START_AFTER
          ? 1
          : 1 + (droughtDrops - DROUGHT_BOOST_START_AFTER) * DROUGHT_CORRECTION_STRENGTH;

      const recentCount = this.recentHistory.filter((seenTier) => seenTier === tier).length;
      const recentPenalty = Math.max(0.55, 1 - recentCount * RECENT_REPEAT_PENALTY_STRENGTH);

      const dangerAdjustment =
        dangerLevel > 0 && tier >= DANGER_HIGH_TIER_START
          ? Math.max(0.7, 1 - dangerLevel * DANGER_STATE_ADJUSTMENT_STRENGTH)
          : 1;

      let antiStreakAdjustment = 1;
      if (this.currentStreakTier === tier && this.currentStreakLength >= ANTI_STREAK_THRESHOLD) {
        antiStreakAdjustment = ANTI_STREAK_MULTIPLIER;
      }

      adjustedWeights[tier] =
        baseWeight * droughtBoost * recentPenalty * dangerAdjustment * antiStreakAdjustment;
    }

    const selectedTier = selectWeightedTier(adjustedWeights, this.rng);
    this.recordSpawn(selectedTier);
    return selectedTier;
  }

  private recordSpawn(tier: FruitTier) {
    for (let i = 0; i < SPAWN_TIER_COUNT; i++) {
      this.dropsSinceSeen[i] += 1;
    }
    this.dropsSinceSeen[tier] = 0;

    this.recentHistory.push(tier);
    if (this.recentHistory.length > RECENT_HISTORY_WINDOW) {
      this.recentHistory.shift();
    }

    if (this.currentStreakTier === tier) {
      this.currentStreakLength += 1;
    } else {
      this.currentStreakTier = tier;
      this.currentStreakLength = 1;
    }
  }
}

export function analyzeSpawnSequence(sequence: FruitTier[]): SpawnStats {
  const frequencyByTier = new Array(SPAWN_TIER_COUNT).fill(0);
  const longestDroughtByTier = new Array(SPAWN_TIER_COUNT).fill(0);
  const currentDroughtByTier = new Array(SPAWN_TIER_COUNT).fill(0);

  let longestRepeatStreak = 0;
  let currentStreakTier: FruitTier | null = null;
  let currentStreakLength = 0;

  for (const tier of sequence) {
    frequencyByTier[tier] += 1;

    for (let i = 0; i < SPAWN_TIER_COUNT; i++) {
      currentDroughtByTier[i] += 1;
      if (currentDroughtByTier[i] > longestDroughtByTier[i]) {
        longestDroughtByTier[i] = currentDroughtByTier[i];
      }
    }
    currentDroughtByTier[tier] = 0;

    if (currentStreakTier === tier) {
      currentStreakLength += 1;
    } else {
      currentStreakTier = tier;
      currentStreakLength = 1;
    }
    if (currentStreakLength > longestRepeatStreak) {
      longestRepeatStreak = currentStreakLength;
    }
  }

  return {
    frequencyByTier,
    longestDroughtByTier,
    longestRepeatStreak,
  };
}

export function createSeededRng(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function simulateSpawns(
  drops: number,
  selector: () => FruitTier
): { sequence: FruitTier[]; stats: SpawnStats } {
  const sequence: FruitTier[] = [];
  for (let i = 0; i < drops; i++) {
    sequence.push(selector());
  }

  return {
    sequence,
    stats: analyzeSpawnSequence(sequence),
  };
}
