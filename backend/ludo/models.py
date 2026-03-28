from pydantic import BaseModel, Field


class MoveRequest(BaseModel):
    piece_index: int = Field(..., ge=0, le=3)


class PieceResponse(BaseModel):
    index: int
    position: int  # -1=base, 0-51=outer track, 52-57=red home col, 64-69=yellow home col, 100=finished
    is_home: bool
    is_finished: bool


class PlayerStateResponse(BaseModel):
    player_id: str
    pieces: list[PieceResponse]
    pieces_home: int
    pieces_finished: int


class LudoStateResponse(BaseModel):
    phase: str  # "roll" | "move" | "game_over"
    players: list[str]
    current_player: str
    die_value: int | None
    valid_moves: list[int]
    player_states: list[PlayerStateResponse]
    winner: str | None
    extra_turn: bool
    cpu_player: str | None
    last_event: str | None
