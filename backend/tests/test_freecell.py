"""Tests for /freecell/score and /freecell/leaderboard (#899).

DB-backed leaderboard — mirrors starswarm/hearts pattern. The autouse
_clean_db_tables fixture in conftest.py handles per-test DB isolation.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
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


# ---------------------------------------------------------------------------
# Async unit tests for internal helpers
# ---------------------------------------------------------------------------


class TestInternalHelpers:
    async def test_game_type_id_raises_500_when_missing(self):
        """HTTPException(500) when freecell GameType absent from DB."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_result

        with pytest.raises(HTTPException) as exc_info:
            await freecell_router_module._freecell_game_type_id(mock_session)

        assert exc_info.value.status_code == 500
        assert "missing" in exc_info.value.detail

    async def test_top10_returns_leaderboard_entries(self):
        """_top10 correctly builds ScoreEntry list from DB rows."""
        mock_game = MagicMock()
        mock_game.final_score = 75
        mock_game.game_metadata = {"player_name": "tester"}
        mock_game.completed_at = datetime(2024, 1, 1, tzinfo=timezone.utc)

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_game]
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value = mock_scalars

        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_execute_result

        with patch.object(
            freecell_router_module, "_freecell_game_type_id", AsyncMock(return_value=1)
        ):
            entries = await freecell_router_module._top10(mock_session)

        assert len(entries) == 1
        assert entries[0].player_id == "tester"
        assert entries[0].move_count == 75
        assert entries[0].rank == 1

    async def test_top10_falls_back_on_missing_metadata(self):
        """_top10 defaults player_id='anon' when metadata absent."""
        mock_game = MagicMock()
        mock_game.final_score = 50
        mock_game.game_metadata = {}
        mock_game.completed_at = datetime(2024, 6, 1, tzinfo=timezone.utc)

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_game]
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value = mock_scalars

        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_execute_result

        with patch.object(
            freecell_router_module, "_freecell_game_type_id", AsyncMock(return_value=1)
        ):
            entries = await freecell_router_module._top10(mock_session)

        assert entries[0].player_id == "anon"

    async def test_top10_empty_when_no_rows(self):
        """_top10 returns [] when DB has no scores."""
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value = mock_scalars

        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_execute_result

        with patch.object(
            freecell_router_module, "_freecell_game_type_id", AsyncMock(return_value=1)
        ):
            entries = await freecell_router_module._top10(mock_session)

        assert entries == []
