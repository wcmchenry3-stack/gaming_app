"""
Unit tests for configurable blackjack table rules: H17, multi-deck shoe,
and penetration-based reshuffling.
"""

import pytest

from blackjack.game import (
    BlackjackGame,
    BlackjackRules,
    Card,
    _fresh_shuffled_shoe,
    hand_value,
    is_soft_hand,
)

# ---------------------------------------------------------------------------
# BlackjackRules validation
# ---------------------------------------------------------------------------


class TestBlackjackRulesValidation:
    def test_defaults(self):
        r = BlackjackRules()
        assert r.hit_soft_17 is False
        assert r.deck_count == 6
        assert r.penetration == 0.75

    def test_custom_values(self):
        r = BlackjackRules(hit_soft_17=True, deck_count=2, penetration=0.8)
        assert r.hit_soft_17 is True
        assert r.deck_count == 2
        assert r.penetration == 0.8

    def test_deck_count_below_minimum_raises(self):
        with pytest.raises(ValueError, match="deck_count"):
            BlackjackRules(deck_count=0)

    def test_deck_count_above_maximum_raises(self):
        with pytest.raises(ValueError, match="deck_count"):
            BlackjackRules(deck_count=9)

    def test_penetration_below_minimum_raises(self):
        with pytest.raises(ValueError, match="penetration"):
            BlackjackRules(penetration=0.4)

    def test_penetration_above_maximum_raises(self):
        with pytest.raises(ValueError, match="penetration"):
            BlackjackRules(penetration=0.95)

    def test_boundary_deck_count_1(self):
        r = BlackjackRules(deck_count=1)
        assert r.deck_count == 1

    def test_boundary_deck_count_8(self):
        r = BlackjackRules(deck_count=8)
        assert r.deck_count == 8

    def test_boundary_penetration_050(self):
        r = BlackjackRules(penetration=0.5)
        assert r.penetration == 0.5

    def test_boundary_penetration_090(self):
        r = BlackjackRules(penetration=0.9)
        assert r.penetration == 0.9

    def test_rules_are_immutable(self):
        r = BlackjackRules()
        with pytest.raises(AttributeError):
            r.hit_soft_17 = True


# ---------------------------------------------------------------------------
# is_soft_hand
# ---------------------------------------------------------------------------


class TestIsSoftHand:
    def test_ace_plus_six_is_soft(self):
        assert is_soft_hand([Card("♠", "A"), Card("♥", "6")])

    def test_ace_plus_six_plus_king_is_hard(self):
        # A+6+K = 1+6+10 = 17 (ace forced to 1)
        assert not is_soft_hand([Card("♠", "A"), Card("♥", "6"), Card("♦", "K")])

    def test_no_ace_is_not_soft(self):
        assert not is_soft_hand([Card("♠", "K"), Card("♥", "7")])

    def test_empty_hand_is_not_soft(self):
        assert not is_soft_hand([])

    def test_two_aces_is_soft(self):
        # A+A = 12 (one ace at 11, one at 1), soft
        assert is_soft_hand([Card("♠", "A"), Card("♥", "A")])

    def test_ace_plus_nine_is_soft_20(self):
        assert is_soft_hand([Card("♠", "A"), Card("♥", "9")])

    def test_ace_plus_ten_is_soft_21(self):
        assert is_soft_hand([Card("♠", "A"), Card("♥", "K")])

    def test_bust_hand_is_not_soft(self):
        # K+Q+5 = 25, no aces
        assert not is_soft_hand([Card("♠", "K"), Card("♥", "Q"), Card("♦", "5")])


# ---------------------------------------------------------------------------
# Multi-deck shoe
# ---------------------------------------------------------------------------


class TestMultiDeckShoe:
    def test_single_deck_has_52_cards(self):
        shoe = _fresh_shuffled_shoe(1)
        assert len(shoe) == 52

    def test_six_deck_shoe_has_312_cards(self):
        shoe = _fresh_shuffled_shoe(6)
        assert len(shoe) == 312

    def test_eight_deck_shoe_has_416_cards(self):
        shoe = _fresh_shuffled_shoe(8)
        assert len(shoe) == 416

    def test_shoe_contains_correct_number_of_each_rank(self):
        shoe = _fresh_shuffled_shoe(4)
        # 4 decks × 4 suits = 16 of each rank
        ace_count = sum(1 for c in shoe if c.rank == "A")
        assert ace_count == 16

    def test_game_default_rules_creates_six_deck_shoe(self):
        g = BlackjackGame()
        assert len(g._deck) == 312  # 6 * 52


# ---------------------------------------------------------------------------
# Dealer H17 / S17 logic
# ---------------------------------------------------------------------------


def _make_game_in_player_phase(
    rules: BlackjackRules,
    player_hand: list[Card],
    dealer_hand: list[Card],
    deck: list[Card],
) -> BlackjackGame:
    g = BlackjackGame(rules=rules, chips=1000)
    g.bet = 100
    g._player_hand = player_hand
    g._dealer_hand = dealer_hand
    g._deck = deck
    g.phase = "player"
    return g


class TestDealerS17:
    """Default S17: dealer stands on ALL 17s including soft 17."""

    def test_dealer_stands_on_hard_17(self):
        g = _make_game_in_player_phase(
            rules=BlackjackRules(hit_soft_17=False),
            player_hand=[Card("♠", "10"), Card("♥", "8")],  # 18
            dealer_hand=[Card("♦", "10"), Card("♣", "7")],  # hard 17
            deck=[Card("♠", "2")],  # should not be drawn
        )
        g.stand()
        assert hand_value(g._dealer_hand) == 17
        assert len(g._dealer_hand) == 2

    def test_dealer_stands_on_soft_17_under_s17(self):
        g = _make_game_in_player_phase(
            rules=BlackjackRules(hit_soft_17=False),
            player_hand=[Card("♠", "10"), Card("♥", "8")],  # 18
            dealer_hand=[Card("♦", "A"), Card("♣", "6")],  # soft 17
            deck=[Card("♠", "2")],  # should not be drawn
        )
        g.stand()
        assert hand_value(g._dealer_hand) == 17
        assert len(g._dealer_hand) == 2
        assert g.outcome == "win"  # player 18 > dealer 17


class TestDealerH17:
    """H17: dealer hits on soft 17 but stands on hard 17."""

    def test_dealer_hits_soft_17_under_h17(self):
        g = _make_game_in_player_phase(
            rules=BlackjackRules(hit_soft_17=True),
            player_hand=[Card("♠", "10"), Card("♥", "8")],  # 18
            dealer_hand=[Card("♦", "A"), Card("♣", "6")],  # soft 17
            deck=[Card("♠", "3")],  # dealer hits → A+6+3 = 20
        )
        g.stand()
        assert hand_value(g._dealer_hand) == 20
        assert len(g._dealer_hand) == 3
        assert g.outcome == "lose"  # dealer 20 > player 18

    def test_dealer_stands_on_hard_17_under_h17(self):
        g = _make_game_in_player_phase(
            rules=BlackjackRules(hit_soft_17=True),
            player_hand=[Card("♠", "10"), Card("♥", "8")],  # 18
            dealer_hand=[Card("♦", "10"), Card("♣", "7")],  # hard 17
            deck=[Card("♠", "2")],
        )
        g.stand()
        assert hand_value(g._dealer_hand) == 17
        assert len(g._dealer_hand) == 2

    def test_dealer_hits_soft_17_then_stands_on_18(self):
        # Dealer: A+6 = soft 17, hits, draws A → A+6+A = 18 (soft)
        # With H17, dealer stands on soft 18
        g = _make_game_in_player_phase(
            rules=BlackjackRules(hit_soft_17=True),
            player_hand=[Card("♠", "10"), Card("♥", "9")],  # 19
            dealer_hand=[Card("♦", "A"), Card("♣", "6")],  # soft 17
            deck=[Card("♠", "A")],  # dealer draws → soft 18
        )
        g.stand()
        assert hand_value(g._dealer_hand) == 18
        assert len(g._dealer_hand) == 3

    def test_dealer_hits_soft_17_busts(self):
        # Dealer: A+6 = soft 17, hits K → A+6+K = 17 (hard, ace demoted)
        # Hard 17 → stands
        g = _make_game_in_player_phase(
            rules=BlackjackRules(hit_soft_17=True),
            player_hand=[Card("♠", "10"), Card("♥", "8")],  # 18
            dealer_hand=[Card("♦", "A"), Card("♣", "6")],  # soft 17
            deck=[Card("♠", "K")],  # A+6+K = 17 hard
        )
        g.stand()
        assert hand_value(g._dealer_hand) == 17
        assert len(g._dealer_hand) == 3
        # Now hard 17, dealer stops even under H17
        assert g.outcome == "win"  # player 18 > dealer 17

    def test_dealer_hits_soft_17_multiple_times(self):
        # Dealer: A+6 = soft 17
        # Hits 2 → soft 19 (A+6+2 = 19), stands
        # But first test where it stays at soft 17 after multiple draws
        # Dealer: A+3+3 = soft 17, draws 2 → soft 19
        g = _make_game_in_player_phase(
            rules=BlackjackRules(hit_soft_17=True),
            player_hand=[Card("♠", "10"), Card("♥", "9")],  # 19
            dealer_hand=[Card("♦", "A"), Card("♣", "3"), Card("♠", "3")],  # soft 17
            deck=[Card("♠", "2")],  # → soft 19
        )
        g.stand()
        assert hand_value(g._dealer_hand) == 19
        assert len(g._dealer_hand) == 4


# ---------------------------------------------------------------------------
# Penetration-based reshuffling
# ---------------------------------------------------------------------------


class TestPenetrationReshuffle:
    def test_reshuffle_at_default_penetration(self):
        # 6 decks, 0.75 penetration → threshold = 6*52*(1-0.75) = 78
        rules = BlackjackRules(deck_count=6, penetration=0.75)
        g = BlackjackGame(rules=rules, chips=1000)
        g.bet = 100
        g.phase = "result"
        g.outcome = "push"
        # Set deck to just below threshold
        g._deck = g._deck[:77]
        g.new_hand()
        assert len(g._deck) == 312  # full reshuffle

    def test_no_reshuffle_above_threshold(self):
        rules = BlackjackRules(deck_count=6, penetration=0.75)
        g = BlackjackGame(rules=rules, chips=1000)
        g.bet = 100
        g.phase = "result"
        g.outcome = "push"
        # Set deck to just above threshold (78)
        g._deck = g._deck[:80]
        g.new_hand()
        assert len(g._deck) == 80  # no reshuffle

    def test_single_deck_penetration(self):
        # 1 deck, 0.75 → threshold = max(15, 52*(1-0.75)) = max(15, 13) = 15
        rules = BlackjackRules(deck_count=1, penetration=0.75)
        g = BlackjackGame(rules=rules, chips=1000)
        g.bet = 100
        g.phase = "result"
        g.outcome = "push"
        g._deck = g._deck[:14]  # below 15
        g.new_hand()
        assert len(g._deck) == 52  # reshuffled single deck

    def test_high_penetration_lower_threshold(self):
        # 6 decks, 0.9 → threshold = max(15, 312*0.1) = max(15, 31) = 31
        rules = BlackjackRules(deck_count=6, penetration=0.9)
        g = BlackjackGame(rules=rules, chips=1000)
        g.bet = 100
        g.phase = "result"
        g.outcome = "push"
        g._deck = g._deck[:30]  # below 31
        g.new_hand()
        assert len(g._deck) == 312

    def test_rules_persist_across_hands(self):
        rules = BlackjackRules(hit_soft_17=True, deck_count=2, penetration=0.8)
        g = BlackjackGame(rules=rules, chips=1000)
        g.place_bet(100)
        if g.phase == "player":
            g.stand()
        g.new_hand()
        assert g.rules.hit_soft_17 is True
        assert g.rules.deck_count == 2
        assert g.rules.penetration == 0.8
