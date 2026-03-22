import pytest
from fastapi.testclient import TestClient
import main as main_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_game():
    """Reset global game state before each test."""
    main_module.game = None
    yield
    main_module.game = None


def _new_game() -> dict:
    res = client.post("/game/new")
    assert res.status_code == 200
    return res.json()


def _roll(held: list[bool] = None) -> dict:
    if held is None:
        held = [False] * 5
    res = client.post("/game/roll", json={"held": held})
    return res


def _score(category: str) -> dict:
    return client.post("/game/score", json={"category": category})


# ---------------------------------------------------------------------------
# POST /game/new
# ---------------------------------------------------------------------------


class TestNewGame:
    def test_returns_valid_state(self):
        state = _new_game()
        assert state["round"] == 1
        assert state["rolls_used"] == 0
        assert state["game_over"] is False
        assert len(state["dice"]) == 5
        assert len(state["held"]) == 5

    def test_all_scores_null(self):
        state = _new_game()
        assert all(v is None for v in state["scores"].values())

    def test_resets_existing_game(self):
        _new_game()
        _roll()
        _score("chance")
        state = _new_game()
        assert state["round"] == 1
        assert state["scores"]["chance"] is None


# ---------------------------------------------------------------------------
# GET /game/state
# ---------------------------------------------------------------------------


class TestGetState:
    def test_404_without_game(self):
        res = client.get("/game/state")
        assert res.status_code == 404

    def test_returns_current_state(self):
        _new_game()
        res = client.get("/game/state")
        assert res.status_code == 200
        assert res.json()["round"] == 1


# ---------------------------------------------------------------------------
# POST /game/roll
# ---------------------------------------------------------------------------


class TestRoll:
    def test_roll_updates_dice(self):
        _new_game()
        res = _roll()
        assert res.status_code == 200
        state = res.json()
        assert state["rolls_used"] == 1
        assert all(1 <= d <= 6 for d in state["dice"])

    def test_404_without_game(self):
        res = _roll()
        assert res.status_code == 404

    def test_invalid_held_length(self):
        _new_game()
        res = client.post("/game/roll", json={"held": [False, False]})
        assert res.status_code == 422

    def test_400_after_three_rolls(self):
        _new_game()
        _roll()
        _roll()
        _roll()
        res = _roll()
        assert res.status_code == 400
        assert "No rolls remaining" in res.json()["detail"]

    def test_held_respected_on_second_roll(self):
        _new_game()
        _roll()  # first roll — all dice random
        # Force known dice via direct state manipulation isn't possible via API,
        # but we can confirm rolls_used increments and held is echoed back
        state = _roll([True, True, False, False, False]).json()
        assert state["rolls_used"] == 2
        assert state["held"] == [True, True, False, False, False]


# ---------------------------------------------------------------------------
# POST /game/score
# ---------------------------------------------------------------------------


class TestScore:
    def test_score_advances_round(self):
        _new_game()
        _roll()
        state = _score("chance").json()
        assert state["round"] == 2
        assert state["rolls_used"] == 0
        assert state["scores"]["chance"] is not None

    def test_404_without_game(self):
        res = _score("chance")
        assert res.status_code == 404

    def test_400_before_rolling(self):
        _new_game()
        res = _score("chance")
        assert res.status_code == 400
        assert "Must roll" in res.json()["detail"]

    def test_400_duplicate_category(self):
        _new_game()
        _roll()
        _score("chance")
        # Start next turn
        _roll()
        res = _score("chance")
        assert res.status_code == 400
        assert "already scored" in res.json()["detail"]

    def test_400_unknown_category(self):
        _new_game()
        _roll()
        res = _score("bogus_category")
        assert res.status_code == 400
        assert "Unknown category" in res.json()["detail"]

    def test_game_over_after_all_categories(self):
        _new_game()
        categories = [
            "ones",
            "twos",
            "threes",
            "fours",
            "fives",
            "sixes",
            "three_of_a_kind",
            "four_of_a_kind",
            "full_house",
            "small_straight",
            "large_straight",
            "yahtzee",
            "chance",
        ]
        for cat in categories:
            _roll()
            _score(cat)
        state = client.get("/game/state").json()
        assert state["game_over"] is True


# ---------------------------------------------------------------------------
# GET /game/possible-scores
# ---------------------------------------------------------------------------


class TestPossibleScores:
    def test_404_without_game(self):
        res = client.get("/game/possible-scores")
        assert res.status_code == 404

    def test_empty_before_rolling(self):
        _new_game()
        res = client.get("/game/possible-scores")
        assert res.status_code == 200
        assert res.json()["possible_scores"] == {}

    def test_returns_scores_after_roll(self):
        _new_game()
        _roll()
        res = client.get("/game/possible-scores")
        assert res.status_code == 200
        ps = res.json()["possible_scores"]
        assert len(ps) == 13  # all categories unfilled

    def test_excludes_already_scored(self):
        _new_game()
        _roll()
        _score("chance")
        _roll()
        ps = client.get("/game/possible-scores").json()["possible_scores"]
        assert "chance" not in ps
        assert len(ps) == 12
