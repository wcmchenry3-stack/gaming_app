from collections import OrderedDict

from fastapi import APIRouter, HTTPException, Request

from limiter import limiter
from session import get_session_id
from .game import PachisiGame, new_game
from .models import PachisiStateResponse, MoveRequest, PieceResponse, PlayerStateResponse

router = APIRouter()

_MAX_SESSIONS = 500
_sessions: OrderedDict[str, PachisiGame] = OrderedDict()


def reset_game() -> None:
    """Test helper — clears all in-memory session state."""
    _sessions.clear()


def _evict_if_full() -> None:
    while len(_sessions) >= _MAX_SESSIONS:
        _sessions.popitem(last=False)


def _require_game(session_id: str) -> PachisiGame:
    game = _sessions.get(session_id)
    if game is None:
        raise HTTPException(
            status_code=404,
            detail="No game in progress. POST /pachisi/new first.",
        )
    return game


def _state_response(game: PachisiGame) -> PachisiStateResponse:
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

    return PachisiStateResponse(
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


@router.post("/new", response_model=PachisiStateResponse)
@limiter.limit("10/minute")
def new_game_endpoint(request: Request) -> PachisiStateResponse:
    sid = get_session_id(request)
    _evict_if_full()
    _sessions[sid] = new_game()
    return _state_response(_sessions[sid])


@router.get("/state", response_model=PachisiStateResponse)
@limiter.limit("60/minute")
def get_state(request: Request) -> PachisiStateResponse:
    sid = get_session_id(request)
    return _state_response(_require_game(sid))


@router.post("/roll", response_model=PachisiStateResponse)
@limiter.limit("30/minute")
def roll(request: Request) -> PachisiStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.roll()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if game.current_player == game.cpu_player and game.phase != "game_over":
        game.cpu_take_turn()
    return _state_response(game)


@router.post("/move", response_model=PachisiStateResponse)
@limiter.limit("30/minute")
def move(request: Request, body: MoveRequest) -> PachisiStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.move_piece(body.piece_index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if game.current_player == game.cpu_player and game.phase != "game_over":
        game.cpu_take_turn()
    return _state_response(game)


@router.post("/new-game", response_model=PachisiStateResponse)
@limiter.limit("10/minute")
def restart(request: Request) -> PachisiStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    if game.phase != "game_over":
        raise HTTPException(status_code=400, detail="Game is not over yet.")
    _sessions[sid] = new_game()
    return _state_response(_sessions[sid])
