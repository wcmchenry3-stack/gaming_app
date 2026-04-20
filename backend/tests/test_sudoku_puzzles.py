"""Sudoku puzzle bank uniqueness audit (#623).

Runs the uniqueness-checking solver from ``gen_sudoku_puzzles.py`` on
every puzzle in ``frontend/src/game/sudoku/puzzles.json`` and asserts
exactly one solution each.  Complements the Jest solvability audit — a
puzzle can be "solvable" (at least one solution) without being
"unique" (exactly one), and only the latter is ethical to ship.

Runtime: ~40 s for 3 000 puzzles on a modern laptop; we keep the test
unconditional so a future generator regression is caught before the
bank lands.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Make the generator's helpers importable without installing the
# script as a package — it lives under backend/scripts/.
_BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND / "scripts"))

from gen_sudoku_puzzles import TIER_RANGES, count_solutions  # noqa: E402

_BANK_PATH = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "game" / "sudoku" / "puzzles.json"
)


def _load_bank() -> dict[str, list[str]]:
    return json.loads(_BANK_PATH.read_text())


@pytest.fixture(scope="module")
def bank() -> dict[str, list[str]]:
    return _load_bank()


@pytest.mark.parametrize("tier", ["easy", "medium", "hard"])
def test_every_puzzle_has_unique_solution(bank: dict[str, list[str]], tier: str) -> None:
    """``count_solutions`` with limit 2 must return exactly 1 for every
    puzzle.  If any puzzle returns 0 the generator produced an impossible
    grid; if any returns 2 the hollowing step accepted an ambiguous
    removal.  Both are shipping-blockers."""
    puzzles = bank[tier]
    assert len(puzzles) == 1000, f"{tier} bank is {len(puzzles)} puzzles, expected 1000"

    non_unique: list[tuple[int, int]] = []  # (index, count)
    for i, puzzle_str in enumerate(puzzles):
        assert len(puzzle_str) == 81, f"{tier}[{i}] wrong length {len(puzzle_str)}"
        grid = [int(c) for c in puzzle_str]
        count = count_solutions(grid, 2)
        if count != 1:
            non_unique.append((i, count))
            if len(non_unique) >= 5:
                break

    if non_unique:
        sample = ", ".join(f"{tier}[{i}]={count}" for i, count in non_unique)
        pytest.fail(f"{len(non_unique)} {tier} puzzle(s) did not have a unique solution: {sample}")


@pytest.mark.parametrize("tier", ["easy", "medium", "hard"])
def test_every_puzzle_clue_count_in_range(bank: dict[str, list[str]], tier: str) -> None:
    """Each puzzle's clue count must land inside its tier's configured
    range.  A drift here would mean the generator classified puzzles
    incorrectly — harmless to play, but indicates the generator needs
    re-tuning before the next regeneration."""
    lo, hi = TIER_RANGES[tier]
    out_of_range: list[tuple[int, int]] = []
    for i, puzzle_str in enumerate(bank[tier]):
        clues = sum(1 for ch in puzzle_str if ch != "0")
        if not (lo <= clues <= hi):
            out_of_range.append((i, clues))
            if len(out_of_range) >= 5:
                break

    if out_of_range:
        sample = ", ".join(f"{tier}[{i}]={clues}" for i, clues in out_of_range)
        pytest.fail(f"{len(out_of_range)} {tier} puzzle(s) outside [{lo}, {hi}]: {sample}")


def test_bank_totals(bank: dict[str, list[str]]) -> None:
    assert set(bank.keys()) == {"easy", "medium", "hard"}
    assert sum(len(v) for v in bank.values()) == 3000
