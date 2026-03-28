"""
Unit tests for blackjack game logic.

Tests hand_value(), is_natural_blackjack(), and BlackjackGame state transitions
directly without HTTP overhead.
"""

import math

import pytest

from blackjack.game import (
    BlackjackGame,
    Card,
    _fresh_shuffled_deck,
    hand_value,
    is_natural_blackjack,
)

# ---------------------------------------------------------------------------
# hand_value
# ---------------------------------------------------------------------------


class TestHandValue:
    def test_empty_hand_returns_zero(self):
        assert hand_value([]) == 0

    def test_numbered_cards(self):
        assert hand_value([Card("♠", "5"), Card("♥", "7")]) == 12

    def test_face_cards_worth_ten(self):
        for rank in ("J", "Q", "K"):
            assert hand_value([Card("♠", rank)]) == 10

    def test_ten_worth_ten(self):
        assert hand_value([Card("♠", "10")]) == 10

    def test_ace_as_eleven_when_safe(self):
        assert hand_value([Card("♠", "A"), Card("♥", "7")]) == 18

    def test_ace_demotes_on_bust(self):
        # A + K + 5 → 1 + 10 + 5 = 16
        assert hand_value([Card("♠", "A"), Card("♥", "K"), Card("♦", "5")]) == 16

    def test_two_aces(self):
        # 11 + 1 = 12
        assert hand_value([Card("♠", "A"), Card("♥", "A")]) == 12

    def test_three_aces(self):
        # 11 + 1 + 1 = 13
        assert hand_value([Card("♠", "A"), Card("♥", "A"), Card("♦", "A")]) == 13

    def test_ace_with_ten_value(self):
        assert hand_value([Card("♠", "A"), Card("♥", "J")]) == 21

    def test_bust_exceeds_21(self):
        assert hand_value([Card("♠", "K"), Card("♥", "Q"), Card("♦", "5")]) == 25

    def test_exactly_21_three_cards(self):
        assert hand_value([Card("♠", "7"), Card("♥", "7"), Card("♦", "7")]) == 21


# ---------------------------------------------------------------------------
# is_natural_blackjack
# ---------------------------------------------------------------------------


class TestIsNaturalBlackjack:
    def test_ace_plus_king(self):
        assert is_natural_blackjack([Card("♠", "A"), Card("♥", "K")])

    def test_ace_plus_ten(self):
        assert is_natural_blackjack([Card("♠", "A"), Card("♥", "10")])

    def test_reversed_order(self):
        assert is_natural_blackjack([Card("♥", "K"), Card("♠", "A")])

    def test_21_three_cards_not_blackjack(self):
        assert not is_natural_blackjack(
            [Card("♠", "7"), Card("♥", "7"), Card("♦", "7")]
        )

    def test_two_cards_not_21(self):
        assert not is_natural_blackjack([Card("♠", "9"), Card("♥", "8")])


# ---------------------------------------------------------------------------
# Fresh deck
# ---------------------------------------------------------------------------


class TestFreshDeck:
    def test_deck_has_52_cards(self):
        assert len(_fresh_shuffled_deck()) == 52

    def test_all_suits_and_ranks_present(self):
        deck = _fresh_shuffled_deck()
        suits = {c.suit for c in deck}
        ranks = {c.rank for c in deck}
        assert suits == {"♠", "♥", "♦", "♣"}
        assert "A" in ranks and "K" in ranks and "10" in ranks


# ---------------------------------------------------------------------------
# Helpers: drive the game into specific states
# ---------------------------------------------------------------------------


def _in_player_phase(chips=1000, bet=100) -> BlackjackGame:
    """Return a game forced into player phase with a known non-blackjack hand."""
    g = BlackjackGame(chips=chips)
    g.bet = bet
    g._player_hand = [Card("♠", "7"), Card("♥", "8")]  # 15 — safe, no BJ
    g._dealer_hand = [Card("♦", "6"), Card("♣", "9")]  # 15
    g.phase = "player"
    return g


def _in_result_phase(chips=1000, bet=100, outcome="push", payout=0) -> BlackjackGame:
    g = BlackjackGame(chips=chips)
    g.bet = bet
    g._player_hand = [Card("♠", "7"), Card("♥", "8")]
    g._dealer_hand = [Card("♦", "6"), Card("♣", "9")]
    g.phase = "result"
    g.outcome = outcome
    g.payout = payout
    return g


# ---------------------------------------------------------------------------
# Phase transitions
# ---------------------------------------------------------------------------


class TestPhaseMachine:
    def test_starts_in_betting_phase(self):
        assert BlackjackGame().phase == "betting"

    def test_place_bet_transitions_to_player_or_result(self):
        g = BlackjackGame()
        g.place_bet(100)
        assert g.phase in ("player", "result")

    def test_hit_wrong_phase_raises(self):
        g = BlackjackGame()
        with pytest.raises(ValueError, match="Not in player phase"):
            g.hit()

    def test_stand_wrong_phase_raises(self):
        g = BlackjackGame()
        with pytest.raises(ValueError, match="Not in player phase"):
            g.stand()

    def test_double_down_wrong_phase_raises(self):
        g = BlackjackGame()
        with pytest.raises(ValueError, match="Not in player phase"):
            g.double_down()

    def test_new_hand_wrong_phase_raises(self):
        g = BlackjackGame()
        with pytest.raises(ValueError, match="Not in result phase"):
            g.new_hand()

    def test_place_bet_wrong_phase_raises(self):
        g = _in_player_phase()
        with pytest.raises(ValueError, match="Not in betting phase"):
            g.place_bet(100)

    def test_stand_reaches_result(self):
        g = _in_player_phase()
        g.stand()
        assert g.phase == "result"

    def test_result_to_betting_via_new_hand(self):
        g = _in_result_phase()
        g.new_hand()
        assert g.phase == "betting"

    def test_new_hand_resets_bet_and_outcome(self):
        g = _in_result_phase(bet=200, outcome="win", payout=200)
        g.new_hand()
        assert g.bet == 0
        assert g.outcome is None
        assert g.payout == 0


# ---------------------------------------------------------------------------
# Bet validation
# ---------------------------------------------------------------------------


class TestBetValidation:
    def test_bet_below_minimum_raises(self):
        with pytest.raises(ValueError):
            BlackjackGame().place_bet(5)

    def test_bet_above_maximum_raises(self):
        with pytest.raises(ValueError):
            BlackjackGame().place_bet(510)

    def test_bet_not_multiple_of_10_raises(self):
        with pytest.raises(ValueError):
            BlackjackGame().place_bet(15)

    def test_bet_exceeds_chips_raises(self):
        with pytest.raises(ValueError, match="Insufficient chips"):
            BlackjackGame(chips=50).place_bet(100)

    def test_exact_chips_bet_accepted(self):
        g = BlackjackGame(chips=100)
        g.place_bet(100)
        assert g.phase in ("player", "result")


# ---------------------------------------------------------------------------
# Payout arithmetic
# ---------------------------------------------------------------------------


class TestPayout:
    def test_blackjack_payout_is_ceil_one_and_half(self):
        g = BlackjackGame(chips=1000)
        g.bet = 10
        g._settle_with("blackjack")
        assert g.payout == math.ceil(10 * 1.5)  # 15
        assert g.chips == 1015

    def test_blackjack_payout_odd_bet_ceiled(self):
        # bet=30 → ceil(45.0) = 45; bet=20 → ceil(30) = 30
        g = BlackjackGame(chips=1000)
        g.bet = 30
        g._settle_with("blackjack")
        assert g.payout == 45

    def test_win_payout_equals_bet(self):
        g = BlackjackGame(chips=1000)
        g.bet = 100
        g._settle_with("win")
        assert g.payout == 100
        assert g.chips == 1100

    def test_push_payout_zero(self):
        g = BlackjackGame(chips=1000)
        g.bet = 100
        g._settle_with("push")
        assert g.payout == 0
        assert g.chips == 1000

    def test_lose_payout_negative(self):
        g = BlackjackGame(chips=1000)
        g.bet = 100
        g._settle_with("lose")
        assert g.payout == -100
        assert g.chips == 900

    def test_chips_floor_at_zero(self):
        g = BlackjackGame(chips=50)
        g.bet = 50
        g._settle_with("lose")
        assert g.chips == 0

    def test_chips_never_negative(self):
        g = BlackjackGame(chips=100)
        g.bet = 200  # would go negative
        g._settle_with("lose")
        assert g.chips >= 0


# ---------------------------------------------------------------------------
# Double down
# ---------------------------------------------------------------------------


class TestDoubleDown:
    def test_double_down_requires_two_cards(self):
        g = _in_player_phase()
        g._player_hand.append(Card("♠", "2"))  # 3 cards now
        with pytest.raises(ValueError, match="initial two cards"):
            g.double_down()

    def test_double_down_requires_sufficient_chips(self):
        g = _in_player_phase(chips=150, bet=100)
        g.chips = 50  # not enough to cover bet again
        with pytest.raises(ValueError, match="Insufficient chips"):
            g.double_down()

    def test_double_down_doubles_the_bet(self):
        g = _in_player_phase(chips=500, bet=100)
        g.double_down()
        assert g.bet == 200

    def test_double_down_reaches_result(self):
        g = _in_player_phase(chips=500, bet=100)
        g.double_down()
        assert g.phase == "result"

    def test_double_down_deducts_extra_chips_before_settle(self):
        g = _in_player_phase(chips=300, bet=100)
        g.double_down()
        # chips = 300 - 100 (extra) ± payout
        if g.outcome == "win":
            assert g.chips == 300 - 100 + 200  # net +100
        elif g.outcome == "lose":
            assert g.chips == 300 - 100 - 200  # net -200 → 0 (floor)
        # push: 300 - 100 + 0 = 200
        assert g.chips >= 0


# ---------------------------------------------------------------------------
# Bust
# ---------------------------------------------------------------------------


class TestBust:
    def test_player_bust_settles_as_lose(self):
        g = _in_player_phase()
        # Override deck to guarantee a bust card
        g._deck = [Card("♠", "10")] * 52
        g._player_hand = [Card("♠", "K"), Card("♥", "Q")]  # 20
        g.hit()  # draws 10 → 30, bust
        assert g.phase == "result"
        assert g.outcome == "lose"


# ---------------------------------------------------------------------------
# Deck reshuffle
# ---------------------------------------------------------------------------


class TestDeckReshuffle:
    def test_reshuffle_triggered_when_below_threshold(self):
        g = _in_result_phase()
        g._deck = g._deck[:5]  # drain below threshold
        g.new_hand()
        # After dealing 4 cards the deck should still be large
        assert len(g._deck) > 40
