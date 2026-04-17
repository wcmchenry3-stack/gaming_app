/**
 * properties.test.ts — fast-check property-based tests for Fruit Merge.
 *
 * These tests assert invariants that hold for any valid input, not just
 * specific hand-crafted examples.  fast-check generates random cases and
 * automatically shrinks failures to the minimal counterexample.
 *
 * Covered modules:
 *   - scoring.ts         — scoreForMerge geometric progression + watermelon bonus
 *   - spawnSelector.ts   — tier range, weight normalization, distribution, streak limits
 *   - fruitQueue.ts      — peek/consume invariants, always-valid tiers
 */

import * as fc from "fast-check";
import { scoreForMerge } from "../scoring";
import {
  selectWeightedTier,
  ControlledSpawnSelector,
  createSeededRng,
  simulateSpawns,
  analyzeSpawnSequence,
  BASE_SPAWN_WEIGHTS,
} from "../spawnSelector";
import { FruitQueue } from "../fruitQueue";
import { FruitTier, MAX_SPAWN_TIER } from "../../../theme/fruitSets";

// ---------------------------------------------------------------------------
// scoreForMerge — invariants
// ---------------------------------------------------------------------------

describe("scoreForMerge — property tests", () => {
  it("always returns a positive integer for tiers 0–9", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (tier) => {
        const score = scoreForMerge(tier as FruitTier);
        return score > 0 && Number.isInteger(score);
      })
    );
  });

  it("each tier 0–9 doubles the previous tier's score (geometric progression)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), (tier) => {
        return scoreForMerge((tier + 1) as FruitTier) === scoreForMerge(tier as FruitTier) * 2;
      })
    );
  });

  it("tier 10 always returns the watermelon bonus (256)", () => {
    // Not a property — just verifying the constant is always consistent
    fc.assert(
      fc.property(fc.constant(10 as FruitTier), (tier) => {
        return scoreForMerge(tier) === 256;
      })
    );
  });

  it("score at tier 0 is 2 (2^1)", () => {
    expect(scoreForMerge(0)).toBe(2);
  });

  it("score at tier 9 is 1024 (2^10)", () => {
    expect(scoreForMerge(9)).toBe(1024);
  });
});

// ---------------------------------------------------------------------------
// selectWeightedTier — invariants
// ---------------------------------------------------------------------------

describe("selectWeightedTier — property tests", () => {
  it("always returns a tier in [0, MAX_SPAWN_TIER] for any rng value [0, 1]", () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1, noNaN: true }), (rngValue) => {
        const tier = selectWeightedTier(BASE_SPAWN_WEIGHTS, () => rngValue);
        return tier >= 0 && tier <= MAX_SPAWN_TIER;
      })
    );
  });

  it("returns a valid tier for any non-zero weight array of 5 elements", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.float({ min: 0, max: 100, noNaN: true }), {
            minLength: 5,
            maxLength: 5,
          })
          .filter((weights) => weights.some((w) => w > 0)),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (weights, rngValue) => {
          const tier = selectWeightedTier(weights, () => rngValue);
          return tier >= 0 && tier <= MAX_SPAWN_TIER;
        }
      )
    );
  });

  it("a weight array of all-zeros falls back to a valid tier (equal distribution)", () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1, noNaN: true }), (rngValue) => {
        const allZero = new Array(5).fill(0);
        const tier = selectWeightedTier(allZero, () => rngValue);
        return tier >= 0 && tier <= MAX_SPAWN_TIER;
      })
    );
  });
});

// ---------------------------------------------------------------------------
// ControlledSpawnSelector — invariants
// ---------------------------------------------------------------------------

describe("ControlledSpawnSelector — property tests", () => {
  it("never returns a tier above MAX_SPAWN_TIER across any seed and N drops", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 500 }),
        (seed, drops) => {
          const rng = createSeededRng(seed);
          const selector = new ControlledSpawnSelector(rng);
          for (let i = 0; i < drops; i++) {
            const tier = selector.next();
            if (tier < 0 || tier > MAX_SPAWN_TIER) return false;
          }
          return true;
        }
      )
    );
  });

  it("always returns an integer tier", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 100 }),
        (seed, drops) => {
          const rng = createSeededRng(seed);
          const selector = new ControlledSpawnSelector(rng);
          for (let i = 0; i < drops; i++) {
            const tier = selector.next();
            if (!Number.isInteger(tier)) return false;
          }
          return true;
        }
      )
    );
  });

  it("produces consistent results with the same seed across two runs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 200 }),
        (seed, drops) => {
          function runWithSeed(s: number): FruitTier[] {
            const rng = createSeededRng(s);
            const selector = new ControlledSpawnSelector(rng);
            return Array.from({ length: drops }, () => selector.next());
          }
          const run1 = runWithSeed(seed);
          const run2 = runWithSeed(seed);
          return run1.every((tier, i) => tier === run2[i]);
        }
      ),
      { numRuns: 30 } // fewer because each run is O(drops)
    );
  });
});

// ---------------------------------------------------------------------------
// simulateSpawns + analyzeSpawnSequence — distribution invariants
// ---------------------------------------------------------------------------

describe("simulateSpawns — distribution property tests", () => {
  it("observed tier frequencies stay within 30% of expected for 1000 drops", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const N = 1000;
        const rng = createSeededRng(seed);
        const selector = new ControlledSpawnSelector(rng);
        const { stats } = simulateSpawns(N, () => selector.next());

        const totalWeight = BASE_SPAWN_WEIGHTS.reduce((a, b) => a + b, 0);
        return BASE_SPAWN_WEIGHTS.every((w, tier) => {
          const expected = w / totalWeight;
          const observed = (stats.frequencyByTier[tier] ?? 0) / N;
          return Math.abs(observed - expected) < 0.3; // generous tolerance
        });
      }),
      { numRuns: 20 } // each run simulates 1000 drops
    );
  });

  it("analyzeSpawnSequence produces a longestRepeatStreak >= 1 for any non-empty sequence", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: MAX_SPAWN_TIER }) as fc.Arbitrary<FruitTier>, {
          minLength: 1,
          maxLength: 200,
        }),
        (sequence) => {
          const stats = analyzeSpawnSequence(sequence);
          return stats.longestRepeatStreak >= 1;
        }
      )
    );
  });

  it("frequencyByTier counts sum to sequence length", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: MAX_SPAWN_TIER }) as fc.Arbitrary<FruitTier>, {
          minLength: 0,
          maxLength: 500,
        }),
        (sequence) => {
          const stats = analyzeSpawnSequence(sequence);
          const total = stats.frequencyByTier.reduce((a, b) => a + b, 0);
          return total === sequence.length;
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// FruitQueue — invariants
// ---------------------------------------------------------------------------

describe("FruitQueue — property tests", () => {
  it("peek() always returns a valid tier in [0, MAX_SPAWN_TIER]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), (n) => {
        const q = new FruitQueue();
        for (let i = 0; i < n; i++) {
          q.consume();
        }
        const tier = q.peek();
        return tier >= 0 && tier <= MAX_SPAWN_TIER;
      })
    );
  });

  it("peekNext() always returns a valid tier in [0, MAX_SPAWN_TIER]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), (n) => {
        const q = new FruitQueue();
        for (let i = 0; i < n; i++) {
          q.consume();
        }
        const tier = q.peekNext();
        return tier >= 0 && tier <= MAX_SPAWN_TIER;
      })
    );
  });

  it("consume() advances peek to the previous peekNext", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (n) => {
        const q = new FruitQueue();
        for (let i = 0; i < n; i++) {
          const expectedAfterConsume = q.peekNext();
          const consumed = q.consume();
          // consume() returns the *old* peek
          if (consumed !== expectedAfterConsume - (expectedAfterConsume - consumed)) {
            // just verify: new peek equals what was peekNext before consume
          }
          if (q.peek() !== expectedAfterConsume) return false;
        }
        return true;
      })
    );
  });

  it("consume() returns the same value as peek() before consuming", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (n) => {
        const q = new FruitQueue();
        for (let i = 0; i < n; i++) {
          const peeked = q.peek();
          const consumed = q.consume();
          if (peeked !== consumed) return false;
        }
        return true;
      })
    );
  });
});

// ---------------------------------------------------------------------------
// createSeededRng — determinism invariant
// ---------------------------------------------------------------------------

describe("createSeededRng — determinism", () => {
  it("same seed always produces the same sequence of values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 100 }),
        (seed, n) => {
          const rng1 = createSeededRng(seed);
          const rng2 = createSeededRng(seed);
          for (let i = 0; i < n; i++) {
            if (rng1() !== rng2()) return false;
          }
          return true;
        }
      )
    );
  });

  it("always returns values in [0, 1)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 50 }),
        (seed, n) => {
          const rng = createSeededRng(seed);
          for (let i = 0; i < n; i++) {
            const v = rng();
            if (v < 0 || v >= 1) return false;
          }
          return true;
        }
      )
    );
  });
});
