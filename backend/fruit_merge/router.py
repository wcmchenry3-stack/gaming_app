from fastapi import APIRouter
from .models import ScoreSubmitRequest, ScoreEntry, LeaderboardResponse

router = APIRouter()

_leaderboard: list[ScoreEntry] = []
LEADERBOARD_LIMIT = 10


@router.post("/score", response_model=ScoreEntry, status_code=201)
def submit_score(request: ScoreSubmitRequest) -> ScoreEntry:
    entry = ScoreEntry(player_name=request.player_name, score=request.score)
    _leaderboard.append(entry)
    _leaderboard.sort(key=lambda e: e.score, reverse=True)
    del _leaderboard[LEADERBOARD_LIMIT:]
    return entry


@router.get("/scores", response_model=LeaderboardResponse)
def get_scores() -> LeaderboardResponse:
    return LeaderboardResponse(scores=list(_leaderboard))


def reset_leaderboard() -> None:
    """Test helper — clears in-memory leaderboard."""
    _leaderboard.clear()
