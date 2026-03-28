from fastapi import APIRouter, HTTPException

from .game import BlackjackGame, hand_value
from .models import (
    BlackjackStateResponse,
    CardResponse,
    HandResponse,
    PlaceBetRequest,
)

router = APIRouter()

_game: BlackjackGame | None = None


def reset_game() -> None:
    """Test helper — clears in-memory game state."""
    global _game
    _game = None


def _hand_response(cards, conceal_hole: bool = False) -> HandResponse:
    """Build a HandResponse, optionally hiding the dealer's first card."""
    card_responses: list[CardResponse] = []
    for i, card in enumerate(cards):
        if conceal_hole and i == 0:
            card_responses.append(CardResponse(rank="?", suit="?", face_down=True))
        else:
            card_responses.append(CardResponse(rank=card.rank, suit=card.suit))

    # Value is 0 when hole card is concealed to prevent inference
    visible_cards = [c for c in cards[1:]] if conceal_hole else list(cards)
    value = 0 if conceal_hole else hand_value(list(cards))

    return HandResponse(cards=card_responses, value=value)


def _state_response(game: BlackjackGame) -> BlackjackStateResponse:
    concealing = game.phase == "player"
    dealer_hand = _hand_response(game._dealer_hand, conceal_hole=concealing)
    player_hand = _hand_response(game._player_hand)

    double_down_available = (
        game.phase == "player" and len(game._player_hand) == 2 and game.chips >= game.bet
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
    )


def _require_game() -> BlackjackGame:
    if _game is None:
        raise HTTPException(
            status_code=404,
            detail="No game in progress. POST /blackjack/new first.",
        )
    return _game


@router.post("/new", response_model=BlackjackStateResponse)
def new_game() -> BlackjackStateResponse:
    global _game
    _game = BlackjackGame()
    return _state_response(_game)


@router.get("/state", response_model=BlackjackStateResponse)
def get_state() -> BlackjackStateResponse:
    game = _require_game()
    return _state_response(game)


@router.post("/bet", response_model=BlackjackStateResponse)
def place_bet(request: PlaceBetRequest) -> BlackjackStateResponse:
    game = _require_game()
    try:
        game.place_bet(request.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/hit", response_model=BlackjackStateResponse)
def hit() -> BlackjackStateResponse:
    game = _require_game()
    try:
        game.hit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/stand", response_model=BlackjackStateResponse)
def stand() -> BlackjackStateResponse:
    game = _require_game()
    try:
        game.stand()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/double-down", response_model=BlackjackStateResponse)
def double_down() -> BlackjackStateResponse:
    game = _require_game()
    try:
        game.double_down()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@router.post("/new-hand", response_model=BlackjackStateResponse)
def new_hand() -> BlackjackStateResponse:
    game = _require_game()
    try:
        game.new_hand()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)
