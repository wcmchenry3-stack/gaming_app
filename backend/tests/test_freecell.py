"""Tests for /freecell/score and /freecell/leaderboard (#812)."""

import pytest
from fastapi.testclient import TestClient

import freecell.router as freecell_router_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_leaderboard():
    freecell_router_module.reset_leaderboard()
    yield
    freecell_router_module.reset_leaderboard()


def _submit(player_id: str, move_count: int):
    return client.post("/freecell/score", json={"player_id": player_id, "move_count": move_count})


# ---------------------------------------------------------------------------
# POST /freecell/score
# ---------------------------------------------------------------------------


class TestSubmitScore:
    def test_valid_submission_returns_201(self):
        res = _submit("alice", 120)
        assert res.status_code == 201
        body = res.json()
        assert body["player_id"] == "alice"
        assert body["move_count"] == 120
        assert body["rank"] == 1

    def test_missing_player_id_returns_422(self):
        res = client.post("/freecell/score", json={"move_count": 50})
        assert res.status_code == 422

    def test_missing_move_count_returns_422(self):
        res = client.post("/freecell/score", json={"player_id": "alice"})
        assert res.status_code == 422

    def test_empty_player_id_returns_422(self):
        res = _submit("", 50)
        assert res.status_code == 422

    def test_zero_move_count_returns_422(self):
        res = _submit("alice", 0)
        assert res.status_code == 422

    def test_negative_move_count_returns_422(self):
        res = _submit("alice", -5)
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# GET /freecell/leaderboard
# ---------------------------------------------------------------------------


class TestGetLeaderboard:
    def test_empty_initially(self):
        res = client.get("/freecell/leaderboard")
        assert res.status_code == 200
        assert res.json()["scores"] == []

    def test_returns_submitted_entries(self):
        _submit("alice", 80)
        _submit("bob", 120)
        scores = client.get("/freecell/leaderboard").json()["scores"]
        assert len(scores) == 2

    def test_ordered_ascending_by_move_count(self):
        from limiter import limiter

        _submit("alice", 200)
        limiter.reset()
        _submit("bob", 50)
        limiter.reset()
        _submit("carol", 120)
        scores = client.get("/freecell/leaderboard").json()["scores"]
        assert [s["move_count"] for s in scores] == [50, 120, 200]
        assert scores[0]["rank"] == 1

    def test_capped_at_ten_entries(self):
        from limiter import limiter

        for i in range(15):
            limiter.reset()
            _submit(f"player{i}", (i + 1) * 10)
        scores = client.get("/freecell/leaderboard").json()["scores"]
        assert len(scores) == 10
        assert scores[0]["move_count"] == 10  # lowest move count wins

    def test_fewer_moves_ranks_higher(self):
        from limiter import limiter

        _submit("alice", 300)
        limiter.reset()
        assert _submit("bob", 100).json()["rank"] == 1


# ---------------------------------------------------------------------------
# Rank in submission response
# ---------------------------------------------------------------------------


class TestSubmitRank:
    def test_first_submission_rank_1(self):
        assert _submit("alice", 80).json()["rank"] == 1

    def test_higher_move_count_ranked_lower(self):
        from limiter import limiter

        _submit("alice", 80)
        limiter.reset()
        assert _submit("bob", 200).json()["rank"] == 2

    def test_off_leaderboard_returns_rank_11(self):
        from limiter import limiter

        for i in range(10):
            limiter.reset()
            _submit(f"top{i}", i + 1)
        limiter.reset()
        assert _submit("slow", 9999).json()["rank"] == 11


# ---------------------------------------------------------------------------
# Tie-break ordering — older entry wins
# ---------------------------------------------------------------------------


class TestTieBreak:
    def test_older_entry_ranks_higher_on_tie(self):
        from limiter import limiter

        _submit("alice", 100)
        limiter.reset()
        body = _submit("bob", 100).json()

        scores = client.get("/freecell/leaderboard").json()["scores"]
        assert scores[0]["player_id"] == "alice"
        assert scores[1]["player_id"] == "bob"
        assert body["rank"] == 2


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


class TestRateLimit:
    def test_sixth_submission_returns_429(self):
        from limiter import limiter

        for i in range(5):
            assert _submit(f"player{i}", i + 1).status_code == 201

        res = _submit("excess", 999)
        assert res.status_code == 429
        assert "Retry-After" in res.headers
        limiter.reset()

    def test_leaderboard_get_not_rate_limited_at_low_volume(self):
        for _ in range(5):
            assert client.get("/freecell/leaderboard").status_code == 200
