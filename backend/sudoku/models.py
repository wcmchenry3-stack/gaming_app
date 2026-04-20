from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SudokuMetadata(BaseModel):
    """Validated metadata shape for Sudoku game rows (#614).

    ``extra="forbid"`` rejects unknown keys.  ``difficulty`` is the only
    required game-specific field; it's constrained to the three tiers
    defined in Epic #613.
    """

    model_config = ConfigDict(extra="forbid")
    player_name: str = Field(default="", max_length=64)
    difficulty: Literal["easy", "medium", "hard"]
