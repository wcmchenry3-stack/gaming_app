from pydantic import BaseModel, ConfigDict, Field


class SolitaireMetadata(BaseModel):
    """Validated metadata shape for Solitaire game rows (#592).

    ``player_name`` is optional here because the generic ``POST /games``
    endpoint may be called without a name; the Solitaire-specific
    ``POST /solitaire/score`` route always supplies it internally.
    ``extra="forbid"`` rejects unknown keys.
    """

    model_config = ConfigDict(extra="forbid")
    player_name: str = Field(default="", max_length=64)
