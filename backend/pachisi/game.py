import random
from dataclasses import dataclass, field

NUM_PIECES = 4
TRACK_LENGTH = 52
FINISH = 100

# Outer track square where each player's piece enters (on a roll of 6 from base)
PLAYER_ENTRY: dict[str, int] = {"red": 0, "yellow": 26}

# Last outer-track square before each player's home column
# A piece at this square entering with any roll goes into the home column
# Computed as (entry + 50) % 52 — pieces travel 51 outer squares before home col
HOME_COL_ENTRY_OUTER: dict[str, int] = {"red": 50, "yellow": 24}

# First index of each player's home-column range (6 squares total)
HOME_COL_START: dict[str, int] = {"red": 52, "yellow": 64}

# Safe squares on the outer track — landing here prevents capture
SAFE_SQUARES: frozenset[int] = frozenset([0, 8, 13, 21, 26, 34, 39, 47])


def _is_home_col(player: str, pos: int) -> bool:
    """Return True if pos is in this player's home column (not on outer track)."""
    start = HOME_COL_START[player]
    return start <= pos < start + 6


def _advance(player: str, pos: int, steps: int) -> int | None:
    """
    Compute the new position after moving `steps` squares.
    Returns None if the move is invalid (overshoot of home column).
    pos == -1 means the piece is in base; only valid when steps == 6 (enter outer track).
    """
    if pos == -1:
        # Entering from base — must be a roll of 6, land on entry square
        return PLAYER_ENTRY[player]

    home_col_start = HOME_COL_START[player]
    finish_pos = home_col_start + 5  # landing here means FINISH

    if _is_home_col(player, pos):
        # Already in home column, just advance
        new_pos = pos + steps
        if new_pos > finish_pos:
            return None  # overshoot
        if new_pos == finish_pos:
            return FINISH
        return new_pos

    # On outer track — check if trajectory crosses home col door
    door = HOME_COL_ENTRY_OUTER[player]
    steps_to_door = (door - pos + TRACK_LENGTH) % TRACK_LENGTH

    if steps <= steps_to_door:
        # Stays on outer track
        return (pos + steps) % TRACK_LENGTH

    # Crosses the door into home column
    steps_into_home = steps - steps_to_door - 1
    new_pos = home_col_start + steps_into_home
    if new_pos > finish_pos:
        return None  # overshoot
    if new_pos == finish_pos:
        return FINISH
    return new_pos


@dataclass
class PachisiGame:
    players: list[str] = field(default_factory=lambda: ["red", "yellow"])
    pieces: dict[str, list[int]] = field(
        default_factory=lambda: {"red": [-1, -1, -1, -1], "yellow": [-1, -1, -1, -1]}
    )
    current_player: str = "red"
    phase: str = "roll"  # "roll" | "move" | "game_over"
    die_value: int | None = None
    valid_moves: list[int] = field(default_factory=list)
    winner: str | None = None
    extra_turn: bool = False
    cpu_player: str | None = "yellow"
    last_event: str | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def roll(self) -> None:
        if self.phase != "roll":
            raise ValueError("Not in roll phase.")
        self.die_value = random.randint(1, 6)
        self.extra_turn = self.die_value == 6
        self.valid_moves = self._compute_valid_moves(self.current_player, self.die_value)
        self.last_event = None

        if not self.valid_moves:
            # No valid moves — skip turn
            self.last_event = "no_moves"
            self.die_value = None
            self.extra_turn = False
            self._advance_turn()
        else:
            self.phase = "move"

    def move_piece(self, piece_idx: int) -> None:
        if self.phase != "move":
            raise ValueError("Not in move phase.")
        if piece_idx not in self.valid_moves:
            raise ValueError(f"Piece {piece_idx} cannot move.")

        player = self.current_player
        pos = self.pieces[player][piece_idx]
        new_pos = _advance(player, pos, self.die_value)  # type: ignore[arg-type]
        assert new_pos is not None  # guaranteed by valid_moves

        self.pieces[player][piece_idx] = new_pos

        # Check for capture (only on outer track, non-safe squares)
        self.last_event = None
        if 0 <= new_pos <= 51 and new_pos not in SAFE_SQUARES:
            for opponent in self.players:
                if opponent == player:
                    continue
                for i, opos in enumerate(self.pieces[opponent]):
                    if opos == new_pos:
                        self.pieces[opponent][i] = -1
                        self.last_event = "capture"

        # Check win condition
        if all(p == FINISH for p in self.pieces[player]):
            self.winner = player
            self.phase = "game_over"
            self.valid_moves = []
            self.die_value = None
            return

        self.valid_moves = []

        if self.extra_turn:
            # Rolled a 6 — same player rolls again
            self.die_value = None
            self.extra_turn = False
            self.phase = "roll"
            if self.last_event is None:
                self.last_event = "extra_turn"
        else:
            self.die_value = None
            self.extra_turn = False
            self._advance_turn()

    def cpu_take_turn(self) -> None:
        """Run the CPU's full turn(s) synchronously."""
        while self.current_player == self.cpu_player and self.phase != "game_over":
            self.roll()
            if self.phase == "game_over":
                break
            if self.phase == "move" and self.valid_moves:
                piece_idx = random.choice(self.valid_moves)
                self.move_piece(piece_idx)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _compute_valid_moves(self, player: str, die_value: int) -> list[int]:
        valid = []
        for i, pos in enumerate(self.pieces[player]):
            if pos == FINISH:
                continue
            if pos == -1:
                if die_value == 6:
                    valid.append(i)
            else:
                if _advance(player, pos, die_value) is not None:
                    valid.append(i)
        return valid

    def _advance_turn(self) -> None:
        idx = self.players.index(self.current_player)
        self.current_player = self.players[(idx + 1) % len(self.players)]
        self.phase = "roll"


def new_game(cpu_player: str | None = "yellow") -> "PachisiGame":
    """Create a fresh 2-player Human (red) vs CPU (yellow) game."""
    return PachisiGame(
        players=["red", "yellow"],
        pieces={"red": [-1, -1, -1, -1], "yellow": [-1, -1, -1, -1]},
        current_player="red",
        phase="roll",
        die_value=None,
        valid_moves=[],
        winner=None,
        extra_turn=False,
        cpu_player=cpu_player,
        last_event=None,
    )
