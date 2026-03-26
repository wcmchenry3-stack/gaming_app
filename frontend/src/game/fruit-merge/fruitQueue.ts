import { FruitTier } from "../../theme/fruitSets";
import { ControlledSpawnSelector } from "./spawnSelector";

export class FruitQueue {
  private queue: FruitTier[];
  private readonly selector: ControlledSpawnSelector;

  constructor(selector: ControlledSpawnSelector = new ControlledSpawnSelector()) {
    this.selector = selector;
    // Pre-fill two: current + next preview
    this.queue = [this.selector.next(), this.selector.next()];
  }

  peek(): FruitTier {
    return this.queue[0];
  }

  peekNext(): FruitTier {
    return this.queue[1];
  }

  consume(): FruitTier {
    const tier = this.queue.shift()!;
    this.queue.push(this.selector.next());
    return tier;
  }
}
