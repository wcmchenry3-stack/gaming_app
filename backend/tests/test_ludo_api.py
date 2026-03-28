"""Integration tests for Ludo FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from main import app
import ludo.router as ludo_router_module
from ludo.game import PLAYER_ENTRY, new_game

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset():
    ludo_router_module.reset_game()
    yield
    ludo_router_module.reset_game()


def _new_game():
    resp = client.post("/ludo/new")
    assert resp.status_code == 200
    return resp.json()


def _inject(game):
    ludo_router_module._game = game


# ---------------------------------------------------------------------------
# POST /ludo/new
# ---------------------------------------------------------------------------


class TestNewGame:
    def test_returns_200(self):
        resp = client.post("/ludo/new")
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
# GET /ludo/state
# ---------------------------------------------------------------------------


class TestGetState:
    def test_404_without_game(self):
        resp = client.get("/ludo/state")
        assert resp.status_code == 404

    def test_200_with_game(self):
        _new_game()
        resp = client.get("/ludo/state")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /ludo/roll
# ---------------------------------------------------------------------------


class TestRoll:
    def test_404_without_game(self):
        resp = client.post("/ludo/roll")
        assert resp.status_code == 404

    def test_400_when_not_roll_phase(self):
        g = new_game()
        g.phase = "move"
        g.die_value = 3
        g.valid_moves = [0]
        _inject(g)
        resp = client.post("/ludo/roll")
        assert resp.status_code == 400

    def test_die_value_in_range(self):
        _new_game()
        # Inject a piece on track so there may be valid moves
        g = ludo_router_module._game
        g.pieces["red"] = [5, -1, -1, -1]
        with patch("ludo.game.random.randint", return_value=3):
            resp = client.post("/ludo/roll")
        assert resp.status_code == 200
        data = resp.json()
        assert data["die_value"] == 3

    def test_no_valid_moves_auto_skips_and_cpu_moves(self):
        # Red all in base, non-6 → auto-skips to yellow, CPU runs, returns to red
        _new_game()
        g = ludo_router_module._game
        # Yellow has a piece on track so CPU can move
        g.pieces["yellow"] = [5, -1, -1, -1]
        with patch("ludo.game.random.randint", side_effect=[3, 2]):
            # 3 = red's roll (no valid moves), 2 = cpu's roll
            resp = client.post("/ludo/roll")
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_player"] == "red"

    def test_roll_six_gives_valid_moves(self):
        _new_game()
        with patch("ludo.game.random.randint", return_value=6):
            resp = client.post("/ludo/roll")
        assert resp.status_code == 200
        data = resp.json()
        assert data["die_value"] == 6
        assert len(data["valid_moves"]) > 0


# ---------------------------------------------------------------------------
# POST /ludo/move
# ---------------------------------------------------------------------------


class TestMove:
    def test_404_without_game(self):
        resp = client.post("/ludo/move", json={"piece_index": 0})
        assert resp.status_code == 404

    def test_400_when_not_move_phase(self):
        _new_game()
        resp = client.post("/ludo/move", json={"piece_index": 0})
        assert resp.status_code == 400

    def test_422_on_invalid_piece_index(self):
        _new_game()
        resp = client.post("/ludo/move", json={"piece_index": 5})
        assert resp.status_code == 422

    def test_422_on_negative_index(self):
        _new_game()
        resp = client.post("/ludo/move", json={"piece_index": -1})
        assert resp.status_code == 422

    def test_move_piece_from_base(self):
        g = new_game()
        g.phase = "move"
        g.die_value = 6
        g.valid_moves = [0]
        _inject(g)
        with patch("ludo.game.random.randint", return_value=3):
            resp = client.post("/ludo/move", json={"piece_index": 0})
        assert resp.status_code == 200
        data = resp.json()
        red_state = next(ps for ps in data["player_states"] if ps["player_id"] == "red")
        assert red_state["pieces"][0]["position"] == PLAYER_ENTRY["red"]

    def test_cpu_moves_after_human(self):
        # After human's non-6 move, CPU should have already taken its turn
        g = new_game()
        g.pieces["red"] = [5, -1, -1, -1]
        g.pieces["yellow"] = [10, -1, -1, -1]
        g.phase = "move"
        g.die_value = 3
        g.extra_turn = False
        g.valid_moves = [0]
        _inject(g)
        with patch("ludo.game.random.randint", return_value=2):
            resp = client.post("/ludo/move", json={"piece_index": 0})
        assert resp.status_code == 200
        data = resp.json()
        # After CPU runs, it's red's turn again
        assert data["current_player"] == "red"
        assert data["phase"] == "roll"


# ---------------------------------------------------------------------------
# POST /ludo/new-game
# ---------------------------------------------------------------------------


class TestRestart:
    def test_404_without_game(self):
        resp = client.post("/ludo/new-game")
        assert resp.status_code == 404

    def test_400_when_not_game_over(self):
        _new_game()
        resp = client.post("/ludo/new-game")
        assert resp.status_code == 400

    def test_restarts_after_game_over(self):
        g = new_game()
        g.phase = "game_over"
        g.winner = "red"
        _inject(g)
        resp = client.post("/ludo/new-game")
        assert resp.status_code == 200
        data = resp.json()
        assert data["phase"] == "roll"
        assert data["winner"] is None


# ---------------------------------------------------------------------------
# Capture via injected state
# ---------------------------------------------------------------------------


class TestCapture:
    def test_capture_sends_opponent_to_base(self):
        from ludo.game import SAFE_SQUARES
        from unittest.mock import patch

        # Find a non-safe square to stage the capture
        target = next(s for s in range(1, 52) if s not in SAFE_SQUARES)
        g = new_game()
        g.pieces["red"] = [target - 1, -1, -1, -1]
        g.pieces["yellow"] = [target, -1, -1, -1]
        g.phase = "move"
        g.die_value = 1
        g.valid_moves = [0]
        _inject(g)
        # Patch random so CPU rolls 1 — all yellow pieces in base, no valid moves → skip
        with patch("ludo.game.random.randint", return_value=1):
            resp = client.post("/ludo/move", json={"piece_index": 0})
        assert resp.status_code == 200
        data = resp.json()
        yellow_state = next(ps for ps in data["player_states"] if ps["player_id"] == "yellow")
        assert yellow_state["pieces"][0]["position"] == -1
