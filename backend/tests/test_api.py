import uuid

import pytest
from fastapi.testclient import TestClient
import main as main_module
from main import app

client = TestClient(app)

# Fixed session ID used by all test helpers in this module
TEST_SESSION_ID = str(uuid.uuid4())
SESSION_HEADERS = {"X-Session-ID": TEST_SESSION_ID}


@pytest.fixture(autouse=True)
def reset_game():
    """Reset session state before each test."""
    main_module._sessions.clear()
    yield
    main_module._sessions.clear()


def _new_game() -> dict:
    res = client.post("/game/new", headers=SESSION_HEADERS)
    assert res.status_code == 200
    return res.json()


def _roll(held: list[bool] = None) -> dict:
    if held is None:
        held = [False] * 5
    res = client.post("/game/roll", json={"held": held}, headers=SESSION_HEADERS)
    return res


def _score(category: str) -> dict:
    return client.post("/game/score", json={"category": category}, headers=SESSION_HEADERS)


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

    def test_400_missing_session_id(self):
        res = client.post("/game/new")
        assert res.status_code == 400

    def test_400_invalid_session_id(self):
        res = client.post("/game/new", headers={"X-Session-ID": "not-a-uuid"})
        assert res.status_code == 400


# ---------------------------------------------------------------------------
# GET /game/state
# ---------------------------------------------------------------------------


class TestGetState:
    def test_404_without_game(self):
        res = client.get("/game/state", headers=SESSION_HEADERS)
        assert res.status_code == 404

    def test_returns_current_state(self):
        _new_game()
        res = client.get("/game/state", headers=SESSION_HEADERS)
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
        res = client.post(
            "/game/roll", json={"held": [False, False]}, headers=SESSION_HEADERS
        )
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
        _roll()
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
        _roll()
        res = _score("chance")
        assert res.status_code == 400
        assert "already scored" in res.json()["detail"]

    def test_400_unknown_category(self):
        _new_game()
        _roll()
        res = _score("bogus_category")
        assert res.status_code == 400
        assert "Unknown scoring category" in res.json()["detail"]

    def test_unknown_category_does_not_echo_input(self):
        _new_game()
        _roll()
        res = _score("bogus_category")
        assert "bogus_category" not in res.json()["detail"]

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
        state = client.get("/game/state", headers=SESSION_HEADERS).json()
        assert state["game_over"] is True


# ---------------------------------------------------------------------------
# GET /game/possible-scores
# ---------------------------------------------------------------------------


class TestPossibleScores:
    def test_404_without_game(self):
        res = client.get("/game/possible-scores", headers=SESSION_HEADERS)
        assert res.status_code == 404

    def test_empty_before_rolling(self):
        _new_game()
        res = client.get("/game/possible-scores", headers=SESSION_HEADERS)
        assert res.status_code == 200
        assert res.json()["possible_scores"] == {}

    def test_returns_scores_after_roll(self):
        _new_game()
        _roll()
        res = client.get("/game/possible-scores", headers=SESSION_HEADERS)
        assert res.status_code == 200
        ps = res.json()["possible_scores"]
        assert len(ps) == 13

    def test_excludes_already_scored(self):
        _new_game()
        _roll()
        _score("chance")
        _roll()
        ps = client.get(
            "/game/possible-scores", headers=SESSION_HEADERS
        ).json()["possible_scores"]
        assert "chance" not in ps
        assert len(ps) == 12


# ---------------------------------------------------------------------------
# Session isolation
# ---------------------------------------------------------------------------


class TestSessionIsolation:
    def test_two_sessions_are_independent(self):
        sid1 = str(uuid.uuid4())
        sid2 = str(uuid.uuid4())
        client.post("/game/new", headers={"X-Session-ID": sid1})
        client.post("/game/new", headers={"X-Session-ID": sid2})
        client.post(
            "/game/roll",
            json={"held": [False] * 5},
            headers={"X-Session-ID": sid1},
        )
        state2 = client.get("/game/state", headers={"X-Session-ID": sid2}).json()
        assert state2["rolls_used"] == 0

    def test_session_lru_eviction(self):
        import main as m
        import unittest.mock as mock

        # Patch _MAX_SESSIONS to 3 so we can trigger eviction without rate limit
        with mock.patch.object(m, "_MAX_SESSIONS", 3):
            for _ in range(4):
                client.post("/game/new", headers={"X-Session-ID": str(uuid.uuid4())})
        assert len(m._sessions) <= 3

    def test_evicted_session_returns_404(self):
        import main as m
        import unittest.mock as mock

        first_sid = str(uuid.uuid4())
        client.post("/game/new", headers={"X-Session-ID": first_sid})
        with mock.patch.object(m, "_MAX_SESSIONS", 3):
            for _ in range(3):
                client.post("/game/new", headers={"X-Session-ID": str(uuid.uuid4())})
        res = client.get("/game/state", headers={"X-Session-ID": first_sid})
        assert res.status_code == 404
