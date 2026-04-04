from collections import OrderedDict

from fastapi import APIRouter, HTTPException, Request

from limiter import limiter
from session import get_session_id
from .game import Game2048
from .models import MoveRequest, Twenty48StateResponse

router = APIRouter()

_MAX_SESSIONS = 500
_sessions: OrderedDict[str, Game2048] = OrderedDict()


def reset_game() -> None:
    """Test helper — clears all in-memory session state."""
    _sessions.clear()


def _evict_if_full() -> None:
    while len(_sessions) >= _MAX_SESSIONS:
        _sessions.popitem(last=False)


def _require_game(session_id: str) -> Game2048:
    game = _sessions.get(session_id)
    if game is None:
        raise HTTPException(
            status_code=404,
            detail="No game in progress. POST /twenty48/new first.",
        )
    return game


def _state_response(game: Game2048) -> Twenty48StateResponse:
    return Twenty48StateResponse(
        board=game.board,
        score=game.score,
        game_over=game.game_over,
        has_won=game.has_won,
    )


@router.post("/new", response_model=Twenty48StateResponse)
@limiter.limit("10/minute")
def new_game(request: Request) -> Twenty48StateResponse:
    sid = get_session_id(request)
    _evict_if_full()
    _sessions[sid] = Game2048()
    return _state_response(_sessions[sid])


@router.get("/state", response_model=Twenty48StateResponse)
@limiter.limit("60/minute")
def get_state(request: Request) -> Twenty48StateResponse:
    sid = get_session_id(request)
    return _state_response(_require_game(sid))


@router.post("/move", response_model=Twenty48StateResponse)
@limiter.limit("30/minute")
def move(request: Request, body: MoveRequest) -> Twenty48StateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.move(body.direction)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)
