from fastapi import APIRouter, Request

from limiter import limiter
from .models import ScoreSubmitRequest, ScoreEntry, LeaderboardResponse

router = APIRouter()

_leaderboard: list[ScoreEntry] = []
LEADERBOARD_LIMIT = 10


@router.post("/score", response_model=ScoreEntry, status_code=201)
@limiter.limit("5/minute")
def submit_score(request: Request, body: ScoreSubmitRequest) -> ScoreEntry:
    entry = ScoreEntry(player_name=body.player_name, score=body.score)
    _leaderboard.append(entry)
    _leaderboard.sort(key=lambda e: e.score, reverse=True)
    del _leaderboard[LEADERBOARD_LIMIT:]
    return entry


@router.get("/scores", response_model=LeaderboardResponse)
@limiter.limit("60/minute")
def get_scores(request: Request) -> LeaderboardResponse:
    return LeaderboardResponse(scores=list(_leaderboard))


def reset_leaderboard() -> None:
    """Test helper — clears in-memory leaderboard."""
    _leaderboard.clear()
