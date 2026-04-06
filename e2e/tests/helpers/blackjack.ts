/**
 * Shared helpers for Blackjack e2e tests.
 */

import { Page } from "@playwright/test";

export interface InjectedCard {
  suit: string;
  rank: string;
}

/** Full EngineState shape matching frontend/src/game/blackjack/engine.ts */
export interface InjectedEngineState {
  chips: number;
  bet: number;
  phase: "betting" | "player" | "result";
  outcome: "blackjack" | "win" | "lose" | "push" | null;
  payout: number;
  deck: InjectedCard[];
  player_hand: InjectedCard[];
  dealer_hand: InjectedCard[];
  doubled: boolean;
  // Split state
  player_hands: InjectedCard[][];
  hand_bets: number[];
  hand_outcomes: (string | null)[];
  hand_payouts: number[];
  active_hand_index: number;
  split_count: number;
  split_from_aces: boolean[];
}

/** Navigate from Home to Blackjack, clearing any saved state first. */
export async function gotoBlackjack(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("blackjack_game_v2"));
  await page.goto("/");
  await page.getByRole("button", { name: "Play Blackjack" }).click();
  // Use role selector to avoid strict-mode violations from "Dealer's Hand" / "dealer" substrings
  await page.getByRole("button", { name: /deal cards with/i }).waitFor();
}

/** Inject a pre-built EngineState into localStorage then reload home. */
export async function injectEngineState(
  page: Page,
  state: InjectedEngineState,
): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    (s) => localStorage.setItem("blackjack_game_v2", JSON.stringify(s)),
    state,
  );
  await page.goto("/");
}

/** Default split state fields — no active split. */
function emptySplitFields(): Pick<
  InjectedEngineState,
  | "player_hands"
  | "hand_bets"
  | "hand_outcomes"
  | "hand_payouts"
  | "active_hand_index"
  | "split_count"
  | "split_from_aces"
> {
  return {
    player_hands: [],
    hand_bets: [],
    hand_outcomes: [],
    hand_payouts: [],
    active_hand_index: 0,
    split_count: 0,
    split_from_aces: [],
  };
}

/**
 * Player-phase state: 8+7 = 15 vs dealer 6 — no immediate bust risk,
 * double-down available (chips >= 2 * bet).
 */
export function playerPhaseState(
  overrides: Partial<InjectedEngineState> = {},
): InjectedEngineState {
  return {
    chips: 1000,
    bet: 100,
    phase: "player",
    outcome: null,
    payout: 0,
    deck: [],
    player_hand: [
      { suit: "♠", rank: "8" },
      { suit: "♥", rank: "7" },
    ],
    dealer_hand: [
      { suit: "♦", rank: "6" },
      { suit: "♣", rank: "K" },
    ],
    doubled: false,
    ...emptySplitFields(),
    ...overrides,
  };
}

/** Result-phase state with a win outcome (+100 chips). */
export function resultPhaseState(
  overrides: Partial<InjectedEngineState> = {},
): InjectedEngineState {
  return {
    chips: 1100,
    bet: 100,
    phase: "result",
    outcome: "win",
    payout: 100,
    deck: [],
    player_hand: [
      { suit: "♠", rank: "K" },
      { suit: "♥", rank: "Q" },
    ],
    dealer_hand: [
      { suit: "♣", rank: "8" },
      { suit: "♦", rank: "9" },
    ],
    doubled: false,
    ...emptySplitFields(),
    ...overrides,
  };
}

/** Game-over state: chips exhausted, phase=result. */
export function gameOverState(): InjectedEngineState {
  return {
    chips: 0,
    bet: 100,
    phase: "result",
    outcome: "lose",
    payout: -100,
    deck: [],
    player_hand: [
      { suit: "♠", rank: "K" },
      { suit: "♥", rank: "8" },
      { suit: "♣", rank: "5" },
    ],
    dealer_hand: [
      { suit: "♦", rank: "A" },
      { suit: "♠", rank: "9" },
    ],
    doubled: false,
    ...emptySplitFields(),
  };
}
