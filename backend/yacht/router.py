"""Yacht game routes. Mounted by main.py with prefix=`/yacht`."""

from collections import OrderedDict

from fastapi import APIRouter, HTTPException, Request

from limiter import limiter
from session import get_session_id

from .game import YachtGame
from .models import GameStateResponse, PossibleScoresResponse, RollRequest, ScoreRequest

router = APIRouter()

_MAX_SESSIONS = 500
_sessions: OrderedDict[str, YachtGame | None] = OrderedDict()


def reset_game() -> None:
    """Test helper — clears all in-memory session state."""
    _sessions.clear()


def _evict_if_full() -> None:
    while len(_sessions) >= _MAX_SESSIONS:
        _sessions.popitem(last=False)


def _get_game(session_id: str) -> YachtGame:
    game = _sessions.get(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="No game in progress. POST /yacht/new first.")
    return game


def _state_response(game: YachtGame) -> GameStateResponse:
    return GameStateResponse(
        dice=game.dice,
        held=game.held,
        rolls_used=game.rolls_used,
        round=game.round,
        scores=game.scores,
        game_over=game.game_over,
        upper_subtotal=game.upper_subtotal(),
        upper_bonus=game.upper_bonus(),
        yacht_bonus_count=game.yacht_bonus_count,
        yacht_bonus_total=game.yacht_bonus_total(),
        total_score=game.total_score(),
    )


@router.post("/new", response_model=GameStateResponse)
@limiter.limit("10/minute")
def new_game(request: Request) -> GameStateResponse:
    sid = get_session_id(request)
    _evict_if_full()
    _sessions[sid] = YachtGame()
    return _state_response(_sessions[sid])


@router.get("/state", response_model=GameStateResponse)
@limiter.limit("60/minute")
def get_state(request: Request) -> GameStateResponse:
    sid = get_session_id(request)
    return _state_response(_get_game(sid))


@router.post("/roll", response_model=GameStateResponse)
@limiter.limit("30/minute")
def roll(request: Request, body: RollRequest) -> GameStateResponse:
    sid = get_session_id(request)
    game = _get_game(sid)
    if len(body.held) != 5:
        raise HTTPException(status_code=422, detail="'held' must have exactly 5 booleans.")
    try:
        game.roll(body.held)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/score", response_model=GameStateResponse)
@limiter.limit("20/minute")
def score(request: Request, body: ScoreRequest) -> GameStateResponse:
    sid = get_session_id(request)
    game = _get_game(sid)
    try:
        game.score(body.category)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.get("/possible-scores", response_model=PossibleScoresResponse)
@limiter.limit("60/minute")
def possible_scores(request: Request) -> PossibleScoresResponse:
    sid = get_session_id(request)
    game = _get_game(sid)
    if game.rolls_used == 0:
        return PossibleScoresResponse(possible_scores={})
    return PossibleScoresResponse(possible_scores=game.possible_scores())
