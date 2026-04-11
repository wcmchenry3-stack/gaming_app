"""
API integration tests for the blackjack endpoints.

Uses FastAPI TestClient — no WASM or real network needed.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

import blackjack.router as blackjack_router_module
from blackjack.game import Card
from main import app

client = TestClient(app)

# Fixed session ID used by all test helpers in this module
TEST_SESSION_ID = str(uuid.uuid4())
SESSION_HEADERS = {"X-Session-ID": TEST_SESSION_ID}


@pytest.fixture(autouse=True)
def reset():
    blackjack_router_module.reset_game()
    yield
    blackjack_router_module.reset_game()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _current_game():
    return blackjack_router_module._sessions.get(TEST_SESSION_ID)


def new_game():
    return client.post("/blackjack/new", headers=SESSION_HEADERS)


def bet(amount=100):
    return client.post("/blackjack/bet", json={"amount": amount}, headers=SESSION_HEADERS)


def hit():
    return client.post("/blackjack/hit", headers=SESSION_HEADERS)


def stand():
    return client.post("/blackjack/stand", headers=SESSION_HEADERS)


def double_down():
    return client.post("/blackjack/double-down", headers=SESSION_HEADERS)


def new_hand():
    return client.post("/blackjack/new-hand", headers=SESSION_HEADERS)


def _inject_player_phase(chips=1000, bet_amount=100):
    """Bypass place_bet to put the game directly into player phase."""
    new_game()
    g = _current_game()
    g.chips = chips
    g.bet = bet_amount
    g._player_hand = [Card("♠", "7"), Card("♥", "8")]
    g._dealer_hand = [Card("♦", "6"), Card("♣", "9")]
    g.phase = "player"


def _inject_result_phase(chips=900, bet_amount=100, outcome="lose", payout=-100):
    new_game()
    g = _current_game()
    g.chips = chips
    g.bet = bet_amount
    g._player_hand = [Card("♠", "7"), Card("♥", "8")]
    g._dealer_hand = [Card("♦", "K"), Card("♣", "9")]
    g.phase = "result"
    g.outcome = outcome
    g.payout = payout


# ---------------------------------------------------------------------------
# POST /blackjack/new
# ---------------------------------------------------------------------------


class TestNewGame:
    def test_returns_200(self):
        assert new_game().status_code == 200

    def test_starts_with_1000_chips(self):
        data = new_game().json()
        assert data["chips"] == 1000

    def test_starts_in_betting_phase(self):
        data = new_game().json()
        assert data["phase"] == "betting"

    def test_empty_hands(self):
        data = new_game().json()
        assert data["player_hand"]["cards"] == []
        assert data["dealer_hand"]["cards"] == []

    def test_game_not_over(self):
        data = new_game().json()
        assert data["game_over"] is False

    def test_last_win_is_null_on_new_game(self):
        data = new_game().json()
        assert data["last_win"] is None


# ---------------------------------------------------------------------------
# GET /blackjack/state
# ---------------------------------------------------------------------------


class TestGetState:
    def test_404_without_game(self):
        assert client.get("/blackjack/state", headers=SESSION_HEADERS).status_code == 404

    def test_200_with_game(self):
        new_game()
        assert client.get("/blackjack/state", headers=SESSION_HEADERS).status_code == 200

    def test_state_matches_new_game(self):
        new_game()
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["chips"] == 1000
        assert data["phase"] == "betting"


# ---------------------------------------------------------------------------
# POST /blackjack/bet
# ---------------------------------------------------------------------------


class TestPlaceBet:
    def test_valid_bet_returns_200(self):
        new_game()
        assert bet(100).status_code == 200

    def test_valid_bet_deals_two_cards_to_player(self):
        new_game()
        data = bet(100).json()
        assert len(data["player_hand"]["cards"]) == 2

    def test_valid_bet_deals_two_cards_to_dealer(self):
        new_game()
        data = bet(100).json()
        assert len(data["dealer_hand"]["cards"]) == 2

    def test_amount_below_minimum_returns_422(self):
        new_game()
        assert bet(4).status_code == 422

    def test_amount_zero_returns_422(self):
        new_game()
        assert bet(0).status_code == 422

    def test_amount_above_maximum_returns_422(self):
        new_game()
        assert bet(510).status_code == 422

    def test_minimum_bet_of_5_accepted(self):
        new_game()
        assert bet(5).status_code == 200

    def test_amount_non_multiple_of_10_accepted(self):
        new_game()
        assert bet(15).status_code == 200

    def test_amount_30_accepted(self):
        new_game()
        assert bet(30).status_code == 200

    def test_bet_wrong_phase_returns_400(self):
        _inject_player_phase()
        assert bet(100).status_code == 400

    def test_insufficient_chips_returns_400(self):
        new_game()
        _current_game().chips = 50
        assert bet(100).status_code == 400

    def test_404_without_game(self):
        assert bet(100).status_code == 404


# ---------------------------------------------------------------------------
# POST /blackjack/hit
# ---------------------------------------------------------------------------


class TestHit:
    def test_404_without_game(self):
        assert hit().status_code == 404

    def test_400_wrong_phase(self):
        new_game()
        assert hit().status_code == 400

    def test_200_in_player_phase(self):
        _inject_player_phase()
        assert hit().status_code == 200

    def test_player_gets_extra_card(self):
        _inject_player_phase()
        data = hit().json()
        assert len(data["player_hand"]["cards"]) >= 2


# ---------------------------------------------------------------------------
# POST /blackjack/stand
# ---------------------------------------------------------------------------


class TestStand:
    def test_404_without_game(self):
        assert stand().status_code == 404

    def test_400_wrong_phase(self):
        new_game()
        assert stand().status_code == 400

    def test_200_in_player_phase(self):
        _inject_player_phase()
        assert stand().status_code == 200

    def test_stand_reaches_result_phase(self):
        _inject_player_phase()
        data = stand().json()
        assert data["phase"] == "result"

    def test_stand_reveals_full_dealer_hand(self):
        _inject_player_phase()
        data = stand().json()
        dealer_cards = data["dealer_hand"]["cards"]
        assert all(not c["face_down"] for c in dealer_cards)

    def test_outcome_is_set(self):
        _inject_player_phase()
        data = stand().json()
        assert data["outcome"] in ("win", "lose", "push", "blackjack")


# ---------------------------------------------------------------------------
# POST /blackjack/double-down
# ---------------------------------------------------------------------------


class TestDoubleDown:
    def test_404_without_game(self):
        assert double_down().status_code == 404

    def test_400_wrong_phase(self):
        new_game()
        assert double_down().status_code == 400

    def test_200_valid_double_down(self):
        _inject_player_phase(chips=500, bet_amount=100)
        assert double_down().status_code == 200

    def test_double_down_doubles_bet(self):
        _inject_player_phase(chips=500, bet_amount=100)
        data = double_down().json()
        assert data["bet"] == 200

    def test_double_down_reaches_result(self):
        _inject_player_phase(chips=500, bet_amount=100)
        data = double_down().json()
        assert data["phase"] == "result"

    def test_double_down_insufficient_chips_returns_400(self):
        _inject_player_phase(chips=150, bet_amount=100)
        _current_game().chips = 50
        assert double_down().status_code == 400

    def test_double_down_not_on_three_cards_returns_400(self):
        _inject_player_phase(chips=500, bet_amount=100)
        _current_game()._player_hand.append(Card("♠", "2"))
        assert double_down().status_code == 400


# ---------------------------------------------------------------------------
# POST /blackjack/new-hand
# ---------------------------------------------------------------------------


class TestNewHand:
    def test_404_without_game(self):
        assert new_hand().status_code == 404

    def test_400_wrong_phase(self):
        new_game()
        assert new_hand().status_code == 400

    def test_200_from_result_phase(self):
        _inject_result_phase()
        assert new_hand().status_code == 200

    def test_new_hand_resets_to_betting(self):
        _inject_result_phase()
        data = new_hand().json()
        assert data["phase"] == "betting"

    def test_new_hand_resets_bet(self):
        _inject_result_phase()
        data = new_hand().json()
        assert data["bet"] == 0

    def test_new_hand_sets_last_win_from_payout(self):
        _inject_result_phase(chips=1100, bet_amount=100, outcome="win", payout=100)
        data = new_hand().json()
        assert data["last_win"] == 100

    def test_new_hand_sets_last_win_negative_on_loss(self):
        _inject_result_phase(chips=900, bet_amount=100, outcome="lose", payout=-100)
        data = new_hand().json()
        assert data["last_win"] == -100


# ---------------------------------------------------------------------------
# Hole card concealment
# ---------------------------------------------------------------------------


class TestHoleCardConcealment:
    def test_dealer_hole_card_face_down_during_player_phase(self):
        _inject_player_phase()
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["phase"] == "player"
        dealer_cards = data["dealer_hand"]["cards"]
        assert dealer_cards[0]["face_down"] is True
        assert dealer_cards[1]["face_down"] is False

    def test_dealer_hand_value_zero_during_player_phase(self):
        _inject_player_phase()
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["dealer_hand"]["value"] == 0

    def test_no_face_down_cards_in_result_phase(self):
        _inject_result_phase()
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        dealer_cards = data["dealer_hand"]["cards"]
        assert all(not c["face_down"] for c in dealer_cards)


# ---------------------------------------------------------------------------
# Game over
# ---------------------------------------------------------------------------


class TestGameOver:
    def test_game_over_when_chips_zero_in_result(self):
        _inject_result_phase(chips=0, outcome="lose", payout=-100)
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["game_over"] is True

    def test_not_game_over_with_chips_remaining(self):
        _inject_result_phase(chips=500, outcome="win", payout=100)
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["game_over"] is False

    def test_not_game_over_during_betting_even_if_chips_zero(self):
        new_game()
        _current_game().chips = 0
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["game_over"] is False


# ---------------------------------------------------------------------------
# double_down_available
# ---------------------------------------------------------------------------


class TestDoubleDownAvailable:
    def test_true_when_two_cards_and_enough_chips(self):
        _inject_player_phase(chips=500, bet_amount=100)
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["double_down_available"] is True

    def test_false_when_not_in_player_phase(self):
        new_game()
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["double_down_available"] is False

    def test_false_when_insufficient_chips(self):
        _inject_player_phase(chips=50, bet_amount=100)
        _current_game().chips = 50
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["double_down_available"] is False


# ---------------------------------------------------------------------------
# HandResponse soft field
# ---------------------------------------------------------------------------


class TestHandResponseSoft:
    def test_soft_false_for_hard_hand(self):
        _inject_player_phase()  # 7 + 8 = hard 15
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["player_hand"]["soft"] is False

    def test_soft_true_for_soft_hand(self):
        new_game()
        g = _current_game()
        g.chips = 1000
        g.bet = 100
        g._player_hand = [Card("♠", "A"), Card("♥", "6")]  # soft 17
        g._dealer_hand = [Card("♦", "6"), Card("♣", "9")]
        g.phase = "player"
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        assert data["player_hand"]["soft"] is True

    def test_dealer_soft_false_when_concealed(self):
        _inject_player_phase()
        data = client.get("/blackjack/state", headers=SESSION_HEADERS).json()
        # Dealer hole card is hidden — soft must be False
        assert data["dealer_hand"]["soft"] is False
