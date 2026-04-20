"""Tests for /sudoku/score and /sudoku/scores/{difficulty} (#615).

Adapts the Solitaire leaderboard test pattern to Sudoku's
difficulty-partitioned model: each of easy / medium / hard is its own
top-10 list, enforced at the query level via ``game_metadata->>'difficulty'``.
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _submit(player_name: str, score: int, difficulty: str = "easy"):
    return client.post(
        "/sudoku/score",
        json={"player_name": player_name, "score": score, "difficulty": difficulty},
    )


# ---------------------------------------------------------------------------
# POST /sudoku/score — validation
# ---------------------------------------------------------------------------


class TestSubmitScore:
    def test_valid_submission_returns_201(self):
        res = _submit("Alice", 80, "easy")
        assert res.status_code == 201
        body = res.json()
        assert body["player_name"] == "Alice"
        assert body["score"] == 80
        assert body["rank"] == 1

    def test_missing_player_name_returns_422(self):
        res = client.post("/sudoku/score", json={"score": 100, "difficulty": "easy"})
        assert res.status_code == 422

    def test_missing_score_returns_422(self):
        res = client.post(
            "/sudoku/score", json={"player_name": "Bob", "difficulty": "easy"}
        )
        assert res.status_code == 422

    def test_missing_difficulty_returns_422(self):
        res = client.post("/sudoku/score", json={"player_name": "Bob", "score": 100})
        assert res.status_code == 422

    def test_empty_player_name_returns_422(self):
        assert _submit("", 100).status_code == 422

    def test_name_too_long_returns_422(self):
        assert _submit("x" * 33, 100).status_code == 422

    def test_negative_score_returns_422(self):
        assert _submit("Alice", -1).status_code == 422

    def test_invalid_difficulty_returns_422(self):
        assert _submit("Alice", 100, "impossible").status_code == 422


# ---------------------------------------------------------------------------
# GET /sudoku/scores/{difficulty}
# ---------------------------------------------------------------------------


class TestGetScores:
    def test_empty_initially(self):
        res = client.get("/sudoku/scores/easy")
        assert res.status_code == 200
        assert res.json()["scores"] == []

    def test_returns_submitted_entries_for_difficulty(self):
        _submit("Alice", 90, "easy")
        _submit("Bob", 60, "easy")
        scores = client.get("/sudoku/scores/easy").json()["scores"]
        assert len(scores) == 2

    def test_ordered_by_score_descending(self):
        from limiter import limiter

        limiter.reset()
        _submit("Alice", 40, "medium")
        limiter.reset()
        _submit("Bob", 180, "medium")
        limiter.reset()
        _submit("Carol", 120, "medium")
        scores = client.get("/sudoku/scores/medium").json()["scores"]
        assert [s["score"] for s in scores] == [180, 120, 40]

    def test_invalid_difficulty_path_returns_422(self):
        assert client.get("/sudoku/scores/impossible").status_code == 422

    def test_capped_at_ten_entries(self):
        from limiter import limiter

        for i in range(15):
            limiter.reset()
            _submit(f"Player{i}", i * 10, "hard")
        scores = client.get("/sudoku/scores/hard").json()["scores"]
        assert len(scores) == 10
        assert scores[0]["score"] == 140


# ---------------------------------------------------------------------------
# Difficulty isolation — the critical contract
# ---------------------------------------------------------------------------


class TestDifficultyIsolation:
    def test_easy_submission_absent_from_hard(self):
        _submit("EasyPlayer", 100, "easy")
        hard = client.get("/sudoku/scores/hard").json()["scores"]
        assert hard == []

    def test_hard_submission_absent_from_easy(self):
        _submit("HardPlayer", 290, "hard")
        easy = client.get("/sudoku/scores/easy").json()["scores"]
        assert easy == []

    def test_three_tiers_kept_separate(self):
        from limiter import limiter

        limiter.reset()
        _submit("E", 100, "easy")
        limiter.reset()
        _submit("M", 200, "medium")
        limiter.reset()
        _submit("H", 300, "hard")

        easy = client.get("/sudoku/scores/easy").json()["scores"]
        medium = client.get("/sudoku/scores/medium").json()["scores"]
        hard = client.get("/sudoku/scores/hard").json()["scores"]

        assert [s["player_name"] for s in easy] == ["E"]
        assert [s["player_name"] for s in medium] == ["M"]
        assert [s["player_name"] for s in hard] == ["H"]


# ---------------------------------------------------------------------------
# Rank semantics
# ---------------------------------------------------------------------------


class TestSubmitRank:
    def test_first_submission_rank_1(self):
        assert _submit("Alice", 90, "easy").json()["rank"] == 1

    def test_off_leaderboard_returns_rank_11(self):
        from limiter import limiter

        for i in range(10):
            limiter.reset()
            _submit(f"Top{i}", 1000, "medium")
        limiter.reset()
        assert _submit("Lowly", 1, "medium").json()["rank"] == 11


# ---------------------------------------------------------------------------
# Rate limiter — POST /sudoku/score is 5/min
# ---------------------------------------------------------------------------


class TestRateLimit:
    def test_sixth_submission_returns_429(self):
        from limiter import limiter

        for i in range(5):
            assert _submit(f"P{i}", i * 10, "easy").status_code == 201
        assert _submit("Excess", 999, "easy").status_code == 429
        limiter.reset()
