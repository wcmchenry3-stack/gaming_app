"""Unit tests for the 2048 game engine."""

import pytest

from twenty48.game import Game2048, _slide_and_merge, SIZE


# ---------------------------------------------------------------------------
# TestSlideAndMerge — pure function, no randomness
# ---------------------------------------------------------------------------


class TestSlideAndMerge:
    def test_no_merge(self):
        result, score = _slide_and_merge([2, 0, 0, 0])
        assert result == [2, 0, 0, 0]
        assert score == 0

    def test_simple_merge(self):
        result, score = _slide_and_merge([2, 2, 0, 0])
        assert result == [4, 0, 0, 0]
        assert score == 4

    def test_slide_then_merge(self):
        result, score = _slide_and_merge([0, 2, 0, 2])
        assert result == [4, 0, 0, 0]
        assert score == 4

    def test_no_double_merge(self):
        result, score = _slide_and_merge([2, 2, 2, 2])
        assert result == [4, 4, 0, 0]
        assert score == 8

    def test_triple_merge_left_pair(self):
        result, score = _slide_and_merge([2, 2, 2, 0])
        assert result == [4, 2, 0, 0]
        assert score == 4

    def test_mixed_values_no_merge(self):
        result, score = _slide_and_merge([2, 4, 2, 4])
        assert result == [2, 4, 2, 4]
        assert score == 0

    def test_large_values(self):
        result, score = _slide_and_merge([1024, 1024, 0, 0])
        assert result == [2048, 0, 0, 0]
        assert score == 2048

    def test_all_zeros(self):
        result, score = _slide_and_merge([0, 0, 0, 0])
        assert result == [0, 0, 0, 0]
        assert score == 0

    def test_slide_compact(self):
        result, score = _slide_and_merge([0, 0, 0, 4])
        assert result == [4, 0, 0, 0]
        assert score == 0

    def test_merge_only_first_pair(self):
        result, score = _slide_and_merge([4, 4, 8, 0])
        assert result == [8, 8, 0, 0]
        assert score == 8


# ---------------------------------------------------------------------------
# TestNewGame
# ---------------------------------------------------------------------------


class TestNewGame:
    def test_initial_two_tiles(self):
        game = Game2048()
        non_zero = sum(1 for r in game.board for c in r if c != 0)
        assert non_zero == 2

    def test_initial_values_2_or_4(self):
        game = Game2048()
        for row in game.board:
            for cell in row:
                if cell != 0:
                    assert cell in (2, 4)

    def test_initial_score_zero(self):
        game = Game2048()
        assert game.score == 0

    def test_initial_not_game_over(self):
        game = Game2048()
        assert game.game_over is False

    def test_initial_not_won(self):
        game = Game2048()
        assert game.has_won is False

    def test_board_is_4x4(self):
        game = Game2048()
        assert len(game.board) == SIZE
        for row in game.board:
            assert len(row) == SIZE

    def test_reset_clears_state(self):
        game = Game2048()
        # Make some moves to change state (may raise if no valid moves)
        try:
            game.move("left")
            game.move("right")
        except ValueError:
            pass
        game.reset()
        assert game.score == 0
        assert game.game_over is False
        assert game.has_won is False
        non_zero = sum(1 for r in game.board for c in r if c != 0)
        assert non_zero == 2


# ---------------------------------------------------------------------------
# TestMove — controlled boards
# ---------------------------------------------------------------------------


class TestMove:
    def _make_game_with_board(self, board: list[list[int]]) -> Game2048:
        """Create a game with a specific board (bypass __post_init__ spawning)."""
        game = Game2048.__new__(Game2048)
        game.board = [row[:] for row in board]
        game.score = 0
        game.game_over = False
        game.has_won = False
        return game

    def test_move_left(self):
        game = self._make_game_with_board(
            [
                [0, 0, 0, 0],
                [2, 0, 2, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        game.move("left")
        # Row 1 should have merged: [4, ...]
        assert game.board[1][0] == 4
        assert game.score == 4

    def test_move_right(self):
        game = self._make_game_with_board(
            [
                [0, 0, 0, 0],
                [0, 2, 0, 2],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        game.move("right")
        assert game.board[1][3] == 4
        assert game.score == 4

    def test_move_up(self):
        game = self._make_game_with_board(
            [
                [0, 2, 0, 0],
                [0, 0, 0, 0],
                [0, 2, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        game.move("up")
        assert game.board[0][1] == 4
        assert game.score == 4

    def test_move_down(self):
        game = self._make_game_with_board(
            [
                [0, 0, 0, 0],
                [0, 2, 0, 0],
                [0, 0, 0, 0],
                [0, 2, 0, 0],
            ]
        )
        game.move("down")
        assert game.board[3][1] == 4
        assert game.score == 4

    def test_invalid_move_raises(self):
        game = self._make_game_with_board(
            [
                [2, 4, 2, 4],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        # Moving left on row 0 has no effect (alternating), but other rows are empty
        # Use a board where left truly has no effect
        game2 = self._make_game_with_board(
            [
                [2, 0, 0, 0],
                [4, 0, 0, 0],
                [2, 0, 0, 0],
                [4, 0, 0, 0],
            ]
        )
        with pytest.raises(ValueError, match="no effect"):
            game2.move("left")

    def test_invalid_direction_raises(self):
        game = Game2048()
        with pytest.raises(ValueError, match="Invalid direction"):
            game.move("diagonal")

    def test_new_tile_spawns_after_move(self):
        game = self._make_game_with_board(
            [
                [0, 0, 0, 0],
                [2, 0, 0, 2],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        # Before: 2 non-zero tiles
        game.move("left")
        # After merge: 1 tile from merge + 1 new spawn = 2 non-zero tiles
        non_zero = sum(1 for r in game.board for c in r if c != 0)
        assert non_zero == 2

    def test_score_accumulates(self):
        game = self._make_game_with_board(
            [
                [2, 2, 4, 4],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        game.move("left")
        # 2+2=4, 4+4=8 → score = 12
        assert game.score == 12

    def test_move_after_game_over_raises(self):
        game = self._make_game_with_board(
            [
                [2, 4, 2, 4],
                [4, 2, 4, 2],
                [2, 4, 2, 4],
                [4, 2, 4, 2],
            ]
        )
        game.game_over = True
        with pytest.raises(ValueError, match="Game is over"):
            game.move("left")


# ---------------------------------------------------------------------------
# TestGameOver
# ---------------------------------------------------------------------------


class TestGameOver:
    def _make_game_with_board(self, board: list[list[int]]) -> Game2048:
        game = Game2048.__new__(Game2048)
        game.board = [row[:] for row in board]
        game.score = 0
        game.game_over = False
        game.has_won = False
        return game

    def test_not_over_with_empty_cells(self):
        game = self._make_game_with_board(
            [
                [2, 4, 2, 4],
                [4, 2, 4, 2],
                [2, 4, 2, 4],
                [4, 2, 4, 0],
            ]
        )
        assert game._is_game_over() is False

    def test_not_over_with_adjacent_matches(self):
        game = self._make_game_with_board(
            [
                [2, 4, 2, 4],
                [4, 2, 4, 2],
                [2, 4, 2, 4],
                [4, 2, 4, 4],  # last two match
            ]
        )
        assert game._is_game_over() is False

    def test_game_over_no_moves(self):
        game = self._make_game_with_board(
            [
                [2, 4, 2, 4],
                [4, 2, 4, 2],
                [2, 4, 2, 4],
                [4, 2, 4, 2],
            ]
        )
        assert game._is_game_over() is True


# ---------------------------------------------------------------------------
# TestHasWon
# ---------------------------------------------------------------------------


class TestHasWon:
    def _make_game_with_board(self, board: list[list[int]]) -> Game2048:
        game = Game2048.__new__(Game2048)
        game.board = [row[:] for row in board]
        game.score = 0
        game.game_over = False
        game.has_won = False
        return game

    def test_won_on_2048(self):
        game = self._make_game_with_board(
            [
                [1024, 1024, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        game.move("left")
        assert game.has_won is True
        assert game.board[0][0] == 2048

    def test_continue_after_win(self):
        game = self._make_game_with_board(
            [
                [1024, 1024, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ]
        )
        game.move("left")
        assert game.has_won is True
        assert game.game_over is False
        # Should be able to keep playing
        game.move("down")  # should work since there are empty cells


# ---------------------------------------------------------------------------
# TestSpawnProbability (statistical)
# ---------------------------------------------------------------------------


class TestSpawnProbability:
    def test_spawn_mostly_twos(self):
        """~90% of spawned tiles should be 2."""
        counts = {2: 0, 4: 0}
        for _ in range(1000):
            game = Game2048.__new__(Game2048)
            game.board = [[0] * SIZE for _ in range(SIZE)]
            game.score = 0
            game.game_over = False
            game.has_won = False
            game._spawn_tile()
            for row in game.board:
                for cell in row:
                    if cell != 0:
                        counts[cell] = counts.get(cell, 0) + 1
        total = counts[2] + counts[4]
        ratio_2 = counts[2] / total
        assert 0.85 <= ratio_2 <= 0.95, f"Expected ~90% twos, got {ratio_2:.1%}"
