"""Star Swarm high score submission + leaderboard (#805).

In-memory store — no DB required. Top-10 by score, tie-broken by submission
time (earlier submission wins on equal score).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from limiter import limiter, session_key

router = APIRouter()

LEADERBOARD_LIMIT = 10

_scores: list[dict] = []


class ScoreRequest(BaseModel):
    player_id: str = Field(..., min_length=1, max_length=64)
    score: int = Field(..., ge=0)
    wave_reached: int = Field(..., ge=1)


class LeaderboardEntry(BaseModel):
    player_id: str
    score: int
    wave_reached: int
    timestamp: str
    rank: int


class LeaderboardResponse(BaseModel):
    scores: list[LeaderboardEntry]


def _top10() -> list[LeaderboardEntry]:
    ranked = sorted(_scores, key=lambda s: (-s["score"], s["submitted_at"]))[:LEADERBOARD_LIMIT]
    return [
        LeaderboardEntry(
            player_id=s["player_id"],
            score=s["score"],
            wave_reached=s["wave_reached"],
            timestamp=s["submitted_at"].isoformat(),
            rank=i + 1,
        )
        for i, s in enumerate(ranked)
    ]


@router.post("/score", response_model=LeaderboardResponse, status_code=200)
@limiter.limit("10/minute", key_func=session_key)
async def submit_score(request: Request, body: ScoreRequest) -> LeaderboardResponse:
    _scores.append(
        {
            "player_id": body.player_id,
            "score": body.score,
            "wave_reached": body.wave_reached,
            "submitted_at": datetime.now(tz=timezone.utc),
        }
    )
    return LeaderboardResponse(scores=_top10())


@router.get("/leaderboard", response_model=LeaderboardResponse)
@limiter.limit("60/minute")
async def get_leaderboard(request: Request) -> LeaderboardResponse:
    return LeaderboardResponse(scores=_top10())


def reset_leaderboard() -> None:
    """Test helper — clears the in-memory store."""
    _scores.clear()
