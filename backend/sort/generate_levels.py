#!/usr/bin/env python3
"""Generate 20 solvable Sort Puzzle levels via reverse-scramble from solved state.

Usage: python generate_levels.py > levels.json

Each level is guaranteed solvable: the starting state is reached by applying
valid pours from the solved state, so the solution exists by construction.
"""

import json
import random
from itertools import takewhile

DEPTH = 4


def _top_color(bottle: list[str]) -> str | None:
    return bottle[-1] if bottle else None


def _space(bottle: list[str]) -> int:
    return DEPTH - len(bottle)


def _moves(state: list[list[str]]) -> list[tuple[int, int]]:
    result = []
    for i, src in enumerate(state):
        if not src:
            continue
        color = src[-1]
        # Skip fully solved bottles (full and pure)
        if len(src) == DEPTH and len(set(src)) == 1:
            continue
        for j, dst in enumerate(state):
            if i == j or _space(dst) == 0:
                continue
            top_j = _top_color(dst)
            if top_j is None or top_j == color:
                result.append((i, j))
    return result


def _apply(state: list[list[str]], frm: int, to: int) -> list[list[str]]:
    new = [list(b) for b in state]
    color = new[frm][-1]
    run = sum(1 for _ in takewhile(lambda c: c == color, reversed(new[frm])))
    n_pour = min(run, _space(new[to]))
    for _ in range(n_pour):
        new[frm].pop()
        new[to].append(color)
    return new


def generate_level(
    colors: list[str], n_empty: int, n_scramble: int, rng: random.Random
) -> list[list[str]]:
    state = [[c] * DEPTH for c in colors] + [[] for _ in range(n_empty)]
    for _ in range(n_scramble):
        moves = _moves(state)
        if not moves:
            break
        frm, to = rng.choice(moves)
        state = _apply(state, frm, to)
    return state


def to_json_bottles(state: list[list[str]]) -> list[list[str]]:
    """Pad each bottle to exactly DEPTH slots; empty slots represented as ''."""
    return [b + [""] * (DEPTH - len(b)) for b in state]


COLORS_3 = ["red", "blue", "green"]
COLORS_4 = ["red", "blue", "green", "yellow"]
COLORS_5 = ["red", "blue", "green", "yellow", "orange"]
COLORS_6 = ["red", "blue", "green", "yellow", "orange", "purple"]
COLORS_7 = ["red", "blue", "green", "yellow", "orange", "purple", "pink"]
COLORS_8 = ["red", "blue", "green", "yellow", "orange", "purple", "pink", "teal"]

LEVEL_SPECS = [
    # (id, colors, n_empty, n_scramble)
    (1,  COLORS_3, 1, 10),
    (2,  COLORS_3, 1, 16),
    (3,  COLORS_3, 1, 22),
    (4,  COLORS_4, 1, 12),
    (5,  COLORS_4, 1, 18),
    (6,  COLORS_4, 1, 24),
    (7,  COLORS_4, 1, 30),
    (8,  COLORS_5, 2, 18),
    (9,  COLORS_5, 2, 24),
    (10, COLORS_5, 2, 30),
    (11, COLORS_5, 2, 36),
    (12, COLORS_6, 2, 22),
    (13, COLORS_6, 2, 28),
    (14, COLORS_6, 2, 34),
    (15, COLORS_6, 2, 40),
    (16, COLORS_7, 2, 26),
    (17, COLORS_7, 2, 32),
    (18, COLORS_7, 2, 38),
    (19, COLORS_7, 2, 44),
    (20, COLORS_8, 2, 48),
]


def main() -> None:
    rng = random.Random(42)
    levels = []
    for level_id, colors, n_empty, n_scramble in LEVEL_SPECS:
        state = generate_level(colors, n_empty, n_scramble, rng)
        levels.append({"id": level_id, "bottles": to_json_bottles(state)})
    print(json.dumps(levels, indent=2))


if __name__ == "__main__":
    main()
