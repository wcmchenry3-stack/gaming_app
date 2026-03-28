"""Unit tests for LudoGame game logic."""
import pytest
from unittest.mock import patch

from ludo.game import (
    FINISH,
    HOME_COL_ENTRY_OUTER,
    HOME_COL_START,
    PLAYER_ENTRY,
    SAFE_SQUARES,
    TRACK_LENGTH,
    LudoGame,
    _advance,
    new_game,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_game(
    red: list[int] | None = None,
    yellow: list[int] | None = None,
    die: int | None = None,
    phase: str = "roll",
    current_player: str = "red",
    extra_turn: bool = False,
) -> LudoGame:
    g = new_game()
    g.pieces["red"] = red if red is not None else [-1, -1, -1, -1]
    g.pieces["yellow"] = yellow if yellow is not None else [-1, -1, -1, -1]
    g.die_value = die
    g.phase = phase
    g.current_player = current_player
    g.extra_turn = extra_turn
    if phase == "move" and die is not None:
        g.valid_moves = g._compute_valid_moves(current_player, die)
    return g


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_safe_squares_count(self):
        assert len(SAFE_SQUARES) == 8

    def test_player_entries_on_outer_track(self):
        for entry in PLAYER_ENTRY.values():
            assert 0 <= entry < TRACK_LENGTH

    def test_home_col_entry_formula(self):
        for player, entry in PLAYER_ENTRY.items():
            expected = (entry + 50) % TRACK_LENGTH
            assert HOME_COL_ENTRY_OUTER[player] == expected

    def test_home_col_starts_distinct(self):
        starts = list(HOME_COL_START.values())
        assert len(starts) == len(set(starts))


# ---------------------------------------------------------------------------
# _advance helper
# ---------------------------------------------------------------------------


class TestAdvance:
    def test_from_base_six_enters_entry(self):
        assert _advance("red", -1, 6) == PLAYER_ENTRY["red"]

    def test_from_base_not_six_not_called(self):
        # _advance for base is only called when die==6; we still test it returns entry
        assert _advance("yellow", -1, 6) == PLAYER_ENTRY["yellow"]

    def test_outer_track_simple_advance(self):
        assert _advance("red", 0, 3) == 3
        assert _advance("red", 10, 5) == 15

    def test_outer_track_wrap(self):
        # Yellow piece wraps around the board
        assert _advance("yellow", 48, 5) == 1

    def test_reaches_home_col_door_stays_outer(self):
        # Red at door square stays on outer track
        door = HOME_COL_ENTRY_OUTER["red"]  # 50
        assert _advance("red", door - 2, 2) == door

    def test_crosses_door_enters_home_col(self):
        door = HOME_COL_ENTRY_OUTER["red"]
        start = HOME_COL_START["red"]
        # 1 step past door → first home col square
        assert _advance("red", door, 1) == start
        # 2 steps past door
        assert _advance("red", door, 2) == start + 1

    def test_crosses_door_exact_finish(self):
        door = HOME_COL_ENTRY_OUTER["red"]
        # 6 steps past door → finish
        assert _advance("red", door, 6) == FINISH

    def test_crosses_door_overshoot_returns_none(self):
        door = HOME_COL_ENTRY_OUTER["red"]
        assert _advance("red", door, 7) is None

    def test_home_col_advance(self):
        start = HOME_COL_START["red"]
        assert _advance("red", start, 2) == start + 2

    def test_home_col_exact_finish(self):
        start = HOME_COL_START["red"]
        assert _advance("red", start, 5) == FINISH

    def test_home_col_overshoot_returns_none(self):
        start = HOME_COL_START["red"]
        assert _advance("red", start, 6) is None

    def test_yellow_door_and_home_col(self):
        door = HOME_COL_ENTRY_OUTER["yellow"]
        start = HOME_COL_START["yellow"]
        assert _advance("yellow", door, 1) == start
        assert _advance("yellow", door, 6) == FINISH
        assert _advance("yellow", door, 7) is None


# ---------------------------------------------------------------------------
# New game
# ---------------------------------------------------------------------------


class TestNewGame:
    def test_all_pieces_in_base(self):
        g = new_game()
        for player in g.players:
            assert g.pieces[player] == [-1, -1, -1, -1]

    def test_initial_phase_and_player(self):
        g = new_game()
        assert g.phase == "roll"
        assert g.current_player == "red"

    def test_no_die_value(self):
        g = new_game()
        assert g.die_value is None
        assert g.valid_moves == []
        assert g.winner is None


# ---------------------------------------------------------------------------
# roll()
# ---------------------------------------------------------------------------


class TestRoll:
    def test_roll_sets_die_value_in_range(self):
        # Use a piece on the track so it's guaranteed to have valid moves
        g = _make_game(red=[5, -1, -1, -1])
        g.roll()
        assert g.die_value is not None
        assert 1 <= g.die_value <= 6

    def test_roll_in_wrong_phase_raises(self):
        g = _make_game(die=3, phase="move")
        with pytest.raises(ValueError, match="Not in roll phase"):
            g.roll()

    def test_roll_six_makes_base_pieces_valid(self):
        g = _make_game()
        with patch("ludo.game.random.randint", return_value=6):
            g.roll()
        assert g.valid_moves == [0, 1, 2, 3]
        assert g.phase == "move"

    def test_roll_non_six_all_in_base_auto_skips(self):
        g = _make_game()
        with patch("ludo.game.random.randint", return_value=3):
            g.roll()
        assert g.phase == "roll"
        assert g.current_player == "yellow"  # turn advanced

    def test_roll_non_six_piece_on_track_is_valid(self):
        g = _make_game(red=[5, -1, -1, -1])
        with patch("ludo.game.random.randint", return_value=3):
            g.roll()
        assert 0 in g.valid_moves
        assert g.phase == "move"

    def test_extra_turn_flag_set_on_six(self):
        g = _make_game(red=[5, -1, -1, -1])
        with patch("ludo.game.random.randint", return_value=6):
            g.roll()
        assert g.extra_turn is True

    def test_extra_turn_flag_not_set_on_non_six(self):
        g = _make_game(red=[5, -1, -1, -1])
        with patch("ludo.game.random.randint", return_value=3):
            g.roll()
        assert g.extra_turn is False

    def test_overshoot_pieces_not_valid(self):
        # Piece at HOME_COL_START["red"] + 4 (1 away from finish) — roll 2 overshoots
        start = HOME_COL_START["red"]
        g = _make_game(red=[start + 4, -1, -1, -1])
        with patch("ludo.game.random.randint", return_value=2):
            g.roll()
        # Piece 0 can't move (overshoot), and no roll-6 for base pieces
        assert 0 not in g.valid_moves


# ---------------------------------------------------------------------------
# move_piece()
# ---------------------------------------------------------------------------


class TestMovePiece:
    def test_move_in_wrong_phase_raises(self):
        g = _make_game(phase="roll")
        with pytest.raises(ValueError, match="Not in move phase"):
            g.move_piece(0)

    def test_move_invalid_index_raises(self):
        g = _make_game(red=[5, -1, -1, -1], die=3, phase="move")
        g.valid_moves = [0]
        with pytest.raises(ValueError):
            g.move_piece(1)

    def test_move_from_base_places_at_entry(self):
        g = _make_game(die=6, phase="move")
        g.valid_moves = [0]
        g.move_piece(0)
        assert g.pieces["red"][0] == PLAYER_ENTRY["red"]

    def test_move_advances_piece_on_track(self):
        g = _make_game(red=[5, -1, -1, -1], die=3, phase="move")
        g.valid_moves = [0]
        g.move_piece(0)
        assert g.pieces["red"][0] == 8

    def test_capture_sends_opponent_to_base(self):
        # Find a non-safe, non-zero outer track square for the capture
        target = next(s for s in range(1, 52) if s not in SAFE_SQUARES)
        g = _make_game(red=[target - 1, -1, -1, -1], yellow=[target, -1, -1, -1], die=1, phase="move")
        g.valid_moves = [0]
        g.move_piece(0)
        assert g.pieces["red"][0] == target
        assert g.pieces["yellow"][0] == -1
        assert g.last_event == "capture"

    def test_no_capture_on_safe_square(self):
        # Red at 12, rolls 1, lands on 13 (safe — Yellow's entry)
        assert 13 in SAFE_SQUARES
        g = _make_game(red=[12, -1, -1, -1], yellow=[13, -1, -1, -1], die=1, phase="move")
        g.valid_moves = [0]
        g.move_piece(0)
        assert g.pieces["yellow"][0] == 13  # not captured

    def test_no_capture_in_home_col(self):
        # Red piece entering home col — no capture possible there
        door = HOME_COL_ENTRY_OUTER["red"]
        start = HOME_COL_START["red"]
        # Yellow can't be in Red's home col, so this just checks no capture occurs normally
        g = _make_game(red=[door, -1, -1, -1], die=1, phase="move")
        g.valid_moves = [0]
        g.move_piece(0)
        assert g.pieces["red"][0] == start

    def test_extra_turn_keeps_current_player(self):
        g = _make_game(red=[5, -1, -1, -1], die=6, phase="move", extra_turn=True)
        g.valid_moves = [0]
        g.move_piece(0)
        assert g.current_player == "red"
        assert g.phase == "roll"

    def test_non_six_advances_to_next_player(self):
        g = _make_game(red=[5, -1, -1, -1], die=3, phase="move")
        g.valid_moves = [0]
        g.move_piece(0)
        assert g.current_player == "yellow"
        assert g.phase == "roll"

    def test_win_condition(self):
        # All red pieces one step from finish
        start = HOME_COL_START["red"]
        g = _make_game(
            red=[start + 4, start + 4, start + 4, start + 4],
            die=1,
            phase="move",
        )
        g.valid_moves = [0]
        g.move_piece(0)
        # Still need the other 3 pieces — only piece 0 finished
        assert g.phase != "game_over"

        # Put all pieces at finish except 0; reset to red's turn
        g.pieces["red"] = [FINISH, FINISH, FINISH, start + 4]
        g.current_player = "red"
        g.phase = "move"
        g.die_value = 1
        g.valid_moves = [3]
        g.move_piece(3)
        assert g.phase == "game_over"
        assert g.winner == "red"


# ---------------------------------------------------------------------------
# cpu_take_turn()
# ---------------------------------------------------------------------------


class TestCpuTurn:
    def test_cpu_takes_turn_and_returns_to_human(self):
        # Set up: red's turn done, now yellow's turn
        g = _make_game(
            yellow=[5, -1, -1, -1],
            phase="roll",
            current_player="yellow",
        )
        g.cpu_take_turn()
        # After CPU finishes, it should be red's turn again
        assert g.current_player == "red"
        assert g.phase == "roll"

    def test_cpu_handles_no_valid_moves(self):
        # Yellow all in base, no 6 rolled — auto-skips and returns to red
        g = _make_game(phase="roll", current_player="yellow")
        with patch("ludo.game.random.randint", return_value=3):
            g.cpu_take_turn()
        assert g.current_player == "red"

    def test_cpu_takes_extra_turn_on_six(self):
        # Yellow piece on track; CPU rolls 6 then a non-6
        g = _make_game(
            yellow=[5, -1, -1, -1],
            phase="roll",
            current_player="yellow",
        )
        rolls = iter([6, 3])
        with patch("ludo.game.random.randint", side_effect=rolls):
            g.cpu_take_turn()
        assert g.current_player == "red"

    def test_cpu_does_nothing_when_not_cpu_turn(self):
        g = _make_game(phase="roll", current_player="red")
        g.cpu_take_turn()  # should be a no-op
        assert g.current_player == "red"

    def test_cpu_stops_on_game_over(self):
        # Arrange yellow one step from win, CPU rolls 1
        start = HOME_COL_START["yellow"]
        g = _make_game(
            yellow=[FINISH, FINISH, FINISH, start + 4],
            phase="roll",
            current_player="yellow",
        )
        with patch("ludo.game.random.randint", return_value=1):
            g.cpu_take_turn()
        assert g.phase == "game_over"
        assert g.winner == "yellow"
