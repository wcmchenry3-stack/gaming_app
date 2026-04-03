from pydantic import BaseModel, Field


class ScoreSubmitRequest(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=32)
    score: int = Field(..., ge=0)


class ScoreEntry(BaseModel):
    player_name: str
    score: int


class LeaderboardResponse(BaseModel):
    scores: list[ScoreEntry]
