from fastapi import APIRouter, HTTPException

from .game import LudoGame, new_game
from .models import LudoStateResponse, MoveRequest, PieceResponse, PlayerStateResponse

router = APIRouter()

_game: LudoGame | None = None


def reset_game() -> None:
    """Test helper — clears in-memory game state."""
    global _game
    _game = None


def _require_game() -> LudoGame:
    if _game is None:
        raise HTTPException(
            status_code=404,
            detail="No game in progress. POST /ludo/new first.",
        )
    return _game


def _state_response(game: LudoGame) -> LudoStateResponse:
    player_states = []
    for pid in game.players:
        pieces = [
            PieceResponse(
                index=i,
                position=pos,
                is_home=pos == -1,
                is_finished=pos == 100,
            )
            for i, pos in enumerate(game.pieces[pid])
        ]
        player_states.append(
            PlayerStateResponse(
                player_id=pid,
                pieces=pieces,
                pieces_home=sum(1 for p in pieces if p.is_home),
                pieces_finished=sum(1 for p in pieces if p.is_finished),
            )
        )

    return LudoStateResponse(
        phase=game.phase,
        players=game.players,
        current_player=game.current_player,
        die_value=game.die_value,
        valid_moves=game.valid_moves,
        player_states=player_states,
        winner=game.winner,
        extra_turn=game.extra_turn,
        cpu_player=game.cpu_player,
        last_event=game.last_event,
    )


@router.post("/new", response_model=LudoStateResponse)
def new_game_endpoint() -> LudoStateResponse:
    global _game
    _game = new_game()
    return _state_response(_game)


@router.get("/state", response_model=LudoStateResponse)
def get_state() -> LudoStateResponse:
    game = _require_game()
    return _state_response(game)


@router.post("/roll", response_model=LudoStateResponse)
def roll() -> LudoStateResponse:
    game = _require_game()
    try:
        game.roll()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # If human had no valid moves, turn auto-advanced to CPU
    if game.current_player == game.cpu_player and game.phase != "game_over":
        game.cpu_take_turn()
    return _state_response(game)


@router.post("/move", response_model=LudoStateResponse)
def move(request: MoveRequest) -> LudoStateResponse:
    game = _require_game()
    try:
        game.move_piece(request.piece_index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # After human's move, if it's now the CPU's turn, run it
    if game.current_player == game.cpu_player and game.phase != "game_over":
        game.cpu_take_turn()
    return _state_response(game)


@router.post("/new-game", response_model=LudoStateResponse)
def restart() -> LudoStateResponse:
    game = _require_game()
    if game.phase != "game_over":
        raise HTTPException(status_code=400, detail="Game is not over yet.")
    global _game
    _game = new_game()
    return _state_response(_game)
