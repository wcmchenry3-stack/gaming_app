"""
Simulation tests — full 13-round Yacht lifecycle.

These tests drive the game through complete playthroughs (all 13 rounds) to
catch state-machine bugs that unit tests miss by only exercising one step at
a time.  Two layers are covered:

  1. Direct YachtGame — fast, no HTTP overhead, seeded for determinism.
  2. FastAPI TestClient — verifies the HTTP layer doesn't corrupt state across
     all 13 round transitions.
"""

import random
import unittest.mock
import uuid

import pytest
from fastapi.testclient import TestClient

from yacht.game import CATEGORIES, UPPER_CATEGORIES, YachtGame
from yacht.router import reset_game as _yacht_reset
from main import app

# ---------------------------------------------------------------------------
# Module-level test client (shared across class fixtures)
# ---------------------------------------------------------------------------

client = TestClient(app)

TEST_SESSION_ID = str(uuid.uuid4())
SESSION_HEADERS = {"X-Session-ID": TEST_SESSION_ID}


@pytest.fixture(autouse=True)
def reset_game():
    """Reset session state before and after each test."""
    _yacht_reset()
    yield
    _yacht_reset()


# ---------------------------------------------------------------------------
# Helper: play a full game programmatically
# ---------------------------------------------------------------------------


def play_full_game(seed: int | None = None) -> YachtGame:
    """Drive a complete 13-round game using the greedy best-score strategy.

    Patches ``random.randint`` with a seeded RNG so results are reproducible.
    On every turn the category with the highest current possible score is
    chosen — ties broken by iteration order of CATEGORIES.
    """
    rng = random.Random(seed)
    g = YachtGame()
    with unittest.mock.patch("random.randint", side_effect=lambda a, b: rng.randint(a, b)):
        for _ in range(13):
            g.roll([False] * 5)
            ps = g.possible_scores()
            best = max(ps, key=lambda c: ps[c])
            g.score(best)
    return g


# ---------------------------------------------------------------------------
# Direct simulation tests
# ---------------------------------------------------------------------------


class TestDirectSimulation:
    def test_game_completes_to_round_14(self):
        g = play_full_game(seed=42)
        assert g.round == 14

    def test_game_over_flag_set(self):
        g = play_full_game(seed=42)
        assert g.game_over is True

    def test_all_categories_filled(self):
        g = play_full_game(seed=42)
        assert all(v is not None for v in g.scores.values())

    def test_total_score_non_negative(self):
        g = play_full_game(seed=42)
        assert g.total_score() >= 0

    def test_total_score_within_theoretical_bounds(self):
        # Theoretical max without yacht bonuses:
        # Upper: 5+10+15+20+25+30 = 105 + 35 bonus = 140
        # Lower: 30 + 40 + 25 + 30 + 40 + 50 + 30 = 245
        # Hard ceiling with a generous margin: 1575
        g = play_full_game(seed=42)
        assert g.total_score() <= 1575

    def test_upper_bonus_only_when_threshold_met(self):
        g = play_full_game(seed=42)
        upper_sum = g.upper_subtotal()
        if upper_sum >= 63:
            assert g.upper_bonus() == 35
        else:
            assert g.upper_bonus() == 0

    def test_upper_subtotal_matches_scores(self):
        g = play_full_game(seed=42)
        expected = sum(v for k, v in g.scores.items() if k in UPPER_CATEGORIES and v is not None)
        assert g.upper_subtotal() == expected

    def test_total_score_equals_filled_plus_bonus(self):
        g = play_full_game(seed=42)
        filled = sum(v for v in g.scores.values() if v is not None)
        assert g.total_score() == filled + g.upper_bonus() + g.yacht_bonus_total()

    # ------------------------------------------------------------------
    # Determinism
    # ------------------------------------------------------------------

    def test_deterministic_same_seed(self):
        g1 = play_full_game(seed=7)
        g2 = play_full_game(seed=7)
        assert g1.scores == g2.scores
        assert g1.total_score() == g2.total_score()

    def test_different_seeds_produce_variation(self):
        scores = [play_full_game(seed=s).total_score() for s in range(20)]
        # With 20 seeds it would be astronomically unlikely to get identical totals
        assert len(set(scores)) > 1

    # ------------------------------------------------------------------
    # Multiple full games — state isolation
    # ------------------------------------------------------------------

    def test_multiple_games_independent(self):
        """Each YachtGame instance is independent; playing one does not affect another."""
        g1 = play_full_game(seed=1)
        g2 = play_full_game(seed=2)
        # Both finished; they're separate objects
        assert g1.game_over is True
        assert g2.game_over is True
        # Different seeds should produce at least one different score value
        assert g1.scores != g2.scores or g1.total_score() != g2.total_score()

    def test_game_rejects_actions_after_completion(self):
        g = play_full_game(seed=99)
        assert g.game_over is True
        with pytest.raises(ValueError, match="Game is over"):
            g.roll([False] * 5)
        with pytest.raises(ValueError, match="Game is over"):
            g.dice = [1, 1, 1, 1, 1]
            g.rolls_used = 1
            g.score("chance")  # already scored AND game is over


# ---------------------------------------------------------------------------
# API integration simulation tests
# ---------------------------------------------------------------------------


class TestAPISimulation:
    """Drive a full 13-round game through the HTTP API.

    Each helper resets the rate-limiter before calling the endpoint.
    This is intentional: simulation tests exercise game-state transitions,
    not rate limiting (which is covered separately in test_security.py).
    Without the resets, accumulated decorator registrations from
    test_security.py's importlib.reload calls would halve the effective
    limit and cause spurious 429s within multi-round tests.
    """

    @staticmethod
    def _rl_reset():
        from limiter import limiter

        limiter.reset()

    def _new(self) -> dict:
        self._rl_reset()
        res = client.post("/yacht/new", headers=SESSION_HEADERS)
        assert res.status_code == 200
        return res.json()

    def _roll(self, held: list[bool] | None = None) -> dict:
        self._rl_reset()
        res = client.post(
            "/yacht/roll",
            json={"held": held or [False] * 5},
            headers=SESSION_HEADERS,
        )
        assert res.status_code == 200
        return res.json()

    def _score(self, category: str) -> dict:
        self._rl_reset()
        res = client.post(
            "/yacht/score",
            json={"category": category},
            headers=SESSION_HEADERS,
        )
        assert res.status_code == 200
        return res.json()

    def _state(self) -> dict:
        self._rl_reset()
        res = client.get("/yacht/state", headers=SESSION_HEADERS)
        assert res.status_code == 200
        return res.json()

    def _possible(self) -> dict:
        self._rl_reset()
        res = client.get("/yacht/possible-scores", headers=SESSION_HEADERS)
        assert res.status_code == 200
        return res.json()["possible_scores"]

    def test_13_round_game_ends_with_game_over(self):
        self._new()
        for cat in CATEGORIES:
            self._roll()
            self._score(cat)
        state = self._state()
        assert state["game_over"] is True
        assert state["round"] == 14

    def test_all_categories_scored_after_full_game(self):
        self._new()
        for cat in CATEGORIES:
            self._roll()
            self._score(cat)
        state = self._state()
        assert all(v is not None for v in state["scores"].values())

    def test_possible_scores_decrements_each_round(self):
        self._new()
        for i, cat in enumerate(CATEGORIES):
            self._roll()
            ps = self._possible()
            assert (
                len(ps) == 13 - i
            ), f"Round {i + 1}: expected {13 - i} possible scores, got {len(ps)}"
            self._score(cat)

    def test_round_increments_each_turn(self):
        self._new()
        for expected_round, cat in enumerate(CATEGORIES, start=1):
            state = self._state()
            assert state["round"] == expected_round
            self._roll()
            self._score(cat)

    def test_rolls_used_resets_after_each_score(self):
        self._new()
        for cat in CATEGORIES:
            roll_state = self._roll()
            assert roll_state["rolls_used"] == 1
            score_state = self._score(cat)
            assert score_state["rolls_used"] == 0

    def test_dice_zeroed_after_each_score(self):
        self._new()
        for cat in CATEGORIES:
            self._roll()
            score_state = self._score(cat)
            assert score_state["dice"] == [0, 0, 0, 0, 0]

    def test_total_score_non_decreasing_across_rounds(self):
        """total_score in responses must never go down as categories are filled."""
        self._new()
        prev_total = 0
        for cat in CATEGORIES:
            self._roll()
            state = self._score(cat)
            total = sum(v for v in state["scores"].values() if v is not None)
            assert total >= prev_total
            prev_total = total

    def test_400_on_roll_after_game_over(self):
        """After all 13 rounds the API must reject further rolls."""
        self._new()
        for cat in CATEGORIES:
            self._roll()
            self._score(cat)
        res = client.post(
            "/yacht/roll",
            json={"held": [False] * 5},
            headers=SESSION_HEADERS,
        )
        assert res.status_code == 400

    def test_400_on_score_after_game_over(self):
        """After all 13 rounds the API must reject further scoring."""
        self._new()
        for cat in CATEGORIES:
            self._roll()
            self._score(cat)
        # Need a roll_used > 0 to reach the game_over check (not the must-roll check)
        # Manually set rolls_used won't work via API — the endpoint raises game_over first
        res = client.post(
            "/yacht/score",
            json={"category": "chance"},
            headers=SESSION_HEADERS,
        )
        assert res.status_code == 400
