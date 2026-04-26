/**
 * Solitaire engine unit tests (#593).
 *
 * Covers all acceptance criteria from the issue:
 *   - Deck uniqueness (52 unique cards, all face-down from createDeck)
 *   - Deal shape (column sizes, face-up/down distribution, 24 in stock)
 *   - Each scoring event
 *   - Undo reversibility + cap + nested stripping
 *   - Recycle penalty (first free, -50 after)
 *   - Auto-complete detection (true/false) + stepwise drain
 *   - Win detection + +500 bonus applied once
 *   - Score floor (never negative)
 *   - Invalid move rejection (returns unchanged state)
 */

import {
  applyMove,
  autoComplete,
  canAutoComplete,
  createDeck,
  createSeededRng,
  dealGame,
  drawFromStock,
  recycleWaste,
  setRng,
  undo,
  validateMove,
} from "../engine";
import type { Card, Foundations, GameEvent, Rank, SolitaireState, Suit } from "../types";
import { SUITS } from "../types";

// ---------------------------------------------------------------------------
// Helpers — mint hand-crafted states so tests don't depend on a real deal.
// ---------------------------------------------------------------------------

function c(suit: Suit, rank: Rank, faceUp = true): Card {
  return { suit, rank, faceUp };
}

function emptyFoundations(): Foundations {
  return { spades: [], hearts: [], diamonds: [], clubs: [] };
}

function mkState(overrides: Partial<SolitaireState> = {}): SolitaireState {
  return {
    _v: 1,
    drawMode: 1,
    tableau: [[], [], [], [], [], [], []],
    foundations: emptyFoundations(),
    stock: [],
    waste: [],
    score: 0,
    recycleCount: 0,
    undoStack: [],
    isComplete: false,
    ...overrides,
  };
}

afterEach(() => {
  // Tests that call setRng must not leak determinism into later tests.
  setRng(Math.random);
});

// ---------------------------------------------------------------------------
// Deck + deal
// ---------------------------------------------------------------------------

describe("createDeck", () => {
  it("returns 52 unique cards, all face-down", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const ids = new Set(deck.map((card) => `${card.suit}-${card.rank}`));
    expect(ids.size).toBe(52);
    expect(deck.every((card) => !card.faceUp)).toBe(true);
  });
});

describe("dealGame", () => {
  it("lays out 7 columns sized 1..7 with only the top card face-up", () => {
    const state = dealGame(1, 42);
    expect(state.tableau).toHaveLength(7);
    state.tableau.forEach((col, i) => {
      expect(col).toHaveLength(i + 1);
      col.forEach((card, j) => {
        expect(card.faceUp).toBe(j === i);
      });
    });
  });

  it("puts the remaining 24 cards face-down in stock", () => {
    const state = dealGame(1, 7);
    expect(state.stock).toHaveLength(24);
    expect(state.stock.every((card) => !card.faceUp)).toBe(true);
    expect(state.waste).toEqual([]);
  });

  it("places every card of the 52-card deck exactly once", () => {
    const state = dealGame(3, 99);
    const all = [
      ...state.tableau.flat(),
      ...state.stock,
      ...state.waste,
      ...SUITS.flatMap((suit) => state.foundations[suit]),
    ];
    const ids = new Set(all.map((card) => `${card.suit}-${card.rank}`));
    expect(ids.size).toBe(52);
  });

  it("is deterministic for a given seed", () => {
    const a = dealGame(1, 123);
    const b = dealGame(1, 123);
    expect(a.tableau).toEqual(b.tableau);
    expect(a.stock).toEqual(b.stock);
  });

  it("picks a seed from the bank when none is supplied (draw-1)", () => {
    setRng(createSeededRng(1));
    const state = dealGame(1);
    expect(state.tableau).toHaveLength(7);
    expect(state.stock).toHaveLength(24);
  });

  it("picks a seed from the bank when none is supplied (draw-3)", () => {
    setRng(createSeededRng(1));
    const state = dealGame(3);
    expect(state.drawMode).toBe(3);
    expect(state.tableau).toHaveLength(7);
  });
});

describe("createSeededRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const aSeq = [a(), a(), a()];
    const bSeq = [b(), b(), b()];
    expect(aSeq).toEqual(bSeq);
  });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe("scoring", () => {
  it("waste → tableau gives +5", () => {
    const state = mkState({
      waste: [c("hearts", 12)],
      tableau: [[c("spades", 13)], [], [], [], [], [], []],
    });
    const next = applyMove(state, { type: "waste-to-tableau", toCol: 0 });
    expect(next.score).toBe(5);
    expect(next.waste).toEqual([]);
    expect(next.tableau[0]).toHaveLength(2);
  });

  it("waste → foundation gives +10", () => {
    const state = mkState({ waste: [c("spades", 1)] });
    const next = applyMove(state, { type: "waste-to-foundation" });
    expect(next.score).toBe(10);
    expect(next.foundations.spades).toHaveLength(1);
  });

  it("tableau → foundation gives +10", () => {
    const state = mkState({
      tableau: [[c("hearts", 1)], [], [], [], [], [], []],
    });
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.score).toBe(10);
    expect(next.foundations.hearts).toHaveLength(1);
    expect(next.tableau[0]).toEqual([]);
  });

  it("foundation → tableau costs -15", () => {
    // K♥ (red) onto an empty column is valid and costs -15.
    const state = mkState({
      score: 50,
      foundations: { ...emptyFoundations(), hearts: [c("hearts", 13)] },
      tableau: [[], [], [], [], [], [], []],
    });
    const next = applyMove(state, {
      type: "foundation-to-tableau",
      fromSuit: "hearts",
      toCol: 0,
    });
    expect(next.score).toBe(35);
    expect(next.tableau[0]).toHaveLength(1);
    expect(next.foundations.hearts).toEqual([]);
  });

  it("auto-reveals a newly uncovered face-down card and gives +5", () => {
    const state = mkState({
      tableau: [[c("hearts", 2, false), c("spades", 1)], [], [], [], [], [], []],
    });
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.score).toBe(10 + 5);
    expect(next.tableau[0]).toHaveLength(1);
    expect(next.tableau[0]?.[0]?.faceUp).toBe(true);
  });

  it("clamps score at 0 even when a -15 move would push it negative", () => {
    const state = mkState({
      score: 5,
      foundations: { ...emptyFoundations(), hearts: [c("hearts", 13)] },
      tableau: [[], [], [], [], [], [], []],
    });
    const next = applyMove(state, {
      type: "foundation-to-tableau",
      fromSuit: "hearts",
      toCol: 0,
    });
    expect(next.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

describe("undo", () => {
  it("reverts the previous move", () => {
    const state = mkState({
      waste: [c("spades", 1)],
    });
    const after = applyMove(state, { type: "waste-to-foundation" });
    const reverted = undo(after);
    expect(reverted.waste).toEqual([c("spades", 1)]);
    expect(reverted.foundations.spades).toEqual([]);
    expect(reverted.score).toBe(0);
  });

  it("returns the state unchanged when the stack is empty", () => {
    const state = mkState();
    expect(undo(state)).toBe(state);
  });

  it("caps the undo stack at 50 entries", () => {
    let state = mkState({
      stock: Array.from({ length: 60 }, (_, i) =>
        c(SUITS[i % 4] as Suit, ((i % 13) + 1) as Rank, false)
      ),
    });
    for (let i = 0; i < 55; i++) {
      const next = drawFromStock(state);
      if (next === state) break;
      state = next;
    }
    expect(state.undoStack.length).toBeLessThanOrEqual(50);
  });

  it("chains undos back across multiple moves", () => {
    const base = mkState({
      stock: [c("clubs", 5, false), c("hearts", 7, false), c("spades", 3, false)],
    });
    const d1 = drawFromStock(base);
    const d2 = drawFromStock(d1);
    expect(d2.waste).toHaveLength(2);
    const back1 = undo(d2);
    expect(back1.waste).toHaveLength(1);
    const back2 = undo(back1);
    expect(back2.waste).toHaveLength(0);
    expect(back2.stock).toHaveLength(3);
  });

  it("strips nested undoStack to [] in snapshots to prevent exponential nesting", () => {
    const state = mkState({
      stock: [c("clubs", 5, false), c("hearts", 7, false)],
    });
    const d1 = drawFromStock(state);
    const d2 = drawFromStock(d1);
    // Each snapshot inside d2.undoStack must have undoStack === [].
    for (const snap of d2.undoStack) {
      expect(snap.undoStack).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Stock / recycle
// ---------------------------------------------------------------------------

describe("drawFromStock", () => {
  it("moves drawMode cards from stock to waste (top first)", () => {
    const state = mkState({
      drawMode: 3,
      stock: [
        c("spades", 1, false),
        c("hearts", 2, false),
        c("diamonds", 3, false),
        c("clubs", 4, false),
      ],
    });
    const next = drawFromStock(state);
    expect(next.waste.map((card) => card.rank)).toEqual([4, 3, 2]);
    expect(next.waste.every((card) => card.faceUp)).toBe(true);
    expect(next.stock).toHaveLength(1);
  });

  it("is a no-op when stock is empty", () => {
    const state = mkState();
    expect(drawFromStock(state)).toBe(state);
  });
});

describe("recycleWaste", () => {
  it("first recycle is free", () => {
    const state = mkState({
      score: 10,
      stock: [],
      waste: [c("spades", 1), c("hearts", 2)],
    });
    const next = recycleWaste(state);
    expect(next.score).toBe(10);
    expect(next.recycleCount).toBe(1);
    expect(next.stock).toHaveLength(2);
    expect(next.waste).toEqual([]);
    expect(next.stock.every((card) => !card.faceUp)).toBe(true);
  });

  it("second and later recycles cost -50", () => {
    const onceRecycled = mkState({
      score: 80,
      recycleCount: 1,
      stock: [],
      waste: [c("spades", 1)],
    });
    const next = recycleWaste(onceRecycled);
    expect(next.score).toBe(30);
    expect(next.recycleCount).toBe(2);
  });

  it("clamps at 0 when penalty would drop below", () => {
    const state = mkState({
      score: 10,
      recycleCount: 2,
      stock: [],
      waste: [c("spades", 1)],
    });
    const next = recycleWaste(state);
    expect(next.score).toBe(0);
  });

  it("is a no-op when stock still has cards", () => {
    const state = mkState({
      stock: [c("spades", 1, false)],
      waste: [c("hearts", 2)],
    });
    expect(recycleWaste(state)).toBe(state);
  });

  it("is a no-op when waste is empty", () => {
    const state = mkState();
    expect(recycleWaste(state)).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Win detection + bonus
// ---------------------------------------------------------------------------

describe("win detection", () => {
  it("applies +500 once when the last card reaches the foundation", () => {
    // Build a state where moving the last A→K climax triggers win.
    // Three suits full; clubs at Q; final K♣ sitting on a tableau column.
    const foundations: Foundations = {
      spades: Array.from({ length: 13 }, (_, i) => c("spades", (i + 1) as Rank)),
      hearts: Array.from({ length: 13 }, (_, i) => c("hearts", (i + 1) as Rank)),
      diamonds: Array.from({ length: 13 }, (_, i) => c("diamonds", (i + 1) as Rank)),
      clubs: Array.from({ length: 12 }, (_, i) => c("clubs", (i + 1) as Rank)),
    };
    const state = mkState({
      score: 0,
      foundations,
      tableau: [[c("clubs", 13)], [], [], [], [], [], []],
    });
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.isComplete).toBe(true);
    // Foundation move +10, win bonus +500.
    expect(next.score).toBe(510);
  });
});

// ---------------------------------------------------------------------------
// Invalid moves
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tableau → tableau (multi-card run)
// ---------------------------------------------------------------------------

describe("tableau → tableau", () => {
  it("validates and moves a valid single-card run onto a placeable pile", () => {
    const state = mkState({
      tableau: [[c("spades", 5)], [c("hearts", 6)], [], [], [], [], []],
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
  });

  it("moves a multi-card alternating-color run and reveals the freshly exposed card", () => {
    // Run 6♥ (red) → 5♠ (black), placing onto 7♣ (black) in dest col.
    const state = mkState({
      tableau: [
        [c("clubs", 9, false), c("hearts", 6), c("spades", 5)],
        [c("clubs", 7)],
        [],
        [],
        [],
        [],
        [],
      ],
    });
    const next = applyMove(state, {
      type: "tableau-to-tableau",
      fromCol: 0,
      fromIndex: 1,
      toCol: 1,
    });
    expect(next.tableau[0]).toHaveLength(1);
    expect(next.tableau[0]?.[0]?.faceUp).toBe(true);
    expect(next.score).toBe(5);
    expect(next.tableau[1]?.map((card) => card.rank)).toEqual([7, 6, 5]);
  });

  it("rejects a run that is not a valid alternating-color descending sequence", () => {
    const state = mkState({
      tableau: [
        [c("hearts", 6), c("diamonds", 5)], // same color, invalid run
        [c("spades", 7)],
        [],
        [],
        [],
        [],
        [],
      ],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(false);
  });

  it("rejects fromIndex pointing to a face-down card", () => {
    const state = mkState({
      tableau: [[c("hearts", 6, false), c("spades", 5)], [c("diamonds", 6)], [], [], [], [], []],
    });
    expect(
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 1 })
    ).toBe(false);
  });

  it("rejects same-column moves", () => {
    const state = mkState({
      tableau: [[c("spades", 5)], [], [], [], [], [], []],
    });
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
      validateMove(state, { type: "tableau-to-tableau", fromCol: 0, fromIndex: 0, toCol: 9 })
    ).toBe(false);
  });
});

describe("invalid moves", () => {
  it("validateMove rejects a waste → empty-column move that isn't a King", () => {
    const state = mkState({ waste: [c("hearts", 5)] });
    expect(validateMove(state, { type: "waste-to-tableau", toCol: 0 })).toBe(false);
  });

  it("applyMove emits invalidMove event and returns a new reference on an invalid move", () => {
    const state = mkState({ waste: [c("hearts", 5)] });
    const result = applyMove(state, { type: "waste-to-tableau", toCol: 0 });
    expect(result).not.toBe(state);
    expect(result.events).toContain("invalidMove" as GameEvent);
  });

  it("rejects same-color tableau stacking", () => {
    const state = mkState({
      waste: [c("hearts", 5)],
      tableau: [[c("diamonds", 6)], [], [], [], [], [], []],
    });
    expect(validateMove(state, { type: "waste-to-tableau", toCol: 0 })).toBe(false);
  });

  it("rejects wrong-rank foundation push", () => {
    const state = mkState({
      waste: [c("spades", 5)],
      foundations: { ...emptyFoundations(), spades: [c("spades", 1)] },
    });
    expect(validateMove(state, { type: "waste-to-foundation" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Game events
// ---------------------------------------------------------------------------

describe("game events", () => {
  it("applyMove emits cardPlace on a valid waste-to-foundation move", () => {
    const state = mkState({ waste: [c("spades", 1)] });
    const next = applyMove(state, { type: "waste-to-foundation" });
    expect(next.events).toContain("cardPlace" as GameEvent);
  });

  it("applyMove emits cardFlip when a face-down tableau card is revealed", () => {
    const state = mkState({
      tableau: [
        [c("hearts", 2, false), c("spades", 1)],
        [],
        [],
        [],
        [],
        [],
        [],
      ],
    });
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.events).toContain("cardFlip" as GameEvent);
    expect(next.events).toContain("cardPlace" as GameEvent);
  });

  it("applyMove emits foundationComplete when a suit reaches 13 cards", () => {
    const foundations: Foundations = {
      spades: Array.from({ length: 12 }, (_, i) => c("spades", (i + 1) as Rank)),
      hearts: [],
      diamonds: [],
      clubs: [],
    };
    const state = mkState({
      foundations,
      tableau: [[c("spades", 13)], [], [], [], [], [], []],
    });
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.events).toContain("foundationComplete" as GameEvent);
  });

  it("applyMove emits gameWin when the last card completes all foundations", () => {
    const foundations: Foundations = {
      spades: Array.from({ length: 13 }, (_, i) => c("spades", (i + 1) as Rank)),
      hearts: Array.from({ length: 13 }, (_, i) => c("hearts", (i + 1) as Rank)),
      diamonds: Array.from({ length: 13 }, (_, i) => c("diamonds", (i + 1) as Rank)),
      clubs: Array.from({ length: 12 }, (_, i) => c("clubs", (i + 1) as Rank)),
    };
    const state = mkState({
      foundations,
      tableau: [[c("clubs", 13)], [], [], [], [], [], []],
    });
    const next = applyMove(state, { type: "tableau-to-foundation", fromCol: 0 });
    expect(next.events).toContain("gameWin" as GameEvent);
    expect(next.isComplete).toBe(true);
  });

  it("drawFromStock emits cardFlip", () => {
    const state = mkState({ stock: [c("clubs", 5, false)] });
    const next = drawFromStock(state);
    expect(next.events).toContain("cardFlip" as GameEvent);
  });

  it("events are cleared from undo snapshots so undo does not re-fire them", () => {
    const state = mkState({ waste: [c("spades", 1)] });
    const after = applyMove(state, { type: "waste-to-foundation" });
    expect(after.events).toContain("cardPlace" as GameEvent);
    const reverted = undo(after);
    expect(reverted.events).toBeUndefined();
  });

  it("applyMove does not emit foundationComplete on subsequent moves once already won", () => {
    const foundations: Foundations = {
      spades: Array.from({ length: 13 }, (_, i) => c("spades", (i + 1) as Rank)),
      hearts: Array.from({ length: 13 }, (_, i) => c("hearts", (i + 1) as Rank)),
      diamonds: Array.from({ length: 13 }, (_, i) => c("diamonds", (i + 1) as Rank)),
      clubs: Array.from({ length: 12 }, (_, i) => c("clubs", (i + 1) as Rank)),
    };
    // Win the game first
    const preWin = mkState({
      foundations,
      tableau: [[c("clubs", 13)], [], [], [], [], [], []],
    });
    const won = applyMove(preWin, { type: "tableau-to-foundation", fromCol: 0 });
    expect(won.isComplete).toBe(true);
    // After win, move A♠ back to tableau and then to foundation again — should not re-emit
    const withSpadeOnTableau = {
      ...won,
      foundations: {
        ...won.foundations,
        spades: Array.from({ length: 12 }, (_, i) => c("spades", (i + 1) as Rank)),
      },
      tableau: [[c("spades", 13)], [], [], [], [], [], []],
    };
    const reMove = applyMove(withSpadeOnTableau, { type: "tableau-to-foundation", fromCol: 0 });
    expect(reMove.events).not.toContain("foundationComplete" as GameEvent);
    expect(reMove.events).not.toContain("gameWin" as GameEvent);
  });
});

// ---------------------------------------------------------------------------
// Auto-complete
// ---------------------------------------------------------------------------

describe("canAutoComplete", () => {
  it("is false when any tableau card is face-down", () => {
    const state = mkState({
      tableau: [[c("hearts", 2, false), c("spades", 1)], [], [], [], [], [], []],
    });
    expect(canAutoComplete(state)).toBe(false);
  });

  it("is true when every tableau card is face-up", () => {
    const state = mkState({
      tableau: [[c("hearts", 2), c("spades", 1)], [], [], [], [], [], []],
    });
    expect(canAutoComplete(state)).toBe(true);
  });

  it("is false once the game is complete", () => {
    expect(canAutoComplete(mkState({ isComplete: true }))).toBe(false);
  });
});

describe("autoComplete", () => {
  it("drains stock into waste, then waste into foundation, then tableau → foundation", () => {
    // Two face-up aces sitting on tableau, ready to go. Stock empty.
    const state = mkState({
      tableau: [[c("spades", 1)], [c("hearts", 1)], [], [], [], [], []],
    });
    const s1 = autoComplete(state);
    expect(s1.foundations.spades).toHaveLength(1);
    const s2 = autoComplete(s1);
    expect(s2.foundations.hearts).toHaveLength(1);
  });

  it("returns the input unchanged when no auto step applies", () => {
    // Nothing playable: an off-suit 5 with no foundation to accept it.
    const state = mkState({
      tableau: [[c("hearts", 5)], [], [], [], [], [], []],
    });
    expect(autoComplete(state)).toBe(state);
  });

  it("drains stock first when waste has no playable top", () => {
    const state = mkState({
      stock: [c("clubs", 4, false), c("hearts", 9, false)],
      tableau: [[], [], [], [], [], [], []],
    });
    const next = autoComplete(state);
    expect(next.waste).toHaveLength(1);
    expect(next.stock).toHaveLength(1);
  });

  it("plays the waste top to foundation when eligible", () => {
    const state = mkState({
      waste: [c("spades", 1)],
    });
    const next = autoComplete(state);
    expect(next.foundations.spades).toHaveLength(1);
    expect(next.waste).toEqual([]);
  });

  it("is a no-op when the game is already complete", () => {
    const state = mkState({ isComplete: true });
    expect(autoComplete(state)).toBe(state);
  });
});
