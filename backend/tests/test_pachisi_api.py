"""Integration tests for Pachisi FastAPI endpoints."""

import uuid

import pytest

pytestmark = pytest.mark.skip(reason="Pachisi router disabled — needs total rewrite")
from fastapi.testclient import TestClient
from unittest.mock import patch

from main import app
import pachisi.router as pachisi_router_module
from pachisi.game import PLAYER_ENTRY, new_game

client = TestClient(app)

# Fixed session ID used by all test helpers in this module
TEST_SESSION_ID = str(uuid.uuid4())
SESSION_HEADERS = {"X-Session-ID": TEST_SESSION_ID}


@pytest.fixture(autouse=True)
def reset():
    pachisi_router_module.reset_game()
    yield
    pachisi_router_module.reset_game()


def _new_game():
    resp = client.post("/pachisi/new", headers=SESSION_HEADERS)
    assert resp.status_code == 200
    return resp.json()


def _current_game():
    return pachisi_router_module._sessions.get(TEST_SESSION_ID)


def _inject(game):
    pachisi_router_module._sessions[TEST_SESSION_ID] = game


# ---------------------------------------------------------------------------
# POST /pachisi/new
# ---------------------------------------------------------------------------


class TestNewGame:
    def test_returns_200(self):
        resp = client.post("/pachisi/new", headers=SESSION_HEADERS)
        assert resp.status_code == 200

    def test_initial_state(self):
        data = _new_game()
        assert data["phase"] == "roll"
        assert data["current_player"] == "red"
        assert data["die_value"] is None
        assert data["valid_moves"] == []
        assert data["winner"] is None
        assert data["cpu_player"] == "yellow"

    def test_all_pieces_at_base(self):
        data = _new_game()
        for ps in data["player_states"]:
            assert ps["pieces_home"] == 4
            assert ps["pieces_finished"] == 0
            for piece in ps["pieces"]:
                assert piece["position"] == -1
                assert piece["is_home"] is True


# ---------------------------------------------------------------------------
# GET /pachisi/state
# ---------------------------------------------------------------------------


class TestGetState:
    def test_404_without_game(self):
        resp = client.get("/pachisi/state", headers=SESSION_HEADERS)
        assert resp.status_code == 404

    def test_200_with_game(self):
        _new_game()
        resp = client.get("/pachisi/state", headers=SESSION_HEADERS)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /pachisi/roll
# ---------------------------------------------------------------------------


class TestRoll:
    def test_404_without_game(self):
        resp = client.post("/pachisi/roll", headers=SESSION_HEADERS)
        assert resp.status_code == 404

    def test_400_when_not_roll_phase(self):
        g = new_game()
        g.phase = "move"
        g.die_value = 3
        g.valid_moves = [0]
        _inject(g)
        resp = client.post("/pachisi/roll", headers=SESSION_HEADERS)
        assert resp.status_code == 400

    def test_die_value_in_range(self):
        _new_game()
        g = _current_game()
        g.pieces["red"] = [5, -1, -1, -1]
        with patch("pachisi.game.random.randint", return_value=3):
            resp = client.post("/pachisi/roll", headers=SESSION_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["die_value"] == 3

    def test_no_valid_moves_auto_skips_and_cpu_moves(self):
        # Red all in base, non-6 → auto-skips to yellow, CPU runs, returns to red
        _new_game()
        g = _current_game()
        g.pieces["yellow"] = [5, -1, -1, -1]
        with patch("pachisi.game.random.randint", side_effect=[3, 2]):
            resp = client.post("/pachisi/roll", headers=SESSION_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_player"] == "red"

    def test_roll_six_gives_valid_moves(self):
        _new_game()
        with patch("pachisi.game.random.randint", return_value=6):
            resp = client.post("/pachisi/roll", headers=SESSION_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["die_value"] == 6
        assert len(data["valid_moves"]) > 0


# ---------------------------------------------------------------------------
# POST /pachisi/move
# ---------------------------------------------------------------------------


class TestMove:
    def test_404_without_game(self):
        resp = client.post("/pachisi/move", json={"piece_index": 0}, headers=SESSION_HEADERS)
        assert resp.status_code == 404

    def test_400_when_not_move_phase(self):
        _new_game()
        resp = client.post("/pachisi/move", json={"piece_index": 0}, headers=SESSION_HEADERS)
        assert resp.status_code == 400

    def test_422_on_invalid_piece_index(self):
        _new_game()
        resp = client.post("/pachisi/move", json={"piece_index": 5}, headers=SESSION_HEADERS)
        assert resp.status_code == 422

    def test_422_on_negative_index(self):
        _new_game()
        resp = client.post("/pachisi/move", json={"piece_index": -1}, headers=SESSION_HEADERS)
        assert resp.status_code == 422

    def test_move_piece_from_base(self):
        g = new_game()
        g.phase = "move"
        g.die_value = 6
        g.valid_moves = [0]
        _inject(g)
        with patch("pachisi.game.random.randint", return_value=3):
            resp = client.post("/pachisi/move", json={"piece_index": 0}, headers=SESSION_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        red_state = next(ps for ps in data["player_states"] if ps["player_id"] == "red")
        assert red_state["pieces"][0]["position"] == PLAYER_ENTRY["red"]

    def test_cpu_moves_after_human(self):
        g = new_game()
        g.pieces["red"] = [5, -1, -1, -1]
        g.pieces["yellow"] = [10, -1, -1, -1]
        g.phase = "move"
        g.die_value = 3
        g.extra_turn = False
        g.valid_moves = [0]
        _inject(g)
        with patch("pachisi.game.random.randint", return_value=2):
            resp = client.post("/pachisi/move", json={"piece_index": 0}, headers=SESSION_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_player"] == "red"
        assert data["phase"] == "roll"


# ---------------------------------------------------------------------------
# POST /pachisi/new-game
# ---------------------------------------------------------------------------


class TestRestart:
    def test_404_without_game(self):
        resp = client.post("/pachisi/new-game", headers=SESSION_HEADERS)
        assert resp.status_code == 404

    def test_400_when_not_game_over(self):
        _new_game()
        resp = client.post("/pachisi/new-game", headers=SESSION_HEADERS)
        assert resp.status_code == 400

    def test_restarts_after_game_over(self):
        g = new_game()
        g.phase = "game_over"
        g.winner = "red"
        _inject(g)
        resp = client.post("/pachisi/new-game", headers=SESSION_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["phase"] == "roll"
        assert data["winner"] is None


# ---------------------------------------------------------------------------
# Capture via injected state
# ---------------------------------------------------------------------------


class TestCapture:
    def test_capture_sends_opponent_to_base(self):
        from pachisi.game import SAFE_SQUARES
        from unittest.mock import patch

        target = next(s for s in range(1, 52) if s not in SAFE_SQUARES)
        g = new_game()
        g.pieces["red"] = [target - 1, -1, -1, -1]
        g.pieces["yellow"] = [target, -1, -1, -1]
        g.phase = "move"
        g.die_value = 1
        g.valid_moves = [0]
        _inject(g)
        with patch("pachisi.game.random.randint", return_value=1):
            resp = client.post("/pachisi/move", json={"piece_index": 0}, headers=SESSION_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        yellow_state = next(ps for ps in data["player_states"] if ps["player_id"] == "yellow")
        assert yellow_state["pieces"][0]["position"] == -1
