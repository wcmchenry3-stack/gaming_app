from pydantic import BaseModel, ConfigDict, Field


class HeartsMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    player_name: str = Field(default="", max_length=64)


class ScoreSubmitRequest(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=32)
    score: int = Field(..., ge=0)


class ScoreEntry(BaseModel):
    player_name: str
    score: int
    rank: int


class LeaderboardResponse(BaseModel):
    scores: list[ScoreEntry]
