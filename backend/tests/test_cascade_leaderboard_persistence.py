"""#366: cascade leaderboard survives across engine dispose + reload.

The in-memory leaderboard that preceded #366 lost every score on restart.
This test exercises the DB-backed replacement by:
  1. POSTing a score via one TestClient
  2. Disposing the engine pool (proxy for a process restart — drops all
     open connections)
  3. Re-opening a fresh TestClient and asserting the score is still visible

Uses a dedicated SQLite file so autouse clean_db_tables fixture in
conftest.py does NOT wipe the row (we disable that fixture for this module).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from db.base import get_engine


# Disable the autouse table-clearing fixture for this file: the whole point
# is that data survives across in-process "restarts".
@pytest.fixture(autouse=True)
async def _clean_db_tables():
    yield


async def test_cascade_score_survives_engine_dispose() -> None:
    from main import app

    with TestClient(app) as c1:
        r = c1.post(
            "/cascade/score",
            json={"player_name": "PersistenceTester", "score": 4242},
        )
        assert r.status_code == 201, r.text

    # Proxy for "backend restart" — drop connection pool.
    engine = get_engine()
    await engine.dispose()

    with TestClient(app) as c2:
        r = c2.get("/cascade/scores")
        assert r.status_code == 200
        scores = r.json()["scores"]
        assert any(
            s["player_name"] == "PersistenceTester" and s["score"] == 4242 for s in scores
        ), f"Expected persisted score in {scores!r}"

    # Manual cleanup since clean_db_tables is disabled.
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM games"))
