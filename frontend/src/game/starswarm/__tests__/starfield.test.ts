import { initStarfield, tickStarfield } from "../starfield";

describe("initStarfield", () => {
  it("produces the expected total star count (50 + 30 + 15 = 95)", () => {
    const state = initStarfield(400, 800);
    expect(state.stars).toHaveLength(95);
  });

  it("all stars start within canvas bounds", () => {
    const state = initStarfield(400, 800);
    for (const s of state.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(400);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(800);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = initStarfield(400, 800, 1);
    const b = initStarfield(400, 800, 1);
    expect(a.stars[0]).toEqual(b.stars[0]);
    expect(a.stars[94]).toEqual(b.stars[94]);
  });

  it("produces different layouts for different seeds", () => {
    const a = initStarfield(400, 800, 1);
    const b = initStarfield(400, 800, 2);
    expect(a.stars[0].x).not.toBeCloseTo(b.stars[0].x, 3);
  });

  it("stores width and height on state", () => {
    const state = initStarfield(320, 640);
    expect(state.width).toBe(320);
    expect(state.height).toBe(640);
  });
});

describe("tickStarfield", () => {
  it("scrolls stars downward by speed * dt", () => {
    const state = initStarfield(400, 800, 7);
    const first = state.stars[0];
    const next = tickStarfield(state, 100);
    expect(next.stars[0].y).toBeCloseTo(first.y + first.speed * 100);
  });

  it("wraps stars that scroll past the bottom back to the top", () => {
    const state = initStarfield(400, 100, 7);
    // Push a star to just below the bottom edge.
    const patched = {
      ...state,
      stars: [{ ...state.stars[0], y: 99, speed: 0.1 }, ...state.stars.slice(1)],
    };
    const next = tickStarfield(patched, 100); // moves +10px → y=109, wraps to 9
    expect(next.stars[0].y).toBeCloseTo(9, 1);
  });

  it("does not mutate the original state", () => {
    const state = initStarfield(400, 800, 7);
    const originalY = state.stars[0].y;
    tickStarfield(state, 1000);
    expect(state.stars[0].y).toBe(originalY);
  });

  it("preserves star count after tick", () => {
    const state = initStarfield(400, 800);
    const next = tickStarfield(state, 16);
    expect(next.stars).toHaveLength(state.stars.length);
  });
});
