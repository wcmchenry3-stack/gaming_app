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
        assert not is_natural_blackjack([Card("♠", "7"), Card("♥", "7"), Card("♦", "7")])

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
        # chips=150, bet=100 → free stack is chips-bet=50, not enough to double.
        # Real requirement is chips >= 2*bet (200 here).
        g = _in_player_phase(chips=150, bet=100)
        with pytest.raises(ValueError, match="Insufficient chips"):
            g.double_down()

    def test_double_down_accepts_exact_2x_bet(self):
        # chips=200, bet=100 → chips == 2*bet, boundary allowed.
        g = _in_player_phase(chips=200, bet=100)
        g.double_down()  # should not raise
        assert g.bet == 200

    def test_double_down_doubles_the_bet(self):
        g = _in_player_phase(chips=500, bet=100)
        g.double_down()
        assert g.bet == 200

    def test_double_down_reaches_result(self):
        g = _in_player_phase(chips=500, bet=100)
        g.double_down()
        assert g.phase == "result"

    def test_double_down_applies_2x_payout(self):
        # Under the "chips includes wagered" accounting, DD doubles the bet
        # and the settlement delta doubles with it. Start 300 / bet 100:
        #   win:  300 + 200 = 500  (net +200)
        #   lose: 300 - 200 = 100  (net -200)
        #   push: 300 + 0   = 300  (net 0)
        g = _in_player_phase(chips=300, bet=100)
        g.double_down()
        assert g.bet == 200
        if g.outcome == "win":
            assert g.chips == 500
        elif g.outcome == "lose":
            assert g.chips == 100
        elif g.outcome == "push":
            assert g.chips == 300
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


# ---------------------------------------------------------------------------
# Double down — deterministic scenarios (rigged decks)
#
# _deal() pops from the end of _deck, so the LAST element is drawn first.
# For DD tests the dealer is stacked onto the deck AFTER the DD card:
#     deck = [..., dealer_hit_2, dealer_hit_1, DD_card]
#                                                ^ popped first
# ---------------------------------------------------------------------------


def _dd_setup(chips: int, bet: int, player, dealer, deck) -> BlackjackGame:
    """Build a player-phase game with exact hands and deck contents."""
    g = BlackjackGame(chips=chips)
    g.bet = bet
    g._player_hand = list(player)
    g._dealer_hand = list(dealer)
    g._deck = list(deck)
    g.phase = "player"
    return g


class TestDoubleDownDeterministic:
    """DD with rigged decks so outcomes are fixed, not random."""

    def test_dd_win_pays_net_plus_2x_bet(self):
        # Player 10+5=15; DD card 6 → 21. Dealer 6+8=14, hits a 10 → 24 bust.
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "6"), Card("♣", "8")],
            deck=[Card("♠", "10"), Card("♠", "6")],  # dealer hit, then DD card
        )
        g.double_down()
        assert g.outcome == "win"
        assert g.bet == 200
        assert g.chips == 500 + 200  # net +2*bet

    def test_dd_loss_debits_net_minus_2x_bet(self):
        # Player 10+5=15; DD card 2 → 17. Dealer 9+9=18, stands. Player loses.
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "2")],
        )
        g.double_down()
        assert g.outcome == "lose"
        assert g.chips == 500 - 200  # net -2*bet

    def test_dd_push_returns_zero_delta(self):
        # Player 10+5=15; DD card 3 → 18. Dealer 9+9=18, stands. Push.
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "3")],
        )
        g.double_down()
        assert g.outcome == "push"
        assert g.chips == 500  # net 0

    def test_dd_to_21_is_even_money_not_blackjack(self):
        # 6+5=11, DD card K → 21. Not a natural BJ (that needs exactly 2 initial
        # cards). Should pay even money on the doubled bet, i.e. +2*bet — NOT
        # the 3:2 blackjack payout (which would be ceil(1.5*200)=300).
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "6"), Card("♥", "5")],
            dealer=[Card("♦", "10"), Card("♣", "8")],  # 18, stands
            deck=[Card("♠", "K")],
        )
        g.double_down()
        assert g.outcome == "win"
        assert g.chips == 500 + 200  # +2*bet, not +1.5*2*bet=300

    def test_dd_bust_settles_immediately_dealer_untouched(self):
        # Player 10+10=20, DD card 5 → 25 bust. Dealer must NOT draw.
        dealer_initial = [Card("♦", "6"), Card("♣", "7")]
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "K"), Card("♥", "Q")],
            dealer=dealer_initial,
            deck=[Card("♠", "2"), Card("♠", "5")],  # 2 is "would-be dealer hit"
        )
        g.double_down()
        assert g.outcome == "lose"
        assert g.chips == 500 - 200
        # Dealer hand should be untouched (2 cards, same ranks).
        assert len(g._dealer_hand) == 2
        assert [(c.rank, c.suit) for c in g._dealer_hand] == [
            (c.rank, c.suit) for c in dealer_initial
        ]
        # The would-be dealer hit card should still be in the deck.
        assert any(c.rank == "2" for c in g._deck)

    def test_dd_sufficiency_exact_2x_boundary_allowed(self):
        g = _dd_setup(
            chips=200,
            bet=100,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "3")],  # → 18 push
        )
        g.double_down()
        assert g.bet == 200
        # push: chips unchanged at 200
        assert g.chips == 200

    def test_dd_sufficiency_below_2x_rejected(self):
        # chips = 2*bet - 10 (190) → not enough free stack
        g = _dd_setup(
            chips=190,
            bet=100,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "2")],
        )
        with pytest.raises(ValueError, match="Insufficient chips"):
            g.double_down()

    def test_dd_exact_2x_loss_reaches_zero_and_game_over(self):
        # chips == 2*bet, DD loss → chips 0, phase result (game_over by view).
        g = _dd_setup(
            chips=200,
            bet=100,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "2")],  # → 17, dealer 18, lose
        )
        g.double_down()
        assert g.outcome == "lose"
        assert g.chips == 0
        assert g.phase == "result"

    def test_dd_refused_after_third_card(self):
        # Same wording as existing "requires two cards" test but spelled out
        # for completeness: once the player hits, DD is off the table.
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "5"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "8")],
            deck=[Card("♠", "3")],
        )
        g.hit()  # player hand now 3 cards: 5+5+3=13
        with pytest.raises(ValueError, match="initial two cards"):
            g.double_down()

    def test_dd_with_soft_17_ace_counts_as_one_on_bust(self):
        # Player A+6 = 17 soft. DD card K → A+6+K: 11+6+10=27>21, ace demotes
        # to 1+6+10=17. No bust; still valid. Dealer 9+9=18, stands. Lose.
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "A"), Card("♥", "6")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "K")],
        )
        g.double_down()
        assert g.outcome == "lose"
        assert hand_value(g._player_hand) == 17
        assert g.chips == 500 - 200

    def test_dd_with_soft_18_can_stay_21_with_3(self):
        # Player A+7 = 18 soft. DD card 3 → A+7+3: 11+7+3=21 (ace stays 11).
        # Dealer 10+8=18 stands. Player wins.
        g = _dd_setup(
            chips=500,
            bet=100,
            player=[Card("♠", "A"), Card("♥", "7")],
            dealer=[Card("♦", "10"), Card("♣", "8")],
            deck=[Card("♠", "3")],
        )
        g.double_down()
        assert hand_value(g._player_hand) == 21
        assert g.outcome == "win"
        assert g.chips == 500 + 200


@pytest.mark.parametrize(
    "chips,bet",
    [
        (200, 100),  # exact DD boundary
        (1000, 500),  # max bet, exact DD boundary
        (20, 10),  # min bet, exact DD boundary
    ],
)
class TestDoubleDownParamBoundary:
    """Exact 2*bet boundary across a spread of (chips, bet) pairs."""

    def test_dd_at_boundary_allowed_push_leaves_chips_intact(self, chips, bet):
        g = _dd_setup(
            chips=chips,
            bet=bet,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "3")],  # → 18 push against dealer 18
        )
        g.double_down()
        assert g.outcome == "push"
        assert g.chips == chips

    def test_dd_at_boundary_loss_reaches_zero(self, chips, bet):
        g = _dd_setup(
            chips=chips,
            bet=bet,
            player=[Card("♠", "10"), Card("♥", "5")],
            dealer=[Card("♦", "9"), Card("♣", "9")],
            deck=[Card("♠", "2")],  # → 17 vs dealer 18 → lose
        )
        g.double_down()
        assert g.outcome == "lose"
        assert g.chips == 0
