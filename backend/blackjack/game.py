import math
import random
from dataclasses import dataclass, field

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

RANK_VALUES: dict[str, int] = {
    "A": 11,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    "J": 10,
    "Q": 10,
    "K": 10,
}

RESHUFFLE_THRESHOLD = 15


@dataclass
class Card:
    suit: str
    rank: str


def hand_value(cards: list[Card]) -> int:
    """Return the best blackjack value for a hand.

    Aces start as 11; each is demoted to 1 while the total exceeds 21.
    Returns 0 for an empty hand.
    """
    if not cards:
        return 0
    total = 0
    aces = 0
    for card in cards:
        v = RANK_VALUES[card.rank]
        total += v
        if card.rank == "A":
            aces += 1
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
    return total


def is_natural_blackjack(cards: list[Card]) -> bool:
    """True iff the hand is exactly two cards totalling 21."""
    return len(cards) == 2 and hand_value(cards) == 21


def _fresh_shuffled_deck() -> list[Card]:
    deck = [Card(suit=s, rank=r) for s in SUITS for r in RANKS]
    random.shuffle(deck)
    return deck


@dataclass
class BlackjackGame:
    chips: int = 1000
    bet: int = 0
    phase: str = "betting"  # "betting" | "player" | "result"
    outcome: str | None = None  # "blackjack" | "win" | "lose" | "push"
    payout: int = 0  # net chip delta already applied to self.chips
    _deck: list[Card] = field(default_factory=_fresh_shuffled_deck)
    _player_hand: list[Card] = field(default_factory=list)
    _dealer_hand: list[Card] = field(default_factory=list)
    _doubled: bool = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def place_bet(self, amount: int) -> None:
        if self.phase != "betting":
            raise ValueError("Not in betting phase.")
        if amount < 10 or amount > 500 or amount % 10 != 0:
            raise ValueError("Bet must be between 10 and 500 in multiples of 10.")
        if amount > self.chips:
            raise ValueError("Insufficient chips.")

        self.bet = amount
        self._player_hand = []
        self._dealer_hand = []
        self._doubled = False
        self.outcome = None
        self.payout = 0

        # Deal: player, dealer, player, dealer
        for _ in range(2):
            self._player_hand.append(self._deal())
            self._dealer_hand.append(self._deal())

        # Check for natural blackjack immediately
        if is_natural_blackjack(self._player_hand):
            dealer_bj = is_natural_blackjack(self._dealer_hand)
            if dealer_bj:
                self._settle_with("push")
            else:
                self._settle_with("blackjack")
            return

        self.phase = "player"

    def hit(self) -> None:
        if self.phase != "player":
            raise ValueError("Not in player phase.")
        self._player_hand.append(self._deal())
        if hand_value(self._player_hand) > 21:
            self._settle_with("lose")

    def stand(self) -> None:
        if self.phase != "player":
            raise ValueError("Not in player phase.")
        self._dealer_play()
        self._determine_and_settle()

    def double_down(self) -> None:
        if self.phase != "player":
            raise ValueError("Not in player phase.")
        if len(self._player_hand) != 2:
            raise ValueError("Double down only allowed on initial two cards.")
        if self.chips < self.bet:
            raise ValueError("Insufficient chips to double down.")

        self.chips -= self.bet  # deduct extra bet now
        self.bet *= 2
        self._doubled = True

        self._player_hand.append(self._deal())
        if hand_value(self._player_hand) > 21:
            self._settle_with("lose")
            return
        self._dealer_play()
        self._determine_and_settle()

    def new_hand(self) -> None:
        if self.phase != "result":
            raise ValueError("Not in result phase.")
        self._player_hand = []
        self._dealer_hand = []
        self.bet = 0
        self.outcome = None
        self.payout = 0
        self._doubled = False
        if len(self._deck) < RESHUFFLE_THRESHOLD:
            self._deck = _fresh_shuffled_deck()
        self.phase = "betting"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _deal(self) -> Card:
        if not self._deck:
            self._deck = _fresh_shuffled_deck()
        return self._deck.pop()

    def _dealer_play(self) -> None:
        while hand_value(self._dealer_hand) <= 16:
            self._dealer_hand.append(self._deal())

    def _determine_and_settle(self) -> None:
        pv = hand_value(self._player_hand)
        dv = hand_value(self._dealer_hand)
        dealer_bust = dv > 21
        if dealer_bust or pv > dv:
            self._settle_with("win")
        elif pv == dv:
            self._settle_with("push")
        else:
            self._settle_with("lose")

    def _settle_with(self, outcome: str) -> None:
        self.outcome = outcome
        if outcome == "blackjack":
            delta = math.ceil(self.bet * 1.5)
        elif outcome == "win":
            delta = self.bet
        elif outcome == "push":
            delta = 0
        else:  # lose
            delta = -self.bet

        self.payout = delta
        self.chips = max(0, self.chips + delta)
        self.phase = "result"
