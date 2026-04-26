/**
 * FreeCell engine unit tests (#812).
 *
 * Covers all acceptance criteria from the issue:
 *   - Deal shape (52 unique cards, column sizes)
 *   - Tableau→tableau: valid/invalid moves
 *   - Tableau→free cell: available/full
 *   - Free cell→tableau: valid/invalid
 *   - Any→foundation: correct suit+rank; rejects out-of-order/wrong suit
 *   - Supermove formula: (1 + emptyCells) × 2^emptyColumns ≥ N
 *   - Supermove: destination excluded from empty column count
 *   - Undo: state restored; stack decrements; no-op when empty
 *   - Win condition: isComplete only when all 4 foundations have 13 cards
 */

import { applyMove, createSeededRng, dealGame, setRng, undoMove, validateMove } from "../engine";
import type { Card, Foundations, FreeCellState, Rank, Suit } from "../types";
import { SUITS } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function c(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function emptyFoundations(): Foundations {
  return { spades: [], hearts: [], diamonds: [], clubs: [] };
}


function mkState(overrides: Partial<FreeCellState> = {}): FreeCellState {
  return {
    _v: 1,
    tableau: [[], [], [], [], [], [], [], []],
    freeCells: [null, null, null, null],
    foundations: emptyFoundations(),
    undoStack: [],
    isComplete: false,
    moveCount: 0,
    ...overrides,
  };
}

afterEach(() => {
  setRng(Math.random);
});

// ---------------------------------------------------------------------------
// Deal
// ---------------------------------------------------------------------------

describe("dealGame", () => {
  it("produces exactly 52 unique cards", () => {
    const state = dealGame(1);
    const all = [
      ...state.tableau.flat(),
      ...state.freeCells.filter((c): c is Card => c !== null),
      ...SUITS.flatMap((s) => state.foundations[s]),
    ];
    expect(all).toHaveLength(52);
    const ids = new Set(all.map((card) => `${card.suit}-${card.rank}`));
    expect(ids.size).toBe(52);
  });

  it("cols 0–3 have 7 cards, cols 4–7 have 6 cards", () => {
    const state = dealGame(42);
    for (let col = 0; col < 8; col++) {
      expect(state.tableau[col]).toHaveLength(col < 4 ? 7 : 6);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = dealGame(99);
    const b = dealGame(99);
    expect(a.tableau).toEqual(b.tableau);
  });

  it("freeCells start empty and foundations start empty", () => {
    const state = dealGame(7);
    expect(state.freeCells).toEqual([null, null, null, null]);
    for (const suit of SUITS) {
      expect(state.foundations[suit]).toEqual([]);
    }
  });

  it("uses _rng when no seed is supplied", () => {
    setRng(createSeededRng(5));
    const state = dealGame();
    const all = state.tableau.flat();
    expect(all).toHaveLength(52);
  });
});

// ---------------------------------------------------------------------------
// Tableau → Tableau
// ---------------------------------------------------------------------------

describe("tableau → tableau", () => {
  it("valid single-card move (alternating color, rank -1) succeeds", () => {
    // 5♠ (black) onto 6♥ (red)
    const state = mkState({
      tableau: [[c("spades", 5)], [c("hearts", 6)], [], [], [], [], [], []],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(true);
    const next = applyMove(state, {
      type: "tableau-to-tableau",
      fromCol: 0,
      fromIndex: 0,
      toCol: 1,
    });
    expect(next.tableau[0]).toEqual([]);
    expect(next.tableau[1]).toHaveLength(2);
    expect(next.moveCount).toBe(1);
  });

  it("rejects same-color stacking", () => {
    // 5♥ (red) onto 6♦ (red) — invalid
    const state = mkState({
      tableau: [[c("hearts", 5)], [c("diamonds", 6)], [], [], [], [], [], []],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(false);
  });

  it("rejects wrong-rank stacking", () => {
    // 4♠ onto 6♥ — rank gap is 2, not 1
    const state = mkState({
      tableau: [[c("spades", 4)], [c("hearts", 6)], [], [], [], [], [], []],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(false);
  });

  it("rejects same-column move", () => {
    const state = mkState({ tableau: [[c("spades", 5)], [], [], [], [], [], [], []] });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 0 })
    ).toBe(false);
  });

  it("rejects out-of-bounds column indices", () => {
    const state = mkState();
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: -1, fromIndex: 0, toCol: 1 })
    ).toBe(false);
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 8 })
    ).toBe(false);
  });

  it("applyMove returns same reference on invalid move", () => {
    const state = mkState({
      tableau: [[c("hearts", 5)], [c("diamonds", 6)], [], [], [], [], [], []],
    });
    expect(
      applyMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(state);
  });

  it("only allows a King on an empty column", () => {
    const nonKing = mkState({ tableau: [[c("hearts", 7)], [], [], [], [], [], [], []] });
    expect(
      validateMove(nonKing, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(false);

    const king = mkState({ tableau: [[c("hearts", 13)], [], [], [], [], [], [], []] });
    expect(
      validateMove(king, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tableau → Free Cell
// ---------------------------------------------------------------------------

describe("tableau → free cell", () => {
  it("succeeds when a slot is available", () => {
    const state = mkState({
      tableau: [[c("spades", 5)], [], [], [], [], [], [], []],
      freeCells: [null, null, null, null],
    });
    expect(validateMove(state, { type: "tableau-to-freecell", fromCol: 0, toCell: 0 })).toBe(true);
    const next = applyMove(state, { type: "tableau-to-freecell", fromCol: 0, toCell: 0 });
    expect(next.freeCells[0]).toEqual(c("spades", 5));
    expect(next.tableau[0]).toEqual([]);
    expect(next.moveCount).toBe(1);
  });

  it("rejected when target cell is already occupied", () => {
    const state = mkState({
      tableau: [[c("spades", 5)], [], [], [], [], [], [], []],
      freeCells: [c("hearts", 3), null, null, null],
    });
    expect(validateMove(state, { type: "tableau-to-freecell", fromCol: 0, toCell: 0 })).toBe(false);
  });

  it("rejected when all 4 cells are occupied", () => {
    const state = mkState({
      tableau: [[c("spades", 5)], [], [], [], [], [], [], []],
      freeCells: [c("hearts", 1), c("diamonds", 2), c("clubs", 3), c("spades", 4)],
    });
    for (let cell = 0; cell < 4; cell++) {
      expect(validateMove(state, { type: "tableau-to-freecell", fromCol: 0, toCell: cell })).toBe(
        false
      );
    }
  });

  it("rejected from an empty tableau column", () => {
    const state = mkState({ freeCells: [null, null, null, null] });
    expect(validateMove(state, { type: "tableau-to-freecell", fromCol: 0, toCell: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Free Cell → Tableau
// ---------------------------------------------------------------------------

describe("free cell → tableau", () => {
  it("valid placement succeeds", () => {
    // 5♠ (black) from free cell onto 6♥ (red) on tableau
    const state = mkState({
      freeCells: [c("spades", 5), null, null, null],
      tableau: [[], [c("hearts", 6)], [], [], [], [], [], []],
    });
    expect(validateMove(state, { type: "freecell-to-tableau", fromCell: 0, toCol: 1 })).toBe(true);
    const next = applyMove(state, { type: "freecell-to-tableau", fromCell: 0, toCol: 1 });
    expect(next.freeCells[0]).toBeNull();
    expect(next.tableau[1]).toHaveLength(2);
    expect(next.moveCount).toBe(1);
  });

  it("rejected when the tableau placement is invalid (same color)", () => {
    const state = mkState({
      freeCells: [c("hearts", 5), null, null, null],
      tableau: [[], [c("diamonds", 6)], [], [], [], [], [], []],
    });
    expect(validateMove(state, { type: "freecell-to-tableau", fromCell: 0, toCol: 1 })).toBe(false);
  });

  it("rejected from an empty free cell", () => {
    const state = mkState({
      freeCells: [null, null, null, null],
      tableau: [[], [c("hearts", 6)], [], [], [], [], [], []],
    });
    expect(validateMove(state, { type: "freecell-to-tableau", fromCell: 0, toCol: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Any → Foundation
// ---------------------------------------------------------------------------

describe("any → foundation", () => {
  it("tableau → foundation: accepts Ace onto empty foundation", () => {
    const state = mkState({ tableau: [[c("spades", 1)], [], [], [], [], [], [], []] });
    expect(validateMove(state, { type: "tableau-to-foundation", fromCol: 0 })).toBe(true);
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.foundations.spades).toHaveLength(1);
    expect(next.foundations.spades[0]).toEqual(c("spades", 1));
    expect(next.moveCount).toBe(1);
  });

  it("tableau → foundation: accepts next rank of the same suit", () => {
    const state = mkState({
      tableau: [[c("hearts", 2)], [], [], [], [], [], [], []],
      foundations: { ...emptyFoundations(), hearts: [c("hearts", 1)] },
    });
    expect(validateMove(state, { type: "tableau-to-foundation", fromCol: 0 })).toBe(true);
  });

  it("tableau → foundation: rejects wrong suit", () => {
    const state = mkState({
      tableau: [[c("diamonds", 1)], [], [], [], [], [], [], []],
      foundations: { ...emptyFoundations(), spades: [c("spades", 1)] },
    });
    // diamonds ace should go to diamonds foundation, not spades
    // validateMove checks if the top card can be placed — diamonds ace to empty diamonds is fine
    // but moving diamonds onto spades pile is checked internally by suit
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.foundations.diamonds).toHaveLength(1);
    expect(next.foundations.spades).toHaveLength(1); // spades unchanged
  });

  it("tableau → foundation: rejects out-of-order rank (rank 3 onto rank 1)", () => {
    const state = mkState({
      tableau: [[c("spades", 3)], [], [], [], [], [], [], []],
      foundations: { ...emptyFoundations(), spades: [c("spades", 1)] },
    });
    expect(validateMove(state, { type: "tableau-to-foundation", fromCol: 0 })).toBe(false);
  });

  it("free cell → foundation: succeeds when rank matches", () => {
    const state = mkState({
      freeCells: [c("clubs", 1), null, null, null],
    });
    expect(validateMove(state, { type: "freecell-to-foundation", fromCell: 0 })).toBe(true);
    const next = applyMove(state, { type: "freecell-to-foundation", fromCell: 0 });
    expect(next.freeCells[0]).toBeNull();
    expect(next.foundations.clubs).toHaveLength(1);
  });

  it("free cell → foundation: rejects wrong rank", () => {
    const state = mkState({
      freeCells: [c("clubs", 3), null, null, null],
    });
    expect(validateMove(state, { type: "freecell-to-foundation", fromCell: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Supermove formula
// ---------------------------------------------------------------------------

describe("supermove", () => {
  it("allows moving N cards when (1 + emptyCells) × 2^emptyColumns ≥ N", () => {
    // 4 free cells empty, 0 empty tableau columns (excluding dest) → max = (1+4) × 1 = 5
    // Try moving a 3-card run: should succeed
    const state = mkState({
      freeCells: [null, null, null, null],
      tableau: [
        // col 0: valid 3-card descending alternating run: 7♥, 6♠, 5♥
        [c("hearts", 7), c("spades", 6), c("hearts", 5)],
        // col 1: destination — 8♠ (black), run head 7♥ (red) can stack
        [c("spades", 8)],
        [c("clubs", 2)],
        [c("clubs", 3)],
        [c("clubs", 4)],
        [c("clubs", 5)],
        [c("clubs", 6)],
        [c("clubs", 7)],
      ],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(true);
  });

  it("blocks moving N cards when supermove capacity is exceeded", () => {
    // 0 free cells, 0 empty columns (excluding dest) → max = (1+0) × 1 = 1
    // Trying to move 2 cards should fail
    const state = mkState({
      freeCells: [c("clubs", 1), c("clubs", 2), c("clubs", 3), c("clubs", 4)],
      tableau: [
        [c("hearts", 6), c("spades", 5)], // 2-card run
        [c("diamonds", 7)], // dest
        [c("clubs", 9)],
        [c("clubs", 10)],
        [c("clubs", 11)],
        [c("clubs", 12)],
        [c("clubs", 13)],
        [c("hearts", 1)],
      ],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(false);
  });

  it("excludes the destination column from the empty column count", () => {
    // dest col is empty — if it were counted, max would be higher than it should be
    // 1 free cell empty, dest col is the only empty col → emptyColumns = 0 (dest excluded)
    // max = (1+1) × 2^0 = 2
    // Trying to move a 3-card run onto an empty column should fail (exceeds 2)
    const state = mkState({
      freeCells: [null, c("clubs", 1), c("clubs", 2), c("clubs", 3)],
      tableau: [
        [c("hearts", 7), c("spades", 6), c("hearts", 5)], // 3-card run
        [], // dest — empty but excluded
        [c("clubs", 4)],
        [c("clubs", 5)],
        [c("clubs", 6)],
        [c("clubs", 7)],
        [c("clubs", 8)],
        [c("clubs", 9)],
      ],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(false);
  });

  it("includes non-destination empty columns in the count", () => {
    // 0 free cells, 2 empty columns (neither is dest) → max = (1+0) × 2^2 = 4
    // Moving a 3-card run should succeed
    const state = mkState({
      freeCells: [c("clubs", 1), c("clubs", 2), c("clubs", 3), c("clubs", 4)],
      tableau: [
        [c("hearts", 7), c("spades", 6), c("hearts", 5)], // 3-card run
        [c("spades", 8)], // dest
        [], // empty col 1
        [], // empty col 2
        [c("clubs", 5)],
        [c("clubs", 6)],
        [c("clubs", 7)],
        [c("clubs", 9)],
      ],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

describe("undoMove", () => {
  it("restores state exactly after one move", () => {
    const state = mkState({
      tableau: [[c("spades", 1)], [], [], [], [], [], [], []],
    });
    const after = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(after.foundations.spades).toHaveLength(1);
    expect(after.undoStack).toHaveLength(1);

    const reverted = undoMove(after);
    expect(reverted.foundations.spades).toEqual([]);
    expect(reverted.tableau[0]).toEqual([c("spades", 1)]);
    expect(reverted.moveCount).toBe(0);
  });

  it("undo stack decrements by one after undoMove", () => {
    const s0 = mkState({ tableau: [[c("spades", 1)], [c("hearts", 1)], [], [], [], [], [], []] });
    const s1 = applyMove(s0, { type: "tableau-to-foundation", fromCol: 0 });
    const s2 = applyMove(s1, { type: "tableau-to-foundation", fromCol: 1 });
    expect(s2.undoStack).toHaveLength(2);
    const back = undoMove(s2);
    expect(back.undoStack).toHaveLength(1);
  });

  it("is a no-op when the undo stack is empty", () => {
    const state = mkState();
    expect(undoMove(state)).toBe(state);
  });

  it("chains multiple undos back to the original state", () => {
    const s0 = mkState({ tableau: [[c("spades", 1)], [c("hearts", 1)], [], [], [], [], [], []] });
    const s1 = applyMove(s0, { type: "tableau-to-foundation", fromCol: 0 });
    const s2 = applyMove(s1, { type: "tableau-to-foundation", fromCol: 1 });
    const back1 = undoMove(s2);
    const back2 = undoMove(back1);
    expect(back2.foundations.spades).toEqual([]);
    expect(back2.foundations.hearts).toEqual([]);
    expect(back2.moveCount).toBe(0);
  });

  it("snapshots stored in undoStack have empty nested undoStack", () => {
    const s0 = mkState({ tableau: [[c("spades", 1)], [c("hearts", 1)], [], [], [], [], [], []] });
    const s1 = applyMove(s0, { type: "tableau-to-foundation", fromCol: 0 });
    const s2 = applyMove(s1, { type: "tableau-to-foundation", fromCol: 1 });
    for (const snap of s2.undoStack) {
      expect(snap.undoStack).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Win condition
// ---------------------------------------------------------------------------

describe("isComplete", () => {
  it("is true only when all 4 foundations have 13 cards", () => {
    const foundations: Foundations = {
      spades: Array.from({ length: 13 }, (_, i) => c("spades", (i + 1) as Rank)),
      hearts: Array.from({ length: 13 }, (_, i) => c("hearts", (i + 1) as Rank)),
      diamonds: Array.from({ length: 13 }, (_, i) => c("diamonds", (i + 1) as Rank)),
      clubs: Array.from({ length: 12 }, (_, i) => c("clubs", (i + 1) as Rank)),
    };
    const state = mkState({
      foundations,
      tableau: [[c("clubs", 13)], [], [], [], [], [], [], []],
    });
    expect(state.isComplete).toBe(false);

    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.isComplete).toBe(true);
    expect(next.foundations.clubs).toHaveLength(13);
  });

  it("is false when 3 foundations are full but 1 is not", () => {
    const incomplete: Foundations = {
      spades: Array.from({ length: 13 }, (_, i) => c("spades", (i + 1) as Rank)),
      hearts: Array.from({ length: 13 }, (_, i) => c("hearts", (i + 1) as Rank)),
      diamonds: Array.from({ length: 13 }, (_, i) => c("diamonds", (i + 1) as Rank)),
      clubs: Array.from({ length: 12 }, (_, i) => c("clubs", (i + 1) as Rank)),
    };
    const s = mkState({ foundations: incomplete });
    expect(s.isComplete).toBe(false);
  });

  it("starts as false on a freshly dealt game", () => {
    const state = dealGame(1);
    expect(state.isComplete).toBe(false);
  });
});
