from pydantic import BaseModel, Field


class PlaceBetRequest(BaseModel):
    amount: int = Field(..., ge=10, le=500, multiple_of=10)


class RulesRequest(BaseModel):
    hit_soft_17: bool = False
    deck_count: int = Field(default=6, ge=1, le=8)
    penetration: float = Field(default=0.75, ge=0.5, le=0.9)


class RulesResponse(BaseModel):
    hit_soft_17: bool
    deck_count: int
    penetration: float


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
    split_available: bool
    # Multi-hand split fields
    player_hands: list[HandResponse]
    hand_bets: list[int]
    active_hand_index: int
    hand_outcomes: list[str | None]
    hand_payouts: list[int]
    rules: RulesResponse
