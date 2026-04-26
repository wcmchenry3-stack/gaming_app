from pydantic import BaseModel, ConfigDict


class BlackjackMetadata(BaseModel):
    """Validated metadata shape for Blackjack game rows (#539).

    Blackjack state lives in-memory; no metadata fields are required.
    ``extra="forbid"`` rejects unexpected keys so callers can't silently
    stash arbitrary data in the JSONB column.
    """

    model_config = ConfigDict(extra="forbid")
