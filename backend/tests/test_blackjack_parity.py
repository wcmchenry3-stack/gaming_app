"""
Backend ↔ frontend parity test harness for Blackjack (issue #172).

Loads backend/tests/fixtures/blackjack_parity.json and runs every scenario
through the Python engine.  The same JSON file is consumed by the Jest suite
(frontend/src/game/blackjack/__tests__/parity.test.ts), so a divergence
between the two implementations surfaces as a fixture failure in one suite.

Deck layout note
----------------
Each fixture supplies a ``deck`` array ordered so that ``list.pop()``
(equivalent to TypeScript's ``Array.prototype.pop()``) yields cards in deal
order: player[0], dealer[0], player[1], dealer[1], then any hit/double cards.
That is, the *last* element of the array is dealt first.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from blackjack.game import BlackjackGame, Card

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "blackjack_parity.json"


def _load_fixtures() -> list[dict]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _make_deck(raw: list[dict]) -> list[Card]:
    return [Card(suit=c["suit"], rank=c["rank"]) for c in raw]


def _run_action(game: BlackjackGame, action: str) -> None:
    if action.startswith("bet:"):
        game.place_bet(int(action.split(":")[1]))
    elif action == "hit":
        game.hit()
    elif action == "stand":
        game.stand()
    elif action == "double_down":
        game.double_down()
    elif action == "new_hand":
        game.new_hand()
    else:
        raise ValueError(f"Unknown action: {action!r}")


@pytest.mark.parametrize(
    "fixture",
    _load_fixtures(),
    ids=[f["id"] for f in _load_fixtures()],
)
def test_parity_scenario(fixture: dict) -> None:
    game = BlackjackGame(_deck=_make_deck(fixture["deck"]))

    for action in fixture["actions"]:
        _run_action(game, action)

    exp = fixture["expected"]
    assert game.phase == exp["phase"], f"[{fixture['id']}] phase mismatch"
    assert game.outcome == exp["outcome"], f"[{fixture['id']}] outcome mismatch"
    assert game.chips == exp["chips"], f"[{fixture['id']}] chips mismatch"
    assert game.payout == exp["payout"], f"[{fixture['id']}] payout mismatch"
    assert game.bet == exp["bet"], f"[{fixture['id']}] bet mismatch"
