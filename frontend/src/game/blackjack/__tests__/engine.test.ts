/**
 * Tests for the client-side Blackjack engine.
 *
 * Ports backend/tests/test_blackjack_game.py so the two engines behave
 * identically. Covers: hand value, natural blackjack, deck generation,
 * phase transitions, bet validation, payouts, double down, bust,
 * reshuffle threshold.
 */

import {
  newGame,
  placeBet,
  hit,
  stand,
  doubleDown,
  newHand,
  handValue,
  isNaturalBlackjack,
  toViewState,
  EngineState,
  Card,
} from "../engine";

// Helpers ------------------------------------------------------------------

function c(suit: string, rank: string): Card {
  return { suit, rank };
}

function stateInPlayer(chips = 1000, bet = 100): EngineState {
  return {
    chips,
    bet,
    phase: "player",
    outcome: null,
    payout: 0,
    deck: Array(20).fill(c("♠", "5")), // safe 5s — won't over-bust
    player_hand: [c("♠", "7"), c("♥", "8")], // 15
    dealer_hand: [c("♦", "6"), c("♣", "9")], // 15
    doubled: false,
  };
}

function stateInResult(
  chips = 1000,
  bet = 100,
  outcome: EngineState["outcome"] = "push",
  payout = 0
): EngineState {
  return {
    chips,
    bet,
    phase: "result",
    outcome,
    payout,
    deck: Array(30).fill(c("♠", "5")),
    player_hand: [c("♠", "7"), c("♥", "8")],
    dealer_hand: [c("♦", "6"), c("♣", "9")],
    doubled: false,
  };
}

// --- handValue ------------------------------------------------------------

describe("handValue", () => {
  it("empty hand returns 0", () => expect(handValue([])).toBe(0));
  it("numbered cards sum", () => expect(handValue([c("♠", "5"), c("♥", "7")])).toBe(12));
  it("face cards worth 10", () => {
    for (const rank of ["J", "Q", "K"]) expect(handValue([c("♠", rank)])).toBe(10);
  });
  it("10 worth 10", () => expect(handValue([c("♠", "10")])).toBe(10));
  it("ace as 11 when safe", () => expect(handValue([c("♠", "A"), c("♥", "7")])).toBe(18));
  it("ace demotes on bust (A+K+5 = 16)", () =>
    expect(handValue([c("♠", "A"), c("♥", "K"), c("♦", "5")])).toBe(16));
  it("two aces (11+1=12)", () => expect(handValue([c("♠", "A"), c("♥", "A")])).toBe(12));
  it("three aces (11+1+1=13)", () =>
    expect(handValue([c("♠", "A"), c("♥", "A"), c("♦", "A")])).toBe(13));
  it("ace with 10-value = 21", () => expect(handValue([c("♠", "A"), c("♥", "J")])).toBe(21));
  it("bust exceeds 21", () => expect(handValue([c("♠", "K"), c("♥", "Q"), c("♦", "5")])).toBe(25));
  it("exactly 21 three cards", () =>
    expect(handValue([c("♠", "7"), c("♥", "7"), c("♦", "7")])).toBe(21));
});

// --- isNaturalBlackjack ---------------------------------------------------

describe("isNaturalBlackjack", () => {
  it("ace + king", () => expect(isNaturalBlackjack([c("♠", "A"), c("♥", "K")])).toBe(true));
  it("ace + 10", () => expect(isNaturalBlackjack([c("♠", "A"), c("♥", "10")])).toBe(true));
  it("reversed order", () => expect(isNaturalBlackjack([c("♥", "K"), c("♠", "A")])).toBe(true));
  it("21 with 3 cards is not natural", () =>
    expect(isNaturalBlackjack([c("♠", "7"), c("♥", "7"), c("♦", "7")])).toBe(false));
  it("2 cards not 21", () => expect(isNaturalBlackjack([c("♠", "9"), c("♥", "8")])).toBe(false));
});

// --- Fresh game state -----------------------------------------------------

describe("newGame", () => {
  it("starts in betting phase", () => expect(newGame().phase).toBe("betting"));
  it("starts with 1000 chips", () => expect(newGame().chips).toBe(1000));
  it("starts with 52-card deck", () => expect(newGame().deck).toHaveLength(52));
  it("starts with empty hands", () => {
    const g = newGame();
    expect(g.player_hand).toEqual([]);
    expect(g.dealer_hand).toEqual([]);
  });
  it("starts with bet 0, outcome null, payout 0", () => {
    const g = newGame();
    expect(g.bet).toBe(0);
    expect(g.outcome).toBeNull();
    expect(g.payout).toBe(0);
  });
});

// --- Phase machine --------------------------------------------------------

describe("phase machine", () => {
  it("placeBet transitions to player or result", () => {
    const g = placeBet(newGame(), 100);
    expect(["player", "result"]).toContain(g.phase);
  });

  it("hit in wrong phase throws", () => {
    expect(() => hit(newGame())).toThrow(/Not in player phase/);
  });

  it("stand in wrong phase throws", () => {
    expect(() => stand(newGame())).toThrow(/Not in player phase/);
  });

  it("doubleDown in wrong phase throws", () => {
    expect(() => doubleDown(newGame())).toThrow(/Not in player phase/);
  });

  it("newHand in wrong phase throws", () => {
    expect(() => newHand(newGame())).toThrow(/Not in result phase/);
  });

  it("placeBet in wrong phase throws", () => {
    expect(() => placeBet(stateInPlayer(), 100)).toThrow(/Not in betting phase/);
  });

  it("stand reaches result phase", () => {
    expect(stand(stateInPlayer()).phase).toBe("result");
  });

  it("newHand returns to betting", () => {
    expect(newHand(stateInResult()).phase).toBe("betting");
  });

  it("newHand resets bet and outcome", () => {
    const g = newHand(stateInResult(1000, 200, "win", 200));
    expect(g.bet).toBe(0);
    expect(g.outcome).toBeNull();
    expect(g.payout).toBe(0);
  });
});

// --- Bet validation -------------------------------------------------------

describe("bet validation", () => {
  it("below minimum throws", () => expect(() => placeBet(newGame(), 5)).toThrow());
  it("above maximum throws", () => expect(() => placeBet(newGame(), 510)).toThrow());
  it("not multiple of 10 throws", () => expect(() => placeBet(newGame(), 15)).toThrow());
  it("exceeds chips throws", () =>
    expect(() => placeBet({ ...newGame(), chips: 50 }, 100)).toThrow(/Insufficient chips/));
  it("exact chips accepted", () => {
    const g = placeBet({ ...newGame(), chips: 100 }, 100);
    expect(["player", "result"]).toContain(g.phase);
  });
});

// --- Payouts --------------------------------------------------------------

describe("payouts (via stand)", () => {
  it("win pays 1:1", () => {
    // Force player 20 / dealer 18 → player wins
    const base = stateInPlayer(1000, 100);
    const forced: EngineState = {
      ...base,
      player_hand: [c("♠", "K"), c("♥", "Q")], // 20
      dealer_hand: [c("♦", "10"), c("♣", "8")], // 18
      deck: Array(10).fill(c("♠", "5")), // dealer already at 18, stands
    };
    const r = stand(forced);
    expect(r.outcome).toBe("win");
    expect(r.payout).toBe(100);
    expect(r.chips).toBe(1100);
  });

  it("lose deducts bet", () => {
    const base = stateInPlayer(1000, 100);
    const forced: EngineState = {
      ...base,
      player_hand: [c("♠", "9"), c("♥", "7")], // 16
      dealer_hand: [c("♦", "10"), c("♣", "9")], // 19
      deck: Array(10).fill(c("♠", "5")),
    };
    const r = stand(forced);
    expect(r.outcome).toBe("lose");
    expect(r.payout).toBe(-100);
    expect(r.chips).toBe(900);
  });

  it("push returns bet", () => {
    const base = stateInPlayer(1000, 100);
    const forced: EngineState = {
      ...base,
      player_hand: [c("♠", "9"), c("♥", "9")], // 18
      dealer_hand: [c("♦", "10"), c("♣", "8")], // 18
      deck: Array(10).fill(c("♠", "5")),
    };
    const r = stand(forced);
    expect(r.outcome).toBe("push");
    expect(r.payout).toBe(0);
    expect(r.chips).toBe(1000);
  });

  it("chips never go negative", () => {
    const forced: EngineState = {
      ...stateInPlayer(100, 200),
      player_hand: [c("♠", "9"), c("♥", "7")],
      dealer_hand: [c("♦", "10"), c("♣", "9")],
      deck: Array(10).fill(c("♠", "5")),
    };
    const r = stand(forced);
    expect(r.chips).toBeGreaterThanOrEqual(0);
  });
});

describe("blackjack payout (3:2, rounded up)", () => {
  // Force a natural blackjack during placeBet by stacking the deck.
  // Deck is popped from the end; deal order is P, D, P, D.
  // Deck from end: card1 P, card2 D, card3 P, card4 D
  it("blackjack pays ceil(bet * 1.5) — bet 10 → 15", () => {
    const g: EngineState = {
      ...newGame(),
      // Dealer will NOT have natural BJ (6+9=15)
      // Player gets A + K (natural BJ)
      // Deck pop order (last-in-first-out): [..., D=9, P=K, D=6, P=A]
      deck: [
        ...Array(40).fill(c("♠", "2")),
        c("♦", "9"), // D (2nd)
        c("♠", "K"), // P (2nd)
        c("♦", "6"), // D (1st)
        c("♠", "A"), // P (1st)
      ],
    };
    const r = placeBet(g, 10);
    expect(r.outcome).toBe("blackjack");
    expect(r.payout).toBe(15); // ceil(10 * 1.5)
    expect(r.chips).toBe(1015);
  });

  it("blackjack pays ceil(bet * 1.5) — bet 30 → 45", () => {
    const g: EngineState = {
      ...newGame(),
      deck: [...Array(40).fill(c("♠", "2")), c("♦", "9"), c("♠", "K"), c("♦", "6"), c("♠", "A")],
    };
    const r = placeBet(g, 30);
    expect(r.outcome).toBe("blackjack");
    expect(r.payout).toBe(45); // ceil(30 * 1.5)
  });

  it("player + dealer natural blackjack is a push", () => {
    const g: EngineState = {
      ...newGame(),
      // Both hands naturals. Pop order: [..., D=K, P=K, D=A, P=A]
      deck: [
        ...Array(40).fill(c("♠", "2")),
        c("♦", "K"), // D 2nd
        c("♠", "K"), // P 2nd
        c("♦", "A"), // D 1st
        c("♠", "A"), // P 1st
      ],
    };
    const r = placeBet(g, 100);
    expect(r.outcome).toBe("push");
    expect(r.payout).toBe(0);
  });
});

// --- Double down ----------------------------------------------------------

describe("double down", () => {
  it("requires exactly 2 cards", () => {
    const three: EngineState = {
      ...stateInPlayer(),
      player_hand: [c("♠", "7"), c("♥", "8"), c("♦", "2")],
    };
    expect(() => doubleDown(three)).toThrow(/initial two cards/);
  });

  it("requires sufficient chips", () => {
    const broke: EngineState = { ...stateInPlayer(150, 100), chips: 50 };
    expect(() => doubleDown(broke)).toThrow(/Insufficient chips/);
  });

  it("doubles the bet", () => {
    const r = doubleDown(stateInPlayer(500, 100));
    expect(r.bet).toBe(200);
  });

  it("reaches result phase", () => {
    const r = doubleDown(stateInPlayer(500, 100));
    expect(r.phase).toBe("result");
  });

  it("deducts extra chips before settling", () => {
    const r = doubleDown(stateInPlayer(300, 100));
    // Start 300, deduct 100 extra = 200, then ±payout
    if (r.outcome === "win") expect(r.chips).toBe(300 - 100 + 200);
    if (r.outcome === "push") expect(r.chips).toBe(200);
    expect(r.chips).toBeGreaterThanOrEqual(0);
  });
});

// --- Bust -----------------------------------------------------------------

describe("bust", () => {
  it("player bust settles as lose", () => {
    // Force a 20 player hand, deck tops with a 10 → bust to 30
    const forced: EngineState = {
      ...stateInPlayer(),
      player_hand: [c("♠", "K"), c("♥", "Q")],
      deck: Array(20).fill(c("♠", "10")),
    };
    const r = hit(forced);
    expect(r.phase).toBe("result");
    expect(r.outcome).toBe("lose");
  });
});

// --- Reshuffle ------------------------------------------------------------

describe("deck reshuffle", () => {
  it("reshuffles when below threshold on newHand", () => {
    const low: EngineState = { ...stateInResult(), deck: [c("♠", "5"), c("♥", "5")] };
    const r = newHand(low);
    expect(r.deck.length).toBe(52);
  });

  it("keeps deck when above threshold on newHand", () => {
    const high: EngineState = { ...stateInResult(), deck: Array(30).fill(c("♠", "5")) };
    const r = newHand(high);
    expect(r.deck.length).toBe(30);
  });
});

// --- View state projection -----------------------------------------------

describe("toViewState", () => {
  it("conceals dealer hole card during player phase", () => {
    const view = toViewState(stateInPlayer());
    expect(view.dealer_hand.cards[0]).toEqual({ rank: "?", suit: "?", face_down: true });
    expect(view.dealer_hand.value).toBe(0);
    expect(view.player_hand.value).toBe(15);
  });

  it("reveals dealer hand during result phase", () => {
    const view = toViewState(stateInResult());
    expect(view.dealer_hand.cards[0].face_down).toBe(false);
    expect(view.dealer_hand.value).toBeGreaterThan(0);
  });

  it("sets game_over when chips=0 and phase=result", () => {
    const broke: EngineState = { ...stateInResult(0, 100), chips: 0 };
    expect(toViewState(broke).game_over).toBe(true);
  });

  it("game_over false when chips>0", () => {
    expect(toViewState(stateInResult()).game_over).toBe(false);
  });

  it("double_down_available only in player phase with 2 cards and enough chips", () => {
    expect(toViewState(stateInPlayer(500, 100)).double_down_available).toBe(true);
    const broke: EngineState = { ...stateInPlayer(50, 100) };
    expect(toViewState(broke).double_down_available).toBe(false);
    const three: EngineState = {
      ...stateInPlayer(500, 100),
      player_hand: [c("♠", "5"), c("♥", "5"), c("♦", "5")],
    };
    expect(toViewState(three).double_down_available).toBe(false);
  });
});
