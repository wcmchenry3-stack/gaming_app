/**
 * Frontend ↔ backend parity test harness for Blackjack (issue #172).
 *
 * Loads the same fixture file consumed by the Python suite
 * (backend/tests/fixtures/blackjack_parity.json) and runs every scenario
 * through the TypeScript engine.  A divergence between the two
 * implementations will surface as a failure here or in pytest.
 *
 * Deck layout note
 * ----------------
 * Each fixture supplies a `deck` array ordered so that `Array.prototype.pop()`
 * yields cards in deal order: player[0], dealer[0], player[1], dealer[1],
 * then any hit/double cards.  The *last* element is dealt first.
 */

import { Card, EngineState, doubleDown, hit, newGame, placeBet, stand } from "../engine";
// resolveJsonModule is enabled via expo/tsconfig.base.
// Path: 5 levels up from __tests__/ to repo root, then into backend/tests/fixtures/.
import fixtureData from "../../../../../backend/tests/fixtures/blackjack_parity.json";

interface ParityFixture {
  id: string;
  description: string;
  deck: Card[];
  actions: string[];
  expected: {
    phase: string;
    outcome: string | null;
    chips: number;
    payout: number;
    bet: number;
  };
}

function runAction(state: EngineState, action: string): EngineState {
  if (action.startsWith("bet:")) {
    return placeBet(state, parseInt(action.split(":")[1], 10));
  }
  if (action === "hit") return hit(state);
  if (action === "stand") return stand(state);
  if (action === "double_down") return doubleDown(state);
  throw new Error(`Unknown action: ${action}`);
}

const fixtures = fixtureData as ParityFixture[];

test.each(fixtures.map((f) => [f.id, f] as [string, ParityFixture]))(
  "parity: %s",
  (_id, fixture) => {
    let state = newGame(fixture.deck);

    for (const action of fixture.actions) {
      state = runAction(state, action);
    }

    const exp = fixture.expected;
    expect(state.phase).toBe(exp.phase);
    expect(state.outcome).toBe(exp.outcome);
    expect(state.chips).toBe(exp.chips);
    expect(state.payout).toBe(exp.payout);
    expect(state.bet).toBe(exp.bet);
  }
);
