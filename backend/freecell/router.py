"""FreeCell leaderboard (#811) — in-memory store.

POST /freecell/score  — accepts { player_id, move_count }, stores in-memory,
                        returns the submitter's rank in the top-10 list.
GET  /freecell/leaderboard — returns top-10 scores sorted ascending by
                             move_count (fewer moves = better).

Sort order: ascending move_count; ties broken by insertion time (older wins).
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from limiter import limiter, session_key

from .models import LeaderboardResponse, ScoreEntry, ScoreSubmitRequest

router = APIRouter()

LEADERBOARD_LIMIT = 10


@dataclass(order=False)
class _Entry:
    player_id: str
    move_count: int
    submitted_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_lock = threading.Lock()
_scores: list[_Entry] = []


def _top_scores() -> list[ScoreEntry]:
    sorted_entries = sorted(_scores, key=lambda e: (e.move_count, e.submitted_at))
    top = sorted_entries[:LEADERBOARD_LIMIT]
    return [
        ScoreEntry(player_id=e.player_id, move_count=e.move_count, rank=i + 1)
        for i, e in enumerate(top)
    ]


@router.post("/score", response_model=ScoreEntry, status_code=201)
@limiter.limit("5/minute", key_func=session_key)
def submit_score(request: Request, body: ScoreSubmitRequest) -> ScoreEntry:
    entry = _Entry(player_id=body.player_id, move_count=body.move_count)
    with _lock:
        _scores.append(entry)
        top = _top_scores()

    for e in top:
        if e.player_id == body.player_id and e.move_count == body.move_count:
            return e
    return ScoreEntry(player_id=body.player_id, move_count=body.move_count, rank=LEADERBOARD_LIMIT + 1)


@router.get("/leaderboard", response_model=LeaderboardResponse)
@limiter.limit("60/minute")
def get_leaderboard(request: Request) -> LeaderboardResponse:
    with _lock:
        return LeaderboardResponse(scores=_top_scores())


def reset_leaderboard() -> None:
    with _lock:
        _scores.clear()
