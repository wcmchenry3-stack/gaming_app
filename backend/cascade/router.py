from fastapi import APIRouter, Request

from limiter import limiter
from .models import ScoreSubmitRequest, ScoreEntry, LeaderboardResponse

router = APIRouter()

_leaderboard: list[ScoreEntry] = []
LEADERBOARD_LIMIT = 10


@router.post("/score", response_model=ScoreEntry, status_code=201)
@limiter.limit("5/minute")
def submit_score(request: Request, body: ScoreSubmitRequest) -> ScoreEntry:
    entry = ScoreEntry(player_name=body.player_name, score=body.score, rank=0)
    _leaderboard.append(entry)
    # Stable sort: ties preserve insertion order, so a new tied entry ranks
    # *below* an older tied entry. This is the existing behavior.
    _leaderboard.sort(key=lambda e: e.score, reverse=True)
    # Identity check — can't use .index() because two tied entries compare
    # equal by Pydantic field equality.
    rank = next(i for i, e in enumerate(_leaderboard) if e is entry) + 1
    entry.rank = rank
    # Renumber remaining entries since a mid-list insert shifts ranks below.
    for i, e in enumerate(_leaderboard):
        e.rank = i + 1
    del _leaderboard[LEADERBOARD_LIMIT:]
    return entry


@router.get("/scores", response_model=LeaderboardResponse)
@limiter.limit("60/minute")
def get_scores(request: Request) -> LeaderboardResponse:
    return LeaderboardResponse(scores=list(_leaderboard))


def reset_leaderboard() -> None:
    """Test helper — clears in-memory leaderboard."""
    _leaderboard.clear()
