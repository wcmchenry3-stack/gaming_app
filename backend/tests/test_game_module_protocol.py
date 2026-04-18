"""Tests for the GameModule Protocol and per-game stats_shape() (#540, #541)."""

from __future__ import annotations

import pytest

from blackjack.module import module as blackjack_module
from cascade.module import module as cascade_module
from games.protocol import GameModule
from games.registry import get_module
from vocab import GameType

# ---------------------------------------------------------------------------
# Protocol conformance
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "mod",
    [blackjack_module, cascade_module],
    ids=["blackjack", "cascade"],
)
def test_module_satisfies_protocol(mod) -> None:
    assert isinstance(mod, GameModule), f"{mod!r} does not satisfy the GameModule Protocol"


def test_blackjack_module_game_type() -> None:
    assert blackjack_module.game_type == GameType.BLACKJACK


def test_cascade_module_game_type() -> None:
    assert cascade_module.game_type == GameType.CASCADE


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def test_registry_returns_correct_modules() -> None:
    assert get_module("blackjack") is blackjack_module
    assert get_module("cascade") is cascade_module


def test_registry_returns_none_for_unknown() -> None:
    assert get_module("unknown_game") is None


# ---------------------------------------------------------------------------
# BlackjackModule.stats_shape — key renames and chip logic
# ---------------------------------------------------------------------------

_RAW_BJ = {
    "played": 5,
    "best": 2400,
    "avg": 1800.0,
    "last_played_at": None,
    "latest_score": 2100,
}


def test_blackjack_stats_shape_renames_best_to_best_chips() -> None:
    shaped = blackjack_module.stats_shape(_RAW_BJ)
    assert shaped["best_chips"] == 2400
    assert shaped.get("best") is None


def test_blackjack_stats_shape_drops_avg() -> None:
    shaped = blackjack_module.stats_shape(_RAW_BJ)
    assert shaped.get("avg") is None


def test_blackjack_stats_shape_maps_latest_score_to_current_chips() -> None:
    shaped = blackjack_module.stats_shape(_RAW_BJ)
    assert shaped["current_chips"] == 2100


def test_blackjack_stats_shape_preserves_played_and_last_played_at() -> None:
    shaped = blackjack_module.stats_shape(_RAW_BJ)
    assert shaped["played"] == 5
    assert shaped["last_played_at"] is None


def test_blackjack_stats_shape_none_latest_score() -> None:
    raw = {**_RAW_BJ, "latest_score": None}
    shaped = blackjack_module.stats_shape(raw)
    assert shaped["current_chips"] is None


# ---------------------------------------------------------------------------
# CascadeModule.stats_shape — pass-through, strips latest_score
# ---------------------------------------------------------------------------

_RAW_CASCADE = {
    "played": 3,
    "best": 9500,
    "avg": 7000.0,
    "last_played_at": None,
    "latest_score": 8000,
}


def test_cascade_stats_shape_preserves_aggregate_fields() -> None:
    shaped = cascade_module.stats_shape(_RAW_CASCADE)
    assert shaped["played"] == 3
    assert shaped["best"] == 9500
    assert shaped["avg"] == 7000.0


def test_cascade_stats_shape_strips_latest_score() -> None:
    shaped = cascade_module.stats_shape(_RAW_CASCADE)
    assert "latest_score" not in shaped


