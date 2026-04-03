import { FruitQueue } from "../fruitQueue";
import { MAX_SPAWN_TIER } from "../../../theme/fruitSets";

describe("FruitQueue", () => {
  it("peek returns a valid spawn tier", () => {
    const q = new FruitQueue();
    expect(q.peek()).toBeGreaterThanOrEqual(0);
    expect(q.peek()).toBeLessThanOrEqual(MAX_SPAWN_TIER);
  });

  it("peekNext returns a valid spawn tier", () => {
    const q = new FruitQueue();
    expect(q.peekNext()).toBeGreaterThanOrEqual(0);
    expect(q.peekNext()).toBeLessThanOrEqual(MAX_SPAWN_TIER);
  });

  it("consume returns current peek value", () => {
    const q = new FruitQueue();
    const first = q.peek();
    expect(q.consume()).toBe(first);
  });

  it("queue advances after consume", () => {
    const q = new FruitQueue();
    const second = q.peekNext();
    q.consume();
    expect(q.peek()).toBe(second);
  });

  it("queue always has at least two items after multiple consumes", () => {
    const q = new FruitQueue();
    for (let i = 0; i < 20; i++) {
      q.consume();
      expect(q.peek()).toBeGreaterThanOrEqual(0);
      expect(q.peekNext()).toBeGreaterThanOrEqual(0);
    }
  });

  it("never spawns above MAX_SPAWN_TIER across many samples", () => {
    const q = new FruitQueue();
    for (let i = 0; i < 200; i++) {
      expect(q.consume()).toBeLessThanOrEqual(MAX_SPAWN_TIER);
    }
  });
});
