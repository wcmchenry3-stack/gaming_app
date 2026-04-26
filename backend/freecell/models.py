from pydantic import BaseModel, Field


class ScoreSubmitRequest(BaseModel):
    player_id: str = Field(..., min_length=1, max_length=64)
    move_count: int = Field(..., gt=0)


class ScoreEntry(BaseModel):
    player_id: str
    move_count: int
    rank: int


class LeaderboardResponse(BaseModel):
    scores: list[ScoreEntry]
