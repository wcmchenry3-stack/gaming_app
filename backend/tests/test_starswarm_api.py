"""Tests for /starswarm/score and /starswarm/leaderboard (#898).

DB-backed leaderboard — mirrors solitaire/cascade pattern. The autouse
_clean_db_tables fixture in conftest.py handles per-test DB isolation.
"""

import pytest
from fastapi.testclient import TestClient

import starswarm.router as starswarm_router_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_leaderboard():
    starswarm_router_module.reset_leaderboard()
    yield
    starswarm_router_module.reset_leaderboard()


def _submit(player_id: str, score: int, wave_reached: int = 1):
    return client.post(
        "/starswarm/score",
        json={"player_id": player_id, "score": score, "wave_reached": wave_reached},
    )


# ---------------------------------------------------------------------------
# POST /starswarm/score
# ---------------------------------------------------------------------------


class TestSubmitScore:
    def test_valid_submission_returns_200(self):
        res = _submit("alice", 500, wave_reached=3)
        assert res.status_code == 200
        body = res.json()
        assert "scores" in body
        assert body["scores"][0]["player_id"] == "alice"
        assert body["scores"][0]["score"] == 500
        assert body["scores"][0]["wave_reached"] == 3
        assert body["scores"][0]["rank"] == 1

    def test_missing_player_id_returns_422(self):
        res = client.post("/starswarm/score", json={"score": 100, "wave_reached": 1})
        assert res.status_code == 422

    def test_missing_score_returns_422(self):
        res = client.post("/starswarm/score", json={"player_id": "alice", "wave_reached": 1})
        assert res.status_code == 422

    def test_missing_wave_reached_returns_422(self):
        res = client.post("/starswarm/score", json={"player_id": "alice", "score": 100})
        assert res.status_code == 422

    def test_empty_player_id_returns_422(self):
        res = _submit("", 100)
        assert res.status_code == 422

    def test_negative_score_returns_422(self):
        res = _submit("alice", -1)
        assert res.status_code == 422

    def test_zero_wave_reached_returns_422(self):
        res = client.post(
            "/starswarm/score", json={"player_id": "alice", "score": 0, "wave_reached": 0}
        )
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# GET /starswarm/leaderboard
# ---------------------------------------------------------------------------


class TestGetLeaderboard:
    def test_empty_initially(self):
        res = client.get("/starswarm/leaderboard")
        assert res.status_code == 200
        assert res.json()["scores"] == []

    def test_returns_submitted_entries(self):
        _submit("alice", 300)
        _submit("bob", 100)
        scores = client.get("/starswarm/leaderboard").json()["scores"]
        assert len(scores) == 2

    def test_ordered_descending_by_score(self):
        from limiter import limiter

        _submit("alice", 100)
        limiter.reset()
        _submit("bob", 500)
        limiter.reset()
        _submit("carol", 250)
        scores = client.get("/starswarm/leaderboard").json()["scores"]
        assert [s["score"] for s in scores] == [500, 250, 100]
        assert scores[0]["rank"] == 1

    def test_capped_at_ten_entries(self):
        from limiter import limiter

        for i in range(15):
            limiter.reset()
            _submit(f"player{i}", (i + 1) * 10)
        scores = client.get("/starswarm/leaderboard").json()["scores"]
        assert len(scores) == 10
        assert scores[0]["score"] == 150  # highest score first

    def test_wave_reached_preserved(self):
        _submit("alice", 200, wave_reached=7)
        scores = client.get("/starswarm/leaderboard").json()["scores"]
        assert scores[0]["wave_reached"] == 7


# ---------------------------------------------------------------------------
# Tie-break ordering — older entry wins
# ---------------------------------------------------------------------------


class TestTieBreak:
    def test_older_entry_ranks_higher_on_tie(self):
        from limiter import limiter

        _submit("alice", 100)
        limiter.reset()
        _submit("bob", 100)

        scores = client.get("/starswarm/leaderboard").json()["scores"]
        assert scores[0]["player_id"] == "alice"
        assert scores[1]["player_id"] == "bob"


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


class TestRateLimit:
    def test_eleventh_submission_returns_429(self):
        from limiter import limiter

        for i in range(10):
            assert _submit(f"player{i}", i + 1).status_code == 200

        res = _submit("excess", 999)
        assert res.status_code == 429
        assert "Retry-After" in res.headers
        limiter.reset()

    def test_leaderboard_get_not_rate_limited_at_low_volume(self):
        for _ in range(5):
            assert client.get("/starswarm/leaderboard").status_code == 200
