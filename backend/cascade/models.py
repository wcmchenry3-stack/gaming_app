from pydantic import BaseModel, Field


class ScoreSubmitRequest(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=32)
    score: int = Field(..., ge=0)


class ScoreEntry(BaseModel):
    player_name: str
    score: int
    # 1-indexed position in the sorted leaderboard. A submit that didn't make
    # the top 10 will have rank == 11 (the truncated-off position).
    rank: int


class LeaderboardResponse(BaseModel):
    scores: list[ScoreEntry]
