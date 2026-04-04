"""API integration tests for the 2048 endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient

import twenty48.router as twenty48_router_module
from main import app

client = TestClient(app)

TEST_SESSION_ID = str(uuid.uuid4())
SESSION_HEADERS = {"X-Session-ID": TEST_SESSION_ID}


@pytest.fixture(autouse=True)
def reset():
    twenty48_router_module.reset_game()
    yield
    twenty48_router_module.reset_game()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def new_game():
    return client.post("/twenty48/new", headers=SESSION_HEADERS)


def get_state():
    return client.get("/twenty48/state", headers=SESSION_HEADERS)


def move(direction: str):
    return client.post("/twenty48/move", json={"direction": direction}, headers=SESSION_HEADERS)


# ---------------------------------------------------------------------------
# TestNewGame
# ---------------------------------------------------------------------------


class TestNewGame:
    def test_returns_200(self):
        resp = new_game()
        assert resp.status_code == 200

    def test_board_is_4x4(self):
        data = new_game().json()
        assert len(data["board"]) == 4
        for row in data["board"]:
            assert len(row) == 4

    def test_initial_score_zero(self):
        data = new_game().json()
        assert data["score"] == 0

    def test_not_game_over(self):
        data = new_game().json()
        assert data["game_over"] is False

    def test_not_won(self):
        data = new_game().json()
        assert data["has_won"] is False

    def test_has_two_initial_tiles(self):
        data = new_game().json()
        non_zero = sum(1 for row in data["board"] for cell in row if cell != 0)
        assert non_zero == 2


# ---------------------------------------------------------------------------
# TestGetState
# ---------------------------------------------------------------------------


class TestGetState:
    def test_404_without_game(self):
        resp = get_state()
        assert resp.status_code == 404

    def test_200_after_new_game(self):
        new_game()
        resp = get_state()
        assert resp.status_code == 200
        assert "board" in resp.json()


# ---------------------------------------------------------------------------
# TestMove
# ---------------------------------------------------------------------------


class TestMove:
    def test_valid_move_returns_200(self):
        new_game()
        # Try all four directions; at least one should succeed on a fresh board
        for direction in ("left", "right", "up", "down"):
            resp = move(direction)
            if resp.status_code == 200:
                return
        pytest.fail("No valid move found on a fresh board")

    def test_invalid_direction_returns_422(self):
        new_game()
        resp = move("diagonal")
        assert resp.status_code == 422

    def test_no_effect_move_returns_400(self):
        new_game()
        # Set up a board where left has no effect
        game = twenty48_router_module._sessions[TEST_SESSION_ID]
        game.board = [
            [2, 0, 0, 0],
            [4, 0, 0, 0],
            [2, 0, 0, 0],
            [4, 0, 0, 0],
        ]
        resp = move("left")
        assert resp.status_code == 400

    def test_404_without_game(self):
        resp = move("left")
        assert resp.status_code == 404

    def test_move_after_game_over_returns_400(self):
        new_game()
        game = twenty48_router_module._sessions[TEST_SESSION_ID]
        game.board = [
            [2, 4, 2, 4],
            [4, 2, 4, 2],
            [2, 4, 2, 4],
            [4, 2, 4, 2],
        ]
        game.game_over = True
        resp = move("left")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# TestSessionIsolation
# ---------------------------------------------------------------------------


class TestSessionIsolation:
    def test_independent_boards(self):
        # Session A
        headers_a = {"X-Session-ID": str(uuid.uuid4())}
        resp_a = client.post("/twenty48/new", headers=headers_a)
        board_a = resp_a.json()["board"]

        # Session B
        headers_b = {"X-Session-ID": str(uuid.uuid4())}
        resp_b = client.post("/twenty48/new", headers=headers_b)
        board_b = resp_b.json()["board"]

        # Get state for each — should be independent
        state_a = client.get("/twenty48/state", headers=headers_a).json()["board"]
        state_b = client.get("/twenty48/state", headers=headers_b).json()["board"]

        assert state_a == board_a
        assert state_b == board_b
