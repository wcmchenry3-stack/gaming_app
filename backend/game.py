import random
from dataclasses import dataclass, field
from typing import Optional
from collections import Counter

CATEGORIES = [
    "ones",
    "twos",
    "threes",
    "fours",
    "fives",
    "sixes",
    "three_of_a_kind",
    "four_of_a_kind",
    "full_house",
    "small_straight",
    "large_straight",
    "yacht",
    "chance",
]

UPPER_CATEGORIES = {"ones", "twos", "threes", "fours", "fives", "sixes"}
UPPER_BONUS_THRESHOLD = 63
UPPER_BONUS_VALUE = 35


@dataclass
class YachtGame:
    dice: list[int] = field(default_factory=lambda: [0, 0, 0, 0, 0])
    held: list[bool] = field(default_factory=lambda: [False] * 5)
    rolls_used: int = 0
    round: int = 1
    scores: dict[str, Optional[int]] = field(
        default_factory=lambda: {cat: None for cat in CATEGORIES}
    )
    game_over: bool = False

    def roll(self, held: list[bool]) -> None:
        if self.rolls_used >= 3:
            raise ValueError("No rolls remaining this turn.")
        if self.game_over:
            raise ValueError("Game is over.")

        # On first roll of a turn, ignore held — roll all dice
        if self.rolls_used == 0:
            held = [False] * 5

        self.held = held
        for i in range(5):
            if not held[i]:
                self.dice[i] = random.randint(1, 6)
        self.rolls_used += 1

    def score(self, category: str) -> None:
        if self.game_over:
            raise ValueError("Game is over.")
        if category not in CATEGORIES:
            raise ValueError("Unknown scoring category.")
        if self.scores[category] is not None:
            raise ValueError("Category already scored.")
        if self.rolls_used == 0:
            raise ValueError("Must roll at least once before scoring.")

        self.scores[category] = _calculate_score(category, self.dice)

        # Advance round
        self.round += 1
        self.rolls_used = 0
        self.held = [False] * 5
        self.dice = [0, 0, 0, 0, 0]

        if self.round > 13:
            self.game_over = True

    def possible_scores(self) -> dict[str, int]:
        return {
            cat: _calculate_score(cat, self.dice) for cat in CATEGORIES if self.scores[cat] is None
        }

    def upper_subtotal(self) -> int:
        return sum(v for k, v in self.scores.items() if k in UPPER_CATEGORIES and v is not None)

    def upper_bonus(self) -> int:
        if all(self.scores[cat] is not None for cat in UPPER_CATEGORIES):
            return UPPER_BONUS_VALUE if self.upper_subtotal() >= UPPER_BONUS_THRESHOLD else 0
        return 0

    def total_score(self) -> int:
        filled = sum(v for v in self.scores.values() if v is not None)
        return filled + self.upper_bonus()


# --- Pure scoring functions ---


def _calculate_score(category: str, dice: list[int]) -> int:
    counts = Counter(dice)

    if category == "ones":
        return dice.count(1) * 1
    elif category == "twos":
        return dice.count(2) * 2
    elif category == "threes":
        return dice.count(3) * 3
    elif category == "fours":
        return dice.count(4) * 4
    elif category == "fives":
        return dice.count(5) * 5
    elif category == "sixes":
        return dice.count(6) * 6
    elif category == "three_of_a_kind":
        return sum(dice) if any(v >= 3 for v in counts.values()) else 0
    elif category == "four_of_a_kind":
        return sum(dice) if any(v >= 4 for v in counts.values()) else 0
    elif category == "full_house":
        vals = sorted(counts.values())
        return 25 if vals == [2, 3] else 0
    elif category == "small_straight":
        unique = sorted(set(dice))
        return 30 if _has_run(unique, 4) else 0
    elif category == "large_straight":
        unique = sorted(set(dice))
        return 40 if _has_run(unique, 5) else 0
    elif category == "yacht":
        return 50 if len(counts) == 1 else 0
    elif category == "chance":
        return sum(dice)
    return 0


def _has_run(unique_sorted: list[int], length: int) -> bool:
    run = 1
    for i in range(1, len(unique_sorted)):
        if unique_sorted[i] == unique_sorted[i - 1] + 1:
            run += 1
            if run >= length:
                return True
        else:
            run = 1
    return run >= length
