import { FruitTier, MAX_SPAWN_TIER } from "../../theme/fruitSets";

function randomSpawnTier(): FruitTier {
  // Weighted towards smaller tiers: tier 0 = 5 shares, tier 1 = 4, ..., tier 4 = 1
  const weights = [5, 4, 3, 2, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i <= MAX_SPAWN_TIER; i++) {
    roll -= weights[i];
    if (roll <= 0) return i as FruitTier;
  }
  return 0;
}

export class FruitQueue {
  private queue: FruitTier[];

  constructor() {
    // Pre-fill two: current + next preview
    this.queue = [randomSpawnTier(), randomSpawnTier()];
  }

  peek(): FruitTier {
    return this.queue[0];
  }

  peekNext(): FruitTier {
    return this.queue[1];
  }

  consume(): FruitTier {
    const tier = this.queue.shift()!;
    this.queue.push(randomSpawnTier());
    return tier;
  }
}
