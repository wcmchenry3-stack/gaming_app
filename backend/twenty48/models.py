from pydantic import BaseModel, Field


class MoveRequest(BaseModel):
    direction: str = Field(..., pattern="^(up|down|left|right)$")


class Twenty48StateResponse(BaseModel):
    board: list[list[int]]
    score: int
    game_over: bool
    has_won: bool
