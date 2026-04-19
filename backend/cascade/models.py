from pydantic import BaseModel, ConfigDict, Field


class CascadeMetadata(BaseModel):
    """Validated metadata shape for Cascade game rows (#539).

    ``player_name`` is optional because a game may be created before the
    player has entered their name; ``PATCH /cascade/score/{game_id}`` sets it
    after game-over.  ``extra="forbid"`` rejects unknown keys.
    """

    model_config = ConfigDict(extra="forbid")
    player_name: str = Field(default="", max_length=64)


class SetPlayerNameRequest(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=32)


class ScoreEntry(BaseModel):
    player_name: str
    score: int
    # 1-indexed position in the sorted leaderboard. A submit that didn't make
    # the top 10 will have rank == 11 (the truncated-off position).
    rank: int


class LeaderboardResponse(BaseModel):
    scores: list[ScoreEntry]
