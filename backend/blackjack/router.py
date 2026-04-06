from collections import OrderedDict

from fastapi import APIRouter, HTTPException, Request

from limiter import limiter
from session import get_session_id
from .game import BlackjackGame, hand_value
from .models import (
    BlackjackStateResponse,
    CardResponse,
    HandResponse,
    PlaceBetRequest,
)

router = APIRouter()

_MAX_SESSIONS = 500
_sessions: OrderedDict[str, BlackjackGame] = OrderedDict()


def reset_game() -> None:
    """Test helper — clears all in-memory session state."""
    _sessions.clear()


def _evict_if_full() -> None:
    while len(_sessions) >= _MAX_SESSIONS:
        _sessions.popitem(last=False)


def _require_game(session_id: str) -> BlackjackGame:
    game = _sessions.get(session_id)
    if game is None:
        raise HTTPException(
            status_code=404,
            detail="No game in progress. POST /blackjack/new first.",
        )
    return game


def _hand_response(cards, conceal_hole: bool = False) -> HandResponse:
    card_responses: list[CardResponse] = []
    for i, card in enumerate(cards):
        if conceal_hole and i == 0:
            card_responses.append(CardResponse(rank="?", suit="?", face_down=True))
        else:
            card_responses.append(CardResponse(rank=card.rank, suit=card.suit))
    value = 0 if conceal_hole else hand_value(list(cards))
    return HandResponse(cards=card_responses, value=value)


def _state_response(game: BlackjackGame) -> BlackjackStateResponse:
    concealing = game.phase == "player"
    dealer_hand = _hand_response(game._dealer_hand, conceal_hole=concealing)

    if game.is_split:
        player_hand = _hand_response(
            game._player_hands[min(game._active_hand, len(game._player_hands) - 1)]
        )
        player_hands = [_hand_response(h) for h in game._player_hands]
        hand_bets = list(game._hand_bets)
        active_hand_index = game._active_hand
        hand_outcomes = list(game._hand_outcomes)
        hand_payouts = list(game._hand_payouts)
    else:
        player_hand = _hand_response(game._player_hand)
        player_hands = [_hand_response(game._player_hand)] if game._player_hand else []
        hand_bets = [game.bet] if game.bet else []
        active_hand_index = 0
        hand_outcomes = [game.outcome] if game.outcome is not None else []
        hand_payouts = [game.payout] if game.payout != 0 else []

    double_down_available = False
    if game.phase == "player":
        if game.is_split:
            hand = game._player_hands[game._active_hand]
            hand_bet = game._hand_bets[game._active_hand]
            is_ace_hand = game._split_from_aces[game._active_hand]
            total_wagered = sum(game._hand_bets)
            free_stack = game.chips - total_wagered
            double_down_available = (
                len(hand) == 2
                and not is_ace_hand
                and free_stack >= hand_bet
            )
        else:
            double_down_available = (
                len(game._player_hand) == 2 and game.chips >= game.bet * 2
            )

    game_over = game.chips == 0 and game.phase == "result"

    return BlackjackStateResponse(
        phase=game.phase,
        chips=game.chips,
        bet=game.bet,
        player_hand=player_hand,
        dealer_hand=dealer_hand,
        outcome=game.outcome,
        payout=game.payout,
        game_over=game_over,
        double_down_available=double_down_available,
        split_available=game.can_split(),
        player_hands=player_hands,
        hand_bets=hand_bets,
        active_hand_index=active_hand_index,
        hand_outcomes=hand_outcomes,
        hand_payouts=hand_payouts,
    )


@router.post("/new", response_model=BlackjackStateResponse)
@limiter.limit("10/minute")
def new_game(request: Request) -> BlackjackStateResponse:
    sid = get_session_id(request)
    _evict_if_full()
    _sessions[sid] = BlackjackGame()
    return _state_response(_sessions[sid])


@router.get("/state", response_model=BlackjackStateResponse)
@limiter.limit("60/minute")
def get_state(request: Request) -> BlackjackStateResponse:
    sid = get_session_id(request)
    return _state_response(_require_game(sid))


@router.post("/bet", response_model=BlackjackStateResponse)
@limiter.limit("30/minute")
def place_bet(request: Request, body: PlaceBetRequest) -> BlackjackStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.place_bet(body.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/hit", response_model=BlackjackStateResponse)
@limiter.limit("30/minute")
def hit(request: Request) -> BlackjackStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.hit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/stand", response_model=BlackjackStateResponse)
@limiter.limit("30/minute")
def stand(request: Request) -> BlackjackStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.stand()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/double-down", response_model=BlackjackStateResponse)
@limiter.limit("30/minute")
def double_down(request: Request) -> BlackjackStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.double_down()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/split", response_model=BlackjackStateResponse)
@limiter.limit("30/minute")
def split(request: Request) -> BlackjackStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.split()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/new-hand", response_model=BlackjackStateResponse)
@limiter.limit("30/minute")
def new_hand(request: Request) -> BlackjackStateResponse:
    sid = get_session_id(request)
    game = _require_game(sid)
    try:
        game.new_hand()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)
