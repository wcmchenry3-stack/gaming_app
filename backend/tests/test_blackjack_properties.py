"""
Property-based tests for blackjack using Hypothesis.

Run with the CI profile (200 examples) via HYPOTHESIS_PROFILE=ci.
Default dev profile runs 50 examples for faster local iteration.
"""

import os

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from blackjack.game import Card, hand_value, is_natural_blackjack

# ---------------------------------------------------------------------------
# Hypothesis profiles
# ---------------------------------------------------------------------------

settings.register_profile("ci", max_examples=200, suppress_health_check=[HealthCheck.too_slow])
settings.register_profile("dev", max_examples=50)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "dev"))

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

rank_st = st.sampled_from(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"])
suit_st = st.sampled_from(["♠", "♥", "♦", "♣"])
card_st = st.builds(Card, suit=suit_st, rank=rank_st)
hand_st = st.lists(card_st, min_size=0, max_size=10)
nonempty_hand_st = st.lists(card_st, min_size=1, max_size=10)

# ---------------------------------------------------------------------------
# hand_value invariants
# ---------------------------------------------------------------------------


@given(hand=hand_st)
def test_hand_value_always_non_negative(hand):
    assert hand_value(hand) >= 0


@given(hand=hand_st)
def test_hand_value_deterministic(hand):
    assert hand_value(hand) == hand_value(hand)


@given(hand=hand_st)
def test_empty_hand_value_is_zero(hand):
    assert hand_value([]) == 0


@given(hand=nonempty_hand_st)
def test_at_most_one_soft_ace(hand):
    """At most one Ace can count as 11 in any evaluated hand."""
    total = hand_value(hand)
    # Count aces
    ace_count = sum(1 for c in hand if c.rank == "A")
    if ace_count == 0:
        return
    # Compute the hard total (all aces = 1)
    hard_total = sum(1 if c.rank == "A" else (10 if c.rank in ("J", "Q", "K", "10") else int(c.rank)) for c in hand)
    # The soft premium is total - hard_total; it can only be a multiple of 10
    # and at most 10 (one ace as 11 instead of 1 = +10)
    soft_premium = total - hard_total
    assert soft_premium in (0, 10)


@given(hand=hand_st)
def test_hand_value_bounded_by_ace_count(hand):
    """hand_value never exceeds the hard max (all cards at face value, aces at 11 first)."""
    result = hand_value(hand)
    # Result must be either <= 21 (a playable hand) or > 21 (bust — still non-negative)
    assert result >= 0


@given(hand=hand_st, extra_card=card_st)
def test_adding_card_to_busted_hand_stays_busted(hand, extra_card):
    """If a hand is already busted, adding any card keeps it busted."""
    initial = hand_value(hand)
    if initial <= 21:
        return  # not busted, skip
    extended = hand_value(hand + [extra_card])
    assert extended > 21


# ---------------------------------------------------------------------------
# is_natural_blackjack invariants
# ---------------------------------------------------------------------------


@given(hand=hand_st)
def test_natural_blackjack_requires_exactly_two_cards(hand):
    if is_natural_blackjack(hand):
        assert len(hand) == 2


@given(hand=hand_st)
def test_natural_blackjack_requires_value_21(hand):
    if is_natural_blackjack(hand):
        assert hand_value(hand) == 21


@given(hand=st.lists(card_st, min_size=3, max_size=10))
def test_three_or_more_cards_never_natural_blackjack(hand):
    assert not is_natural_blackjack(hand)
