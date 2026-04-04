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
LOWER_CATEGORIES = {
    "three_of_a_kind",
    "four_of_a_kind",
    "full_house",
    "small_straight",
    "large_straight",
    "yacht",
    "chance",
}
UPPER_BONUS_THRESHOLD = 63
UPPER_BONUS_VALUE = 35
YACHT_BONUS_VALUE = 100

# Maps die face value → corresponding upper category
_FACE_TO_UPPER = {1: "ones", 2: "twos", 3: "threes", 4: "fours", 5: "fives", 6: "sixes"}


@dataclass
class YachtGame:
    dice: list[int] = field(default_factory=lambda: [0, 0, 0, 0, 0])
    held: list[bool] = field(default_factory=lambda: [False] * 5)
    rolls_used: int = 0
    round: int = 1
    scores: dict[str, Optional[int]] = field(
        default_factory=lambda: {cat: None for cat in CATEGORIES}
    )
    yacht_bonus_count: int = 0
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

    def _is_yacht(self) -> bool:
        """True when all five dice show the same face."""
        return len(Counter(self.dice)) == 1 and self.dice[0] != 0

    def _joker_active(self) -> bool:
        """True when the current dice are a yacht AND the yacht category
        already holds 50 (i.e. not scratched)."""
        return self._is_yacht() and self.scores["yacht"] == 50

    def score(self, category: str) -> None:
        if self.game_over:
            raise ValueError("Game is over.")
        if category not in CATEGORIES:
            raise ValueError("Unknown scoring category.")
        if self.scores[category] is not None:
            raise ValueError("Category already scored.")
        if self.rolls_used == 0:
            raise ValueError("Must roll at least once before scoring.")

        joker = self._joker_active()

        if joker:
            # Award the 100-point bonus
            self.yacht_bonus_count += 1

            # Joker rule: enforce placement priority
            face = self.dice[0]
            upper_cat = _FACE_TO_UPPER[face]

            if self.scores[upper_cat] is None:
                # Priority 1: MUST use corresponding upper category
                if category != upper_cat:
                    raise ValueError("Joker rule: must score in the corresponding upper category.")
            else:
                # Priority 2 & 3: any open lower, then any open upper
                open_lower = [
                    c for c in LOWER_CATEGORIES if c != "yacht" and self.scores[c] is None
                ]
                if open_lower:
                    if category not in LOWER_CATEGORIES or category == "yacht":
                        # Check if they picked an upper category when lower is available
                        if category in UPPER_CATEGORIES:
                            raise ValueError(
                                "Joker rule: must score in an open lower-section category."
                            )
                # (If no open lower, any open category is fine — Priority 3/4)

            # Calculate the score — joker allows full face values for lower categories
            self.scores[category] = _calculate_joker_score(category, self.dice)
        else:
            self.scores[category] = _calculate_score(category, self.dice)

        # Advance round
        self.round += 1
        self.rolls_used = 0
        self.held = [False] * 5
        self.dice = [0, 0, 0, 0, 0]

        if self.round > 13:
            self.game_over = True

    def possible_scores(self) -> dict[str, int]:
        if self._joker_active():
            return self._joker_possible_scores()
        return {
            cat: _calculate_score(cat, self.dice) for cat in CATEGORIES if self.scores[cat] is None
        }

    def _joker_possible_scores(self) -> dict[str, int]:
        """Return scoreable categories under the Joker rule."""
        face = self.dice[0]
        upper_cat = _FACE_TO_UPPER[face]

        # Priority 1: corresponding upper category is mandatory if open
        if self.scores[upper_cat] is None:
            return {upper_cat: _calculate_joker_score(upper_cat, self.dice)}

        # Priority 2: any open lower-section category (except yacht) at full value
        open_lower = {
            cat: _calculate_joker_score(cat, self.dice)
            for cat in LOWER_CATEGORIES
            if cat != "yacht" and self.scores[cat] is None
        }
        if open_lower:
            return open_lower

        # Priority 3: any remaining open upper-section category
        open_upper = {
            cat: _calculate_joker_score(cat, self.dice)
            for cat in UPPER_CATEGORIES
            if self.scores[cat] is None
        }
        if open_upper:
            return open_upper

        # Priority 4: nothing open (shouldn't happen — game would be over)
        return {}

    def upper_subtotal(self) -> int:
        return sum(v for k, v in self.scores.items() if k in UPPER_CATEGORIES and v is not None)

    def upper_bonus(self) -> int:
        if all(self.scores[cat] is not None for cat in UPPER_CATEGORIES):
            return UPPER_BONUS_VALUE if self.upper_subtotal() >= UPPER_BONUS_THRESHOLD else 0
        return 0

    def yacht_bonus_total(self) -> int:
        return self.yacht_bonus_count * YACHT_BONUS_VALUE

    def total_score(self) -> int:
        filled = sum(v for v in self.scores.values() if v is not None)
        return filled + self.upper_bonus() + self.yacht_bonus_total()


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


def _calculate_joker_score(category: str, dice: list[int]) -> int:
    """Score a category under the Joker rule (all dice show same face).

    Upper categories score normally (sum of matching dice).
    Lower categories score at full face value as if the pattern matched.
    """
    if category in UPPER_CATEGORIES:
        return _calculate_score(category, dice)
    # Lower-section joker values
    if category == "three_of_a_kind":
        return sum(dice)
    elif category == "four_of_a_kind":
        return sum(dice)
    elif category == "full_house":
        return 25
    elif category == "small_straight":
        return 30
    elif category == "large_straight":
        return 40
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
