"""
Property-based tests using Hypothesis.

These tests assert invariants that should hold for *any* valid input — not
just specific hand-crafted examples.  Hypothesis generates hundreds of cases
and automatically shrinks failures to the minimal counterexample.

Run with the CI profile (200 examples) by setting HYPOTHESIS_PROFILE=ci.
Default dev profile runs 50 examples for faster local iteration.
"""

import os

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from game import CATEGORIES, YahtzeeGame, _calculate_score

# ---------------------------------------------------------------------------
# Hypothesis profiles
# ---------------------------------------------------------------------------

settings.register_profile(
    "ci",
    max_examples=200,
    suppress_health_check=[HealthCheck.too_slow],
)
settings.register_profile(
    "dev",
    max_examples=50,
)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "dev"))

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Five dice, each in [1, 6]
dice_st = st.lists(st.integers(min_value=1, max_value=6), min_size=5, max_size=5)

# A single valid category name
category_st = st.sampled_from(CATEGORIES)

# A list of five hold booleans
held_st = st.lists(st.booleans(), min_size=5, max_size=5)

# A permutation of all 13 categories (for full-game tests)
all_categories_st = st.permutations(CATEGORIES)


# ---------------------------------------------------------------------------
# Scoring function invariants
# ---------------------------------------------------------------------------


@given(dice=dice_st, category=category_st)
def test_score_always_non_negative(dice, category):
    """No scoring function ever returns a negative value."""
    assert _calculate_score(category, dice) >= 0


@given(dice=dice_st)
def test_chance_always_equals_sum(dice):
    """Chance must equal the sum of all dice — no exceptions."""
    assert _calculate_score("chance", dice) == sum(dice)


@given(dice=dice_st)
def test_yahtzee_is_binary(dice):
    """Yahtzee score is either 50 or 0."""
    result = _calculate_score("yahtzee", dice)
    assert result in (0, 50)


@given(dice=dice_st)
def test_full_house_is_binary(dice):
    """Full house score is either 25 or 0."""
    result = _calculate_score("full_house", dice)
    assert result in (0, 25)


@given(dice=dice_st)
def test_small_straight_is_binary(dice):
    """Small straight score is either 30 or 0."""
    result = _calculate_score("small_straight", dice)
    assert result in (0, 30)


@given(dice=dice_st)
def test_large_straight_is_binary(dice):
    """Large straight score is either 40 or 0."""
    result = _calculate_score("large_straight", dice)
    assert result in (0, 40)


@given(dice=dice_st)
def test_three_of_a_kind_is_sum_or_zero(dice):
    """When three_of_a_kind fires it equals the sum; otherwise it is 0."""
    tok = _calculate_score("three_of_a_kind", dice)
    chance = _calculate_score("chance", dice)
    assert tok in (0, chance)


@given(dice=dice_st)
def test_four_of_a_kind_is_sum_or_zero(dice):
    """When four_of_a_kind fires it equals the sum; otherwise it is 0."""
    fok = _calculate_score("four_of_a_kind", dice)
    chance = _calculate_score("chance", dice)
    assert fok in (0, chance)


@given(dice=dice_st)
def test_upper_categories_bounded_by_five_times_face(dice):
    """Each upper category score never exceeds 5 × the face value."""
    bounds = {
        "ones": 5,
        "twos": 10,
        "threes": 15,
        "fours": 20,
        "fives": 25,
        "sixes": 30,
    }
    for cat, bound in bounds.items():
        assert _calculate_score(cat, dice) <= bound


@given(dice=dice_st)
def test_upper_categories_non_negative(dice):
    """Upper category scores are always >= 0."""
    for cat in ("ones", "twos", "threes", "fours", "fives", "sixes"):
        assert _calculate_score(cat, dice) >= 0


@given(dice=dice_st)
def test_three_of_a_kind_never_exceeds_four_of_a_kind_score(dice):
    """three_of_a_kind and four_of_a_kind both return sum-or-zero,
    so their scores are always equal when nonzero."""
    tok = _calculate_score("three_of_a_kind", dice)
    fok = _calculate_score("four_of_a_kind", dice)
    # If four_of_a_kind fires, three_of_a_kind must also fire (superset condition)
    if fok > 0:
        assert tok > 0
        assert tok == fok  # both equal sum(dice)


# ---------------------------------------------------------------------------
# Roll invariants
# ---------------------------------------------------------------------------


@given(held=held_st)
def test_roll_always_produces_valid_dice(held):
    """After any roll, all dice are in [1, 6]."""
    g = YahtzeeGame()
    g.roll(held)  # first roll ignores held; rolls_used goes 0→1
    assert all(1 <= d <= 6 for d in g.dice)
    assert g.rolls_used == 1


@given(held=held_st)
def test_second_roll_preserves_held_dice(held):
    """On the second roll, dice flagged held must keep their first-roll value."""
    g = YahtzeeGame()
    g.roll([False] * 5)  # first roll — sets dice
    first_dice = g.dice[:]
    g.roll(held)  # second roll — respects held
    for i, h in enumerate(held):
        if h:
            assert (
                g.dice[i] == first_dice[i]
            ), f"Die {i} should have been held at {first_dice[i]} but became {g.dice[i]}"


# ---------------------------------------------------------------------------
# Game state machine invariants
# ---------------------------------------------------------------------------


@given(categories=all_categories_st)
def test_scoring_all_13_categories_always_ends_game(categories):
    """Scoring every category in any order always produces game_over=True."""
    g = YahtzeeGame()
    for cat in categories:
        g.dice = [1, 2, 3, 4, 5]  # valid dice; value doesn't affect termination
        g.rolls_used = 1
        g.score(cat)
    assert g.game_over is True
    assert g.round == 14


@given(categories=all_categories_st)
def test_all_scores_filled_after_full_game(categories):
    """After a full 13-round game all score slots are filled (not None)."""
    g = YahtzeeGame()
    for cat in categories:
        g.dice = [1, 2, 3, 4, 5]
        g.rolls_used = 1
        g.score(cat)
    assert all(v is not None for v in g.scores.values())


@given(dice=dice_st, category=category_st)
def test_possible_scores_value_matches_calculate_score(dice, category):
    """possible_scores() must return the same value as _calculate_score() directly."""
    g = YahtzeeGame()
    g.dice = dice
    g.rolls_used = 1
    # Only check unfilled categories (all are unfilled on a fresh game)
    ps = g.possible_scores()
    assert ps[category] == _calculate_score(category, dice)


@given(dice=dice_st)
def test_total_score_is_non_negative_at_any_point(dice):
    """total_score never goes negative regardless of what categories are scored."""
    g = YahtzeeGame()
    for cat in CATEGORIES:
        g.dice = dice
        g.rolls_used = 1
        g.score(cat)
        assert g.total_score() >= 0


@given(categories=all_categories_st)
def test_upper_bonus_correct_at_game_end(categories):
    """Upper bonus is 35 iff all upper categories are filled and subtotal >= 63."""
    g = YahtzeeGame()
    for cat in categories:
        g.dice = [1, 2, 3, 4, 5]
        g.rolls_used = 1
        g.score(cat)
    if g.upper_subtotal() >= 63:
        assert g.upper_bonus() == 35
    else:
        assert g.upper_bonus() == 0
