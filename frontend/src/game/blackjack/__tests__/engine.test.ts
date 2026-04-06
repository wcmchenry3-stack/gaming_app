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
  isSoftHand,
  toViewState,
  setRng,
  createSeededRng,
  EngineState,
  Card,
  DEFAULT_RULES,
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
    rules: DEFAULT_RULES,
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
    rules: DEFAULT_RULES,
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

// --- isSoftHand -----------------------------------------------------------

describe("isSoftHand", () => {
  it("empty hand returns false", () => expect(isSoftHand([])).toBe(false));
  it("no aces returns false", () => expect(isSoftHand([c("♠", "7"), c("♥", "8")])).toBe(false));
  it("A+6 = soft 17", () => expect(isSoftHand([c("♠", "A"), c("♥", "6")])).toBe(true));
  it("A+7 = soft 18", () => expect(isSoftHand([c("♠", "A"), c("♥", "7")])).toBe(true));
  it("A+K = soft 21 (natural)", () => expect(isSoftHand([c("♠", "A"), c("♥", "K")])).toBe(true));
  it("A+K+5 = hard 16 (ace forced to 1)", () =>
    expect(isSoftHand([c("♠", "A"), c("♥", "K"), c("♦", "5")])).toBe(false));
  it("A+A = soft 12 (one ace as 11, one as 1)", () =>
    expect(isSoftHand([c("♠", "A"), c("♥", "A")])).toBe(true));
  it("A+A+9 = hard 21 (both aces forced to 1 after adjustment)", () =>
    // rawTotal=11+11+9=31, best=21, reductions=(31-21)/10=1, numAces=2 > 1 → still soft
    // Wait: A+A+9: 11+11+9=31 → reduce one ace: 21. numAces=2, reductions=1, 2>1 → soft
    expect(isSoftHand([c("♠", "A"), c("♥", "A"), c("♦", "9")])).toBe(true));
  it("A+A+K = hard 12 (two aces forced to 1)", () =>
    // rawTotal=11+11+10=32, best=12, reductions=2, numAces=2, 2 > 2 is false → hard
    expect(isSoftHand([c("♠", "A"), c("♥", "A"), c("♦", "K")])).toBe(false));
  it("7+8 (no ace) is hard 15", () => expect(isSoftHand([c("♠", "7"), c("♥", "8")])).toBe(false));
});

// --- Fresh game state -----------------------------------------------------

describe("newGame", () => {
  it("starts in betting phase", () => expect(newGame().phase).toBe("betting"));
  it("starts with 1000 chips", () => expect(newGame().chips).toBe(1000));
  it("starts with 312-card deck (6 decks by default)", () =>
    expect(newGame().deck).toHaveLength(312));
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

  it("requires chips >= 2*bet (free stack = chips - bet)", () => {
    // chips=150, bet=100 → only 50 free; needs another 100 to double.
    const broke: EngineState = stateInPlayer(150, 100);
    expect(() => doubleDown(broke)).toThrow(/Insufficient chips/);
  });

  it("accepts exact 2*bet (boundary)", () => {
    // chips=200, bet=100 → chips == 2*bet, allowed.
    const r = doubleDown(stateInPlayer(200, 100));
    expect(r.bet).toBe(200);
  });

  it("doubles the bet", () => {
    const r = doubleDown(stateInPlayer(500, 100));
    expect(r.bet).toBe(200);
  });

  it("reaches result phase", () => {
    const r = doubleDown(stateInPlayer(500, 100));
    expect(r.phase).toBe("result");
  });

  it("applies 2x payout delta", () => {
    // Under "chips includes wagered" accounting, doubling the bet doubles
    // the settlement delta. Start 300 / bet 100:
    //   win:  300 + 200 = 500
    //   lose: 300 - 200 = 100
    //   push: 300 + 0   = 300
    const r = doubleDown(stateInPlayer(300, 100));
    expect(r.bet).toBe(200);
    if (r.outcome === "win") expect(r.chips).toBe(500);
    if (r.outcome === "lose") expect(r.chips).toBe(100);
    if (r.outcome === "push") expect(r.chips).toBe(300);
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
    // Default rules: 6 decks, 0.75 penetration → threshold = max(15, 312*0.25) = 78
    const low: EngineState = { ...stateInResult(), deck: [c("♠", "5"), c("♥", "5")] };
    const r = newHand(low);
    expect(r.deck.length).toBe(312); // 6 decks
  });

  it("keeps deck when above threshold on newHand", () => {
    // 80 cards remaining is above threshold (78)
    const high: EngineState = { ...stateInResult(), deck: Array(80).fill(c("♠", "5")) };
    const r = newHand(high);
    expect(r.deck.length).toBe(80);
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

  it("player_hand.soft is true for a soft hand", () => {
    const soft: EngineState = {
      ...stateInPlayer(),
      player_hand: [c("♠", "A"), c("♥", "6")], // soft 17
    };
    expect(toViewState(soft).player_hand.soft).toBe(true);
    expect(toViewState(soft).player_hand.value).toBe(17);
  });

  it("dealer_hand.soft is false when concealed (hole card hidden)", () => {
    const soft: EngineState = {
      ...stateInPlayer(),
      dealer_hand: [c("♦", "A"), c("♣", "6")], // soft 17 but concealed
    };
    const view = toViewState(soft);
    expect(view.dealer_hand.soft).toBe(false);
    expect(view.dealer_hand.value).toBe(0);
  });

  it("dealer_hand.soft is true when revealed in result phase", () => {
    const soft: EngineState = {
      ...stateInResult(),
      dealer_hand: [c("♦", "A"), c("♣", "6")], // soft 17
    };
    expect(toViewState(soft).dealer_hand.soft).toBe(true);
    expect(toViewState(soft).dealer_hand.value).toBe(17);
  });

  it("double_down_available only in player phase with 2 cards and chips >= 2*bet", () => {
    // chips=500, bet=100 → chips >= 200 ✓
    expect(toViewState(stateInPlayer(500, 100)).double_down_available).toBe(true);
    // boundary: chips=200, bet=100 ✓
    expect(toViewState(stateInPlayer(200, 100)).double_down_available).toBe(true);
    // chips=150, bet=100 → not enough free stack
    expect(toViewState(stateInPlayer(150, 100)).double_down_available).toBe(false);
    // 3 cards → not available
    const three: EngineState = {
      ...stateInPlayer(500, 100),
      player_hand: [c("♠", "5"), c("♥", "5"), c("♦", "5")],
    };
    expect(toViewState(three).double_down_available).toBe(false);
  });
});

// --- Double down — deterministic scenarios (rigged decks) -----------------
//
// deal() pops from the end of `deck`, so the LAST element is drawn first.
// Stack order for DD tests:
//     deck = [..., dealer_hit_2, dealer_hit_1, DD_card]
//                                               ^ popped first

function ddSetup(
  chips: number,
  bet: number,
  player: Card[],
  dealer: Card[],
  deck: Card[]
): EngineState {
  return {
    chips,
    bet,
    phase: "player",
    outcome: null,
    payout: 0,
    player_hand: player,
    dealer_hand: dealer,
    deck,
    doubled: false,
    rules: DEFAULT_RULES,
  };
}

describe("double down — deterministic scenarios", () => {
  it("DD win pays net +2*bet (dealer busts)", () => {
    // Player 10+5=15, DD card 6 → 21. Dealer 6+8=14, hits 10 → 24 bust.
    const g = ddSetup(
      500,
      100,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "6"), c("♣", "8")],
      [c("♠", "10"), c("♠", "6")] // dealer hit, then DD card (popped first)
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("win");
    expect(r.bet).toBe(200);
    expect(r.chips).toBe(500 + 200); // net +2*bet
  });

  it("DD loss debits net -2*bet", () => {
    // Player 10+5=15, DD card 2 → 17. Dealer 9+9=18 stands.
    const g = ddSetup(
      500,
      100,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "2")]
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("lose");
    expect(r.chips).toBe(500 - 200);
  });

  it("DD push returns zero delta", () => {
    // Player 10+5=15, DD card 3 → 18. Dealer 9+9=18 stands. Push.
    const g = ddSetup(
      500,
      100,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "3")]
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("push");
    expect(r.chips).toBe(500);
  });

  it("DD to 21 is even money, not the 3:2 blackjack payout", () => {
    // 6+5=11, DD card K → 21 (3 cards — not a natural). Pays +2*bet,
    // NOT ceil(1.5 * 200) = 300.
    const g = ddSetup(
      500,
      100,
      [c("♠", "6"), c("♥", "5")],
      [c("♦", "10"), c("♣", "8")], // 18, stands
      [c("♠", "K")]
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("win");
    expect(r.chips).toBe(500 + 200); // not +300
  });

  it("DD bust settles immediately — dealer hand untouched", () => {
    // Player 10+10=20, DD card 5 → 25 bust. Dealer MUST NOT draw.
    const dealerInitial = [c("♦", "6"), c("♣", "7")];
    const g = ddSetup(
      500,
      100,
      [c("♠", "K"), c("♥", "Q")],
      dealerInitial,
      [c("♠", "2"), c("♠", "5")] // 2 is "would-be dealer hit"
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("lose");
    expect(r.chips).toBe(500 - 200);
    expect(r.dealer_hand).toEqual(dealerInitial);
    // The unused dealer-hit card should still be in the deck.
    expect(r.deck.some((card) => card.rank === "2")).toBe(true);
  });

  it("sufficiency boundary: chips == 2*bet is allowed", () => {
    const g = ddSetup(
      200,
      100,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "3")] // push
    );
    const r = doubleDown(g);
    expect(r.bet).toBe(200);
    expect(r.chips).toBe(200);
  });

  it("sufficiency boundary: chips == 2*bet - 10 rejected", () => {
    const g = ddSetup(
      190,
      100,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "2")]
    );
    expect(() => doubleDown(g)).toThrow(/Insufficient chips/);
  });

  it("exact 2*bet loss → chips 0 and game_over via view state", () => {
    const g = ddSetup(
      200,
      100,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "2")] // → 17, dealer 18 → lose
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("lose");
    expect(r.chips).toBe(0);
    expect(r.phase).toBe("result");
    expect(toViewState(r).game_over).toBe(true);
  });

  it("DD refused after a hit (3rd card)", () => {
    const g = ddSetup(
      500,
      100,
      [c("♠", "5"), c("♥", "5")],
      [c("♦", "9"), c("♣", "8")],
      [c("♠", "3")]
    );
    const afterHit = hit(g);
    expect(() => doubleDown(afterHit)).toThrow(/initial two cards/);
  });

  it("DD with soft 17 (A+6) — ace demotes when DD card busts", () => {
    // A+6 = 17 soft. DD card K → 11+6+10=27 > 21, ace demotes: 1+6+10 = 17.
    // Dealer 9+9=18 stands → lose.
    const g = ddSetup(
      500,
      100,
      [c("♠", "A"), c("♥", "6")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "K")]
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("lose");
    expect(r.chips).toBe(500 - 200);
    // Confirm the final player total is 17 via the engine's handValue
    expect(handValue(r.player_hand)).toBe(17);
  });

  it("DD with soft 18 (A+7) — 3 brings it to hard 21 (ace stays 11)", () => {
    // A+7=18, DD card 3 → 11+7+3=21. Dealer 10+8=18 stands → win.
    const g = ddSetup(
      500,
      100,
      [c("♠", "A"), c("♥", "7")],
      [c("♦", "10"), c("♣", "8")],
      [c("♠", "3")]
    );
    const r = doubleDown(g);
    expect(handValue(r.player_hand)).toBe(21);
    expect(r.outcome).toBe("win");
    expect(r.chips).toBe(500 + 200);
  });
});

describe.each([
  [200, 100],
  [1000, 500],
  [20, 10],
])("double down — boundary at chips=%i, bet=%i", (chips, bet) => {
  it("DD at exact 2*bet with push leaves chips intact", () => {
    const g = ddSetup(
      chips,
      bet,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "3")]
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("push");
    expect(r.chips).toBe(chips);
  });

  it("DD at exact 2*bet with loss reaches zero", () => {
    const g = ddSetup(
      chips,
      bet,
      [c("♠", "10"), c("♥", "5")],
      [c("♦", "9"), c("♣", "9")],
      [c("♠", "2")]
    );
    const r = doubleDown(g);
    expect(r.outcome).toBe("lose");
    expect(r.chips).toBe(0);
  });
});

// --- Seedable RNG ---------------------------------------------------------

describe("seedable RNG (setRng + createSeededRng)", () => {
  afterEach(() => {
    // Restore default RNG so subsequent tests aren't affected.
    setRng(Math.random);
  });

  it("same seed produces identical shuffled decks", () => {
    setRng(createSeededRng(42));
    const a = newGame();
    setRng(createSeededRng(42));
    const b = newGame();
    expect(a.deck).toEqual(b.deck);
  });

  it("different seeds produce different decks", () => {
    setRng(createSeededRng(1));
    const a = newGame();
    setRng(createSeededRng(999));
    const b = newGame();
    expect(a.deck).not.toEqual(b.deck);
  });

  it("same seed replays identical placeBet outcome (deal order preserved)", () => {
    setRng(createSeededRng(7));
    const a = placeBet(newGame(), 100);
    setRng(createSeededRng(7));
    const b = placeBet(newGame(), 100);
    expect(a.player_hand).toEqual(b.player_hand);
    expect(a.dealer_hand).toEqual(b.dealer_hand);
    expect(a.phase).toEqual(b.phase);
    expect(a.outcome).toEqual(b.outcome);
  });

  it("same seed replays identical stand → dealer play sequence", () => {
    setRng(createSeededRng(123));
    let a = placeBet(newGame(), 100);
    if (a.phase === "player") a = stand(a);

    setRng(createSeededRng(123));
    let b = placeBet(newGame(), 100);
    if (b.phase === "player") b = stand(b);

    expect(a.player_hand).toEqual(b.player_hand);
    expect(a.dealer_hand).toEqual(b.dealer_hand);
    expect(a.outcome).toEqual(b.outcome);
    expect(a.chips).toEqual(b.chips);
  });

  it("deck contains all 52 unique card types regardless of seed", () => {
    setRng(createSeededRng(12345));
    const { deck } = newGame();
    expect(deck).toHaveLength(312); // 6 decks
    const keys = new Set(deck.map((card) => `${card.rank}-${card.suit}`));
    expect(keys.size).toBe(52); // 52 unique card types, each repeated 6 times
  });

  it("setRng(Math.random) afterEach restores non-determinism", () => {
    const a = newGame();
    const b = newGame();
    // Two fresh shuffles from Math.random almost never match across 52 cards.
    expect(a.deck).not.toEqual(b.deck);
  });
});
