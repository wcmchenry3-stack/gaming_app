from pydantic import BaseModel, Field


class PlaceBetRequest(BaseModel):
    amount: int = Field(..., ge=10, le=500, multiple_of=10)


class CardResponse(BaseModel):
    rank: str
    suit: str
    face_down: bool = False


class HandResponse(BaseModel):
    cards: list[CardResponse]
    value: int  # 0 when the hand contains a face-down card


class BlackjackStateResponse(BaseModel):
    phase: str
    chips: int
    bet: int
    player_hand: HandResponse
    dealer_hand: HandResponse
    outcome: str | None
    payout: int
    game_over: bool
    double_down_available: bool
