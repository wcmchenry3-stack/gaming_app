from typing import Optional
from pydantic import BaseModel


class RollRequest(BaseModel):
    held: list[bool]  # exactly 5 booleans


class ScoreRequest(BaseModel):
    category: str


class GameStateResponse(BaseModel):
    dice: list[int]
    held: list[bool]
    rolls_used: int
    round: int
    scores: dict[str, Optional[int]]
    game_over: bool
    upper_subtotal: int
    upper_bonus: int
    total_score: int


class PossibleScoresResponse(BaseModel):
    possible_scores: dict[str, int]


class ErrorResponse(BaseModel):
    detail: str
