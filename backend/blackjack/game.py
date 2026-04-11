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
MAX_SPLITS = 3  # up to 4 hands total


@dataclass(frozen=True)
class BlackjackRules:
    hit_soft_17: bool = False
    deck_count: int = 6
    penetration: float = 0.75

    def __post_init__(self) -> None:
        if not 1 <= self.deck_count <= 8:
            raise ValueError("deck_count must be between 1 and 8.")
        if not 0.5 <= self.penetration <= 0.9:
            raise ValueError("penetration must be between 0.5 and 0.9.")


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


def is_soft_hand(cards: list[Card]) -> bool:
    """True when at least one Ace in the hand is counted as 11."""
    if not cards:
        return False
    raw_total = sum(RANK_VALUES[c.rank] for c in cards)
    num_aces = sum(1 for c in cards if c.rank == "A")
    if num_aces == 0:
        return False
    best = hand_value(cards)
    reductions = (raw_total - best) // 10
    return best <= 21 and num_aces > reductions


def _cards_can_split(cards: list[Card]) -> bool:
    """True iff the hand is exactly two cards with matching split rank.

    10-value cards (10, J, Q, K) all match each other.
    """
    if len(cards) != 2:
        return False
    a, b = cards[0].rank, cards[1].rank
    if a == b:
        return True
    return RANK_VALUES.get(a, 0) == 10 and RANK_VALUES.get(b, 0) == 10


def _fresh_shuffled_shoe(deck_count: int = 1) -> list[Card]:
    deck = [Card(suit=s, rank=r) for s in SUITS for r in RANKS] * deck_count
    random.shuffle(deck)
    return deck


@dataclass
class BlackjackGame:
    chips: int = 1000
    bet: int = 0
    phase: str = "betting"  # "betting" | "player" | "result"
    outcome: str | None = None  # "blackjack" | "win" | "lose" | "push"
    payout: int = 0  # net chip delta already applied to self.chips
    rules: BlackjackRules = field(default_factory=BlackjackRules)
    _deck: list[Card] = field(default_factory=list)
    _player_hand: list[Card] = field(default_factory=list)
    _dealer_hand: list[Card] = field(default_factory=list)
    _doubled: bool = False

    # Split state
    _player_hands: list[list[Card]] = field(default_factory=list)
    _hand_bets: list[int] = field(default_factory=list)
    _hand_outcomes: list[str | None] = field(default_factory=list)
    _hand_payouts: list[int] = field(default_factory=list)
    _active_hand: int = 0
    _split_count: int = 0
    _split_from_aces: list[bool] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self._deck:
            self._deck = _fresh_shuffled_shoe(self.rules.deck_count)

    @property
    def is_split(self) -> bool:
        return self._split_count > 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def place_bet(self, amount: int) -> None:
        if self.phase != "betting":
            raise ValueError("Not in betting phase.")
        if amount < 5 or amount > 500:
            raise ValueError("Bet must be between 5 and 500.")
        if amount > self.chips:
            raise ValueError("Insufficient chips.")

        self.bet = amount
        self._player_hand = []
        self._dealer_hand = []
        self._doubled = False
        self.outcome = None
        self.payout = 0
        self._player_hands = []
        self._hand_bets = []
        self._hand_outcomes = []
        self._hand_payouts = []
        self._active_hand = 0
        self._split_count = 0
        self._split_from_aces = []

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
        if self.is_split:
            hand = self._player_hands[self._active_hand]
            if self._split_from_aces[self._active_hand]:
                raise ValueError("Cannot hit on split aces.")
            hand.append(self._deal())
            if hand_value(hand) > 21:
                self._settle_hand(self._active_hand, "lose")
                self._advance_hand()
        else:
            self._player_hand.append(self._deal())
            if hand_value(self._player_hand) > 21:
                self._settle_with("lose")

    def stand(self) -> None:
        if self.phase != "player":
            raise ValueError("Not in player phase.")
        if self.is_split:
            self._advance_hand()
        else:
            self._dealer_play()
            self._determine_and_settle()

    def double_down(self) -> None:
        if self.phase != "player":
            raise ValueError("Not in player phase.")

        if self.is_split:
            hand = self._player_hands[self._active_hand]
            hand_bet = self._hand_bets[self._active_hand]
            if self._split_from_aces[self._active_hand]:
                raise ValueError("Cannot double down on split aces.")
            if len(hand) != 2:
                raise ValueError("Double down only allowed on initial two cards.")
            total_wagered = sum(self._hand_bets)
            free_stack = self.chips - total_wagered
            if free_stack < hand_bet:
                raise ValueError("Insufficient chips to double down.")
            self._hand_bets[self._active_hand] = hand_bet * 2
            hand.append(self._deal())
            if hand_value(hand) > 21:
                self._settle_hand(self._active_hand, "lose")
            self._advance_hand()
        else:
            if len(self._player_hand) != 2:
                raise ValueError("Double down only allowed on initial two cards.")
            if self.chips < self.bet * 2:
                raise ValueError("Insufficient chips to double down.")
            self.bet *= 2
            self._doubled = True
            self._player_hand.append(self._deal())
            if hand_value(self._player_hand) > 21:
                self._settle_with("lose")
                return
            self._dealer_play()
            self._determine_and_settle()

    def split(self) -> None:
        if self.phase != "player":
            raise ValueError("Not in player phase.")
        if self._split_count >= MAX_SPLITS:
            raise ValueError("Maximum number of splits reached.")

        if self.is_split:
            hand = self._player_hands[self._active_hand]
            hand_bet = self._hand_bets[self._active_hand]
        else:
            hand = self._player_hand
            hand_bet = self.bet

        if not _cards_can_split(hand):
            raise ValueError("Hand cannot be split.")

        # Check chips: need enough free stack for one more bet
        total_wagered = sum(self._hand_bets) if self.is_split else self.bet
        free_stack = self.chips - total_wagered
        if free_stack < hand_bet:
            raise ValueError("Insufficient chips to split.")

        is_ace_split = hand[0].rank == "A"

        if not self.is_split:
            # First split: migrate from single-hand to multi-hand mode
            card_a = hand[0]
            card_b = hand[1]
            self._player_hands = [[card_a], [card_b]]
            self._hand_bets = [hand_bet, hand_bet]
            self._hand_outcomes = [None, None]
            self._hand_payouts = [0, 0]
            self._active_hand = 0
            self._split_from_aces = [is_ace_split, is_ace_split]
        else:
            # Resplit: split the active hand
            card_a = hand[0]
            card_b = hand[1]
            idx = self._active_hand
            self._player_hands[idx] = [card_a]
            new_hand = [card_b]
            self._player_hands.insert(idx + 1, new_hand)
            self._hand_bets.insert(idx + 1, hand_bet)
            self._hand_outcomes.insert(idx + 1, None)
            self._hand_payouts.insert(idx + 1, 0)
            self._split_from_aces.insert(idx + 1, is_ace_split)
            self._split_from_aces[idx] = is_ace_split

        self._split_count += 1

        # Deal one card to each new hand
        self._player_hands[self._active_hand].append(self._deal())
        self._player_hands[self._active_hand + 1].append(self._deal())

        if is_ace_split:
            # Split aces: one card each, auto-stand both
            # Settle any busts (extremely unlikely but correct)
            for i in [self._active_hand, self._active_hand + 1]:
                if hand_value(self._player_hands[i]) > 21:
                    self._settle_hand(i, "lose")
            # Advance past both ace hands
            self._active_hand = self._active_hand + 2
            self._finish_if_all_hands_done()
        # If the new hand is a pair again, player can resplit on their turn

    def _reshuffle_threshold(self) -> int:
        total_cards = self.rules.deck_count * 52
        return max(RESHUFFLE_THRESHOLD, int(total_cards * (1 - self.rules.penetration)))

    def new_hand(self) -> None:
        if self.phase != "result":
            raise ValueError("Not in result phase.")
        self._player_hand = []
        self._dealer_hand = []
        self.bet = 0
        self.outcome = None
        self.payout = 0
        self._doubled = False
        self._player_hands = []
        self._hand_bets = []
        self._hand_outcomes = []
        self._hand_payouts = []
        self._active_hand = 0
        self._split_count = 0
        self._split_from_aces = []
        if len(self._deck) < self._reshuffle_threshold():
            self._deck = _fresh_shuffled_shoe(self.rules.deck_count)
        self.phase = "betting"

    # ------------------------------------------------------------------
    # Split availability check
    # ------------------------------------------------------------------

    def can_split(self) -> bool:
        if self.phase != "player":
            return False
        if self._split_count >= MAX_SPLITS:
            return False
        if self.is_split:
            hand = self._player_hands[self._active_hand]
            hand_bet = self._hand_bets[self._active_hand]
            total_wagered = sum(self._hand_bets)
        else:
            hand = self._player_hand
            hand_bet = self.bet
            total_wagered = self.bet
        if not _cards_can_split(hand):
            return False
        free_stack = self.chips - total_wagered
        return free_stack >= hand_bet

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _deal(self) -> Card:
        if not self._deck:
            self._deck = _fresh_shuffled_shoe(self.rules.deck_count)
        return self._deck.pop()

    def _dealer_play(self) -> None:
        while True:
            dv = hand_value(self._dealer_hand)
            if dv < 17:
                self._dealer_hand.append(self._deal())
            elif dv == 17 and self.rules.hit_soft_17 and is_soft_hand(self._dealer_hand):
                self._dealer_hand.append(self._deal())
            else:
                break

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

    # ------------------------------------------------------------------
    # Split-specific helpers
    # ------------------------------------------------------------------

    def _settle_hand(self, idx: int, outcome: str) -> None:
        """Settle a single split hand (does NOT change phase)."""
        bet = self._hand_bets[idx]
        if outcome == "win":
            delta = bet
        elif outcome == "push":
            delta = 0
        else:  # lose
            delta = -bet
        self._hand_outcomes[idx] = outcome
        self._hand_payouts[idx] = delta

    def _advance_hand(self) -> None:
        """Move to the next unsettled hand, or finish the round."""
        self._active_hand += 1
        self._finish_if_all_hands_done()

    def _finish_if_all_hands_done(self) -> None:
        """If all hands are played, run dealer and settle remaining hands."""
        if self._active_hand >= len(self._player_hands):
            # All hands played — check if any are still unsettled
            unsettled = [i for i, o in enumerate(self._hand_outcomes) if o is None]
            if unsettled:
                self._dealer_play()
                dv = hand_value(self._dealer_hand)
                dealer_bust = dv > 21
                for i in unsettled:
                    pv = hand_value(self._player_hands[i])
                    if dealer_bust or pv > dv:
                        self._settle_hand(i, "win")
                    elif pv == dv:
                        self._settle_hand(i, "push")
                    else:
                        self._settle_hand(i, "lose")

            # Apply total payout
            total_payout = sum(self._hand_payouts)
            self.payout = total_payout
            self.chips = max(0, self.chips + total_payout)
            # Overall outcome for display
            wins = sum(1 for o in self._hand_outcomes if o == "win")
            losses = sum(1 for o in self._hand_outcomes if o == "lose")
            if wins > 0 and losses == 0:
                self.outcome = "win"
            elif losses > 0 and wins == 0:
                self.outcome = "lose"
            elif wins == 0 and losses == 0:
                self.outcome = "push"
            else:
                # Mixed results — use net payout to determine
                if total_payout > 0:
                    self.outcome = "win"
                elif total_payout < 0:
                    self.outcome = "lose"
                else:
                    self.outcome = "push"
            self.phase = "result"
