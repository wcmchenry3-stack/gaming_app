import copy
import random
from dataclasses import dataclass, field

SIZE = 4


def _slide_and_merge(line: list[int]) -> tuple[list[int], int]:
    """Slide a single row/column toward index 0 and merge equal neighbours.

    Returns the new line (length SIZE, zero-padded) and the score gained.
    Each tile may only participate in one merge per move.
    """
    # Remove zeros
    compacted = [v for v in line if v != 0]
    merged: list[int] = []
    score = 0
    i = 0
    while i < len(compacted):
        if i + 1 < len(compacted) and compacted[i] == compacted[i + 1]:
            val = compacted[i] * 2
            merged.append(val)
            score += val
            i += 2
        else:
            merged.append(compacted[i])
            i += 1
    # Pad to SIZE
    merged.extend([0] * (SIZE - len(merged)))
    return merged, score


def _transpose(board: list[list[int]]) -> list[list[int]]:
    return [list(row) for row in zip(*board)]


@dataclass
class Game2048:
    board: list[list[int]] = field(default_factory=lambda: [[0] * SIZE for _ in range(SIZE)])
    score: int = 0
    game_over: bool = False
    has_won: bool = False

    def __post_init__(self) -> None:
        if all(cell == 0 for row in self.board for cell in row):
            self._spawn_tile()
            self._spawn_tile()

    def _spawn_tile(self) -> None:
        empty = [(r, c) for r in range(SIZE) for c in range(SIZE) if self.board[r][c] == 0]
        if not empty:
            return
        r, c = random.choice(empty)
        self.board[r][c] = 2 if random.random() < 0.9 else 4

    def _is_game_over(self) -> bool:
        for r in range(SIZE):
            for c in range(SIZE):
                if self.board[r][c] == 0:
                    return False
                if c + 1 < SIZE and self.board[r][c] == self.board[r][c + 1]:
                    return False
                if r + 1 < SIZE and self.board[r][c] == self.board[r + 1][c]:
                    return False
        return True

    def move(self, direction: str) -> None:
        if self.game_over:
            raise ValueError("Game is over. Start a new game.")

        if direction not in ("up", "down", "left", "right"):
            raise ValueError(f"Invalid direction: {direction}")

        old_board = copy.deepcopy(self.board)

        if direction == "left":
            self._apply_left()
        elif direction == "right":
            self._apply_right()
        elif direction == "up":
            self._apply_up()
        elif direction == "down":
            self._apply_down()

        if self.board == old_board:
            raise ValueError("Move has no effect.")

        self._spawn_tile()

        if not self.has_won:
            for row in self.board:
                if 2048 in row:
                    self.has_won = True
                    break

        if self._is_game_over():
            self.game_over = True

    def _apply_left(self) -> None:
        for r in range(SIZE):
            self.board[r], gained = _slide_and_merge(self.board[r])
            self.score += gained

    def _apply_right(self) -> None:
        for r in range(SIZE):
            row = self.board[r][::-1]
            merged, gained = _slide_and_merge(row)
            self.board[r] = merged[::-1]
            self.score += gained

    def _apply_up(self) -> None:
        self.board = _transpose(self.board)
        self._apply_left()
        self.board = _transpose(self.board)

    def _apply_down(self) -> None:
        self.board = _transpose(self.board)
        self._apply_right()
        self.board = _transpose(self.board)

    def reset(self) -> None:
        self.board = [[0] * SIZE for _ in range(SIZE)]
        self.score = 0
        self.game_over = False
        self.has_won = False
        self._spawn_tile()
        self._spawn_tile()
