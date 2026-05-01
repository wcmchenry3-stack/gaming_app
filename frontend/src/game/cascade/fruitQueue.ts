import { FruitTier } from "../../theme/fruitSets.engine";
import { ControlledSpawnSelector } from "./spawnSelector";

export class FruitQueue {
  private queue: FruitTier[];
  private readonly selector: ControlledSpawnSelector;

  constructor(
    selector: ControlledSpawnSelector = new ControlledSpawnSelector(),
    initialQueue?: readonly [FruitTier, FruitTier]
  ) {
    this.selector = selector;
    // Pre-fill two: current + next preview. If a caller passes an
    // `initialQueue` (used by #216's reload persistence to restore the
    // [current, next] pair that was showing at save time), use those
    // instead of pulling fresh values from the selector.
    this.queue = initialQueue
      ? [initialQueue[0], initialQueue[1]]
      : [this.selector.next(), this.selector.next()];
  }

  peek(): FruitTier {
    return this.queue[0] ?? 0;
  }

  peekNext(): FruitTier {
    return this.queue[1] ?? 0;
  }

  consume(): FruitTier {
    const tier = this.queue.shift()!;
    this.queue.push(this.selector.next());
    return tier;
  }
}
