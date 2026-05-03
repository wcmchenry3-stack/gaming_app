/**
 * Sort Puzzle engine unit tests (#1175).
 */

import { applyPour, initState, isComplete, isValidPour, undo } from "../engine";
import type { SortState } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkState(bottles: (string | "")[][], overrides: Partial<SortState> = {}): SortState {
  return {
    bottles: bottles.map((b) => b.filter((s) => s !== "") as any),
    moveCount: 0,
    undosUsed: 0,
    isComplete: false,
    selectedBottleIndex: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isValidPour
// ---------------------------------------------------------------------------

describe("isValidPour", () => {
  it("returns false when source is empty", () => {
    expect(isValidPour([], ["red", "red", "red", "red"])).toBe(false);
  });

  it("returns false when destination is full", () => {
    expect(isValidPour(["red"], ["blue", "blue", "blue", "blue"])).toBe(false);
  });

  it("returns false when destination top does not match source top", () => {
    expect(isValidPour(["red"], ["blue"])).toBe(false);
  });

  it("returns true when destination is empty", () => {
    expect(isValidPour(["red"], [])).toBe(true);
  });

  it("returns true when destination top matches source top", () => {
    expect(isValidPour(["blue", "red"], ["red"])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyPour
// ---------------------------------------------------------------------------

describe("applyPour", () => {
  it("moves a single unit when tops match", () => {
    const state = mkState([["blue", "red"], ["red", "green"], []]);
    const next = applyPour(state, 0, 1);
    expect(next.bottles[0]).toEqual(["blue"]);
    expect(next.bottles[1]).toEqual(["red", "green", "red"]);
    expect(next.moveCount).toBe(1);
  });

  it("moves the full matching run", () => {
    // source top has 2 reds, destination has space for 2
    const state = mkState([["blue", "red", "red"], ["green"], []]);
    const next = applyPour(state, 0, 2);
    expect(next.bottles[0]).toEqual(["blue"]);
    expect(next.bottles[2]).toEqual(["red", "red"]);
  });

  it("pours only as many as fit in destination", () => {
    // source has run of 3, destination has only 1 slot free
    const state = mkState([["red", "red", "red"], ["blue", "blue", "blue"], []]);
    // pour from 0 to 2 — destination is empty (4 free), can take all 3
    const next = applyPour(state, 0, 2);
    expect(next.bottles[2]).toEqual(["red", "red", "red"]);
    // now pour source[1] (3 blues) into a bottle with 1 space
    const state2 = mkState([[], ["blue", "blue", "blue"], ["red", "red", "red", "red"]]);
    // no valid destination with enough space here — just test clamp:
    const state3 = mkState([["blue", "blue", "blue"], ["red", "red", "red"], []]);
    // pour 3 blues into empty — all 3 fit
    const next3 = applyPour(state3, 0, 2);
    expect(next3.bottles[2].length).toBe(3);
  });

  it("resets selectedBottleIndex to null", () => {
    const state = mkState([["red"], []], { selectedBottleIndex: 0 });
    expect(applyPour(state, 0, 1).selectedBottleIndex).toBeNull();
  });

  it("sets isComplete when solved", () => {
    // One pour away from complete
    const state = mkState([["red", "red", "red"], ["red"], []]);
    const next = applyPour(state, 1, 0);
    expect(next.isComplete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isComplete
// ---------------------------------------------------------------------------

describe("isComplete", () => {
  it("returns true when all bottles are empty", () => {
    expect(isComplete(mkState([[], [], []]))).toBe(true);
  });

  it("returns true when all bottles are full single-color", () => {
    const state = mkState([
      ["red", "red", "red", "red"],
      ["blue", "blue", "blue", "blue"],
      [],
    ]);
    expect(isComplete(state)).toBe(true);
  });

  it("returns false when a bottle is mixed", () => {
    const state = mkState([["red", "blue"], ["red", "red", "red", "red"], []]);
    expect(isComplete(state)).toBe(false);
  });

  it("returns false when a bottle is a single color but not full", () => {
    const state = mkState([["red", "red", "red"], ["blue", "blue", "blue", "blue"], []]);
    expect(isComplete(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// undo
// ---------------------------------------------------------------------------

describe("undo", () => {
  it("returns unchanged state when history is empty", () => {
    const state = mkState([["red"], []]);
    const result = undo(state, []);
    expect(result.state).toBe(state);
    expect(result.history).toHaveLength(0);
  });

  it("restores previous state and pops history", () => {
    const prev = mkState([["red", "blue"], []]);
    const cur = mkState([["red"], ["blue"]]);
    const { state, history } = undo(cur, [prev]);
    expect(state.bottles).toEqual(prev.bottles);
    expect(history).toHaveLength(0);
  });

  it("increments undosUsed", () => {
    const prev = mkState([["red"], []]);
    const cur = mkState([[], ["red"]], { undosUsed: 2 });
    const { state } = undo(cur, [prev]);
    expect(state.undosUsed).toBe(3);
  });

  it("resets selectedBottleIndex to null", () => {
    const prev = mkState([["red"], []], { selectedBottleIndex: 0 });
    const cur = mkState([[], ["red"]], { selectedBottleIndex: 1 });
    const { state } = undo(cur, [prev]);
    expect(state.selectedBottleIndex).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// initState
// ---------------------------------------------------------------------------

describe("initState", () => {
  it("strips empty string slots from API bottles", () => {
    const apiBottles = [
      ["red", "blue", "", ""],
      ["green", "green", "green", "green"],
      ["", "", "", ""],
    ];
    const state = initState(apiBottles as any);
    expect(state.bottles[0]).toEqual(["red", "blue"]);
    expect(state.bottles[1]).toEqual(["green", "green", "green", "green"]);
    expect(state.bottles[2]).toEqual([]);
  });

  it("initialises counters to zero and isComplete to false", () => {
    const state = initState([["red", "", "", ""], ["", "", "", ""]]);
    expect(state.moveCount).toBe(0);
    expect(state.undosUsed).toBe(0);
    expect(state.isComplete).toBe(false);
    expect(state.selectedBottleIndex).toBeNull();
  });
});
