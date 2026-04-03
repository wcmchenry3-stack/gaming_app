import pytest
from game import YachtGame, _calculate_score

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_game(dice: list[int], rolls_used: int = 1) -> YachtGame:
    """Return a game with dice pre-set and rolls_used set (skips randomness)."""
    g = YachtGame()
    g.dice = dice
    g.rolls_used = rolls_used
    return g


# ---------------------------------------------------------------------------
# Upper section scoring
# ---------------------------------------------------------------------------


class TestUpperCategories:
    def test_ones_counts_ones(self):
        assert _calculate_score("ones", [1, 1, 2, 3, 4]) == 2

    def test_ones_none(self):
        assert _calculate_score("ones", [2, 3, 4, 5, 6]) == 0

    def test_twos(self):
        assert _calculate_score("twos", [2, 2, 2, 1, 1]) == 6

    def test_threes(self):
        assert _calculate_score("threes", [3, 3, 1, 1, 1]) == 6

    def test_fours(self):
        assert _calculate_score("fours", [4, 4, 4, 4, 2]) == 16

    def test_fives(self):
        assert _calculate_score("fives", [5, 5, 1, 2, 3]) == 10

    def test_sixes_all(self):
        assert _calculate_score("sixes", [6, 6, 6, 6, 6]) == 30

    def test_sixes_none(self):
        assert _calculate_score("sixes", [1, 2, 3, 4, 5]) == 0


# ---------------------------------------------------------------------------
# Lower section scoring
# ---------------------------------------------------------------------------


class TestThreeOfAKind:
    def test_hit(self):
        assert _calculate_score("three_of_a_kind", [3, 3, 3, 1, 2]) == 12

    def test_four_also_qualifies(self):
        assert _calculate_score("three_of_a_kind", [4, 4, 4, 4, 1]) == 17

    def test_yacht_also_qualifies(self):
        assert _calculate_score("three_of_a_kind", [5, 5, 5, 5, 5]) == 25

    def test_miss(self):
        assert _calculate_score("three_of_a_kind", [1, 2, 3, 4, 5]) == 0


class TestFourOfAKind:
    def test_hit(self):
        assert _calculate_score("four_of_a_kind", [6, 6, 6, 6, 2]) == 26

    def test_yacht_also_qualifies(self):
        assert _calculate_score("four_of_a_kind", [3, 3, 3, 3, 3]) == 15

    def test_miss_three(self):
        assert _calculate_score("four_of_a_kind", [2, 2, 2, 1, 3]) == 0


class TestFullHouse:
    def test_hit(self):
        assert _calculate_score("full_house", [2, 2, 3, 3, 3]) == 25

    def test_hit_reversed(self):
        assert _calculate_score("full_house", [6, 6, 6, 1, 1]) == 25

    def test_miss_four_of_a_kind(self):
        assert _calculate_score("full_house", [4, 4, 4, 4, 1]) == 0

    def test_miss_yacht(self):
        assert _calculate_score("full_house", [5, 5, 5, 5, 5]) == 0

    def test_miss_no_pair(self):
        assert _calculate_score("full_house", [1, 2, 3, 4, 5]) == 0


class TestSmallStraight:
    def test_1234(self):
        assert _calculate_score("small_straight", [1, 2, 3, 4, 6]) == 30

    def test_2345(self):
        assert _calculate_score("small_straight", [2, 3, 4, 5, 1]) == 30

    def test_3456(self):
        assert _calculate_score("small_straight", [3, 4, 5, 6, 3]) == 30

    def test_with_duplicate(self):
        assert _calculate_score("small_straight", [1, 2, 3, 3, 4]) == 30

    def test_miss(self):
        assert _calculate_score("small_straight", [1, 2, 4, 5, 6]) == 0


class TestLargeStraight:
    def test_12345(self):
        assert _calculate_score("large_straight", [1, 2, 3, 4, 5]) == 40

    def test_23456(self):
        assert _calculate_score("large_straight", [2, 3, 4, 5, 6]) == 40

    def test_miss_small_only(self):
        assert _calculate_score("large_straight", [1, 2, 3, 4, 6]) == 0

    def test_miss_duplicate(self):
        assert _calculate_score("large_straight", [1, 2, 3, 3, 5]) == 0


class TestYacht:
    def test_hit(self):
        assert _calculate_score("yacht", [4, 4, 4, 4, 4]) == 50

    def test_miss(self):
        assert _calculate_score("yacht", [4, 4, 4, 4, 3]) == 0


class TestChance:
    def test_always_sums(self):
        assert _calculate_score("chance", [1, 2, 3, 4, 5]) == 15

    def test_max(self):
        assert _calculate_score("chance", [6, 6, 6, 6, 6]) == 30


# ---------------------------------------------------------------------------
# Roll logic
# ---------------------------------------------------------------------------


class TestRoll:
    def test_first_roll_sets_dice(self):
        g = YachtGame()
        g.roll([False] * 5)
        assert all(1 <= d <= 6 for d in g.dice)
        assert g.rolls_used == 1

    def test_first_roll_ignores_held(self):
        """Even if held=[True,...], first roll of a turn rerolls everything."""
        g = YachtGame()
        g.dice = [6, 6, 6, 6, 6]
        # Can't hold before rolling, but pass True anyway — should be ignored
        g.roll([True, True, True, True, True])
        # rolls_used went from 0→1, so held was forced False; dice were rerolled
        assert g.rolls_used == 1

    def test_held_dice_preserved(self):
        g = YachtGame()
        g.roll([False] * 5)  # first roll
        g.dice = [6, 6, 1, 1, 1]  # force known state
        g.roll([True, True, False, False, False])  # hold first two
        assert g.dice[0] == 6
        assert g.dice[1] == 6

    def test_rolls_used_increments(self):
        g = YachtGame()
        g.roll([False] * 5)
        assert g.rolls_used == 1
        g.roll([False] * 5)
        assert g.rolls_used == 2

    def test_cannot_roll_after_three(self):
        g = YachtGame()
        for _ in range(3):
            g.roll([False] * 5)
        with pytest.raises(ValueError, match="No rolls remaining"):
            g.roll([False] * 5)

    def test_cannot_roll_when_game_over(self):
        g = make_game([1, 1, 1, 1, 1])
        g.game_over = True
        with pytest.raises(ValueError, match="Game is over"):
            g.roll([False] * 5)


# ---------------------------------------------------------------------------
# Scoring / round logic
# ---------------------------------------------------------------------------


class TestScoring:
    def test_score_records_value(self):
        g = make_game([1, 1, 1, 2, 3])
        g.score("ones")
        assert g.scores["ones"] == 3

    def test_score_advances_round(self):
        g = make_game([1, 1, 1, 2, 3])
        g.score("ones")
        assert g.round == 2

    def test_score_resets_rolls_and_dice(self):
        g = make_game([1, 1, 1, 2, 3])
        g.score("ones")
        assert g.rolls_used == 0
        assert g.dice == [0, 0, 0, 0, 0]

    def test_cannot_score_before_rolling(self):
        g = YachtGame()
        with pytest.raises(ValueError, match="Must roll"):
            g.score("ones")

    def test_cannot_score_duplicate(self):
        g = make_game([1, 1, 1, 2, 3])
        g.score("ones")
        g.dice = [1, 1, 1, 2, 3]
        g.rolls_used = 1
        with pytest.raises(ValueError, match="already scored"):
            g.score("ones")

    def test_unknown_category_raises(self):
        g = make_game([1, 2, 3, 4, 5])
        with pytest.raises(ValueError, match="Unknown scoring category"):
            g.score("bogus")

    def test_game_over_after_13_rounds(self):
        g = YachtGame()
        for cat in [
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
        ]:
            g.dice = [1, 2, 3, 4, 5]
            g.rolls_used = 1
            g.score(cat)
        assert g.game_over is True
        assert g.round == 14

    def test_cannot_score_when_game_over(self):
        g = make_game([1, 2, 3, 4, 5])
        g.game_over = True
        with pytest.raises(ValueError, match="Game is over"):
            g.score("ones")


# ---------------------------------------------------------------------------
# Upper bonus
# ---------------------------------------------------------------------------


class TestUpperBonus:
    def _fill_upper(self, g: YachtGame, ones=3, twos=6, threes=9, fours=12, fives=15, sixes=18):
        """Directly set upper scores to given values (default sums to 63)."""
        g.scores["ones"] = ones
        g.scores["twos"] = twos
        g.scores["threes"] = threes
        g.scores["fours"] = fours
        g.scores["fives"] = fives
        g.scores["sixes"] = sixes

    def test_bonus_triggers_at_63(self):
        g = YachtGame()
        self._fill_upper(g)  # default = 63
        assert g.upper_bonus() == 35

    def test_bonus_triggers_above_63(self):
        g = YachtGame()
        self._fill_upper(g, sixes=30)  # 3+6+9+12+15+30 = 75
        assert g.upper_bonus() == 35

    def test_no_bonus_below_63(self):
        g = YachtGame()
        self._fill_upper(g, ones=0)  # 0+6+9+12+15+18 = 60
        assert g.upper_bonus() == 0

    def test_no_bonus_while_upper_incomplete(self):
        g = YachtGame()
        g.scores["ones"] = 3  # only ones filled
        assert g.upper_bonus() == 0

    def test_total_score_includes_bonus(self):
        g = YachtGame()
        self._fill_upper(g)  # 63 pts → +35 bonus
        g.scores["chance"] = 20
        assert g.total_score() == 63 + 35 + 20


# ---------------------------------------------------------------------------
# possible_scores
# ---------------------------------------------------------------------------


class TestPossibleScores:
    def test_returns_only_unfilled(self):
        g = make_game([1, 1, 1, 2, 3])
        g.scores["ones"] = 3  # already filled
        ps = g.possible_scores()
        assert "ones" not in ps
        assert "twos" in ps

    def test_correct_value(self):
        g = make_game([6, 6, 6, 6, 6])
        ps = g.possible_scores()
        assert ps["yacht"] == 50
        assert ps["sixes"] == 30
        assert ps["chance"] == 30


# ---------------------------------------------------------------------------
# Yacht bonus (multiple Yachts)
# ---------------------------------------------------------------------------


class TestYachtBonus:
    def test_no_bonus_on_first_yacht(self):
        g = make_game([4, 4, 4, 4, 4])
        g.score("yacht")
        assert g.yacht_bonus_count == 0
        assert g.scores["yacht"] == 50

    def test_bonus_awarded_on_second_yacht(self):
        g = make_game([4, 4, 4, 4, 4])
        g.scores["yacht"] = 50  # already scored yacht
        g.score("fours")  # joker: must go to corresponding upper
        assert g.yacht_bonus_count == 1

    def test_multiple_bonuses_accumulate(self):
        g = make_game([3, 3, 3, 3, 3])
        g.scores["yacht"] = 50
        g.scores["threes"] = 9  # upper already filled
        g.score("three_of_a_kind")  # joker → lower
        assert g.yacht_bonus_count == 1

        g.dice = [3, 3, 3, 3, 3]
        g.rolls_used = 1
        g.score("four_of_a_kind")
        assert g.yacht_bonus_count == 2

    def test_no_bonus_when_yacht_scratched(self):
        """If yacht was scored as 0 (scratched), no bonus ever."""
        g = make_game([3, 3, 3, 3, 3])
        g.scores["yacht"] = 0  # scratched
        g.score("threes")  # normal scoring, no joker
        assert g.yacht_bonus_count == 0

    def test_bonus_included_in_total_score(self):
        g = YachtGame()
        g.scores["yacht"] = 50
        g.yacht_bonus_count = 2
        g.scores["chance"] = 20
        assert g.yacht_bonus_total() == 200
        assert g.total_score() == 50 + 20 + 200  # no upper bonus (incomplete)

    def test_yacht_bonus_total_property(self):
        g = YachtGame()
        g.yacht_bonus_count = 3
        assert g.yacht_bonus_total() == 300


# ---------------------------------------------------------------------------
# Joker rule
# ---------------------------------------------------------------------------


class TestJokerRule:
    def test_joker_must_use_corresponding_upper_if_open(self):
        """Priority 1: five 4s must go in Fours if open."""
        g = make_game([4, 4, 4, 4, 4])
        g.scores["yacht"] = 50
        with pytest.raises(ValueError, match="must score in the corresponding upper"):
            g.score("chance")

    def test_joker_corresponding_upper_scores_correctly(self):
        g = make_game([4, 4, 4, 4, 4])
        g.scores["yacht"] = 50
        g.score("fours")
        assert g.scores["fours"] == 20  # 4 × 5

    def test_joker_lower_section_when_upper_filled(self):
        """Priority 2: if corresponding upper is filled, must go to open lower."""
        g = make_game([5, 5, 5, 5, 5])
        g.scores["yacht"] = 50
        g.scores["fives"] = 15  # corresponding upper already filled
        g.score("full_house")  # joker into lower at full value
        assert g.scores["full_house"] == 25

    def test_joker_lower_small_straight_value(self):
        g = make_game([6, 6, 6, 6, 6])
        g.scores["yacht"] = 50
        g.scores["sixes"] = 18
        g.score("small_straight")
        assert g.scores["small_straight"] == 30

    def test_joker_lower_large_straight_value(self):
        g = make_game([1, 1, 1, 1, 1])
        g.scores["yacht"] = 50
        g.scores["ones"] = 3
        g.score("large_straight")
        assert g.scores["large_straight"] == 40

    def test_joker_lower_three_of_a_kind_sum(self):
        g = make_game([6, 6, 6, 6, 6])
        g.scores["yacht"] = 50
        g.scores["sixes"] = 18
        g.score("three_of_a_kind")
        assert g.scores["three_of_a_kind"] == 30  # sum of dice

    def test_joker_lower_chance_sum(self):
        g = make_game([3, 3, 3, 3, 3])
        g.scores["yacht"] = 50
        g.scores["threes"] = 9
        g.score("chance")
        assert g.scores["chance"] == 15

    def test_joker_cannot_pick_upper_when_lower_open(self):
        """If lower categories are open, cannot pick an upper category."""
        g = make_game([4, 4, 4, 4, 4])
        g.scores["yacht"] = 50
        g.scores["fours"] = 16  # corresponding upper filled
        with pytest.raises(ValueError, match="must score in an open lower"):
            g.score("ones")

    def test_joker_upper_fallback_when_all_lower_filled(self):
        """Priority 3: if all lower filled, any open upper is fine."""
        g = make_game([2, 2, 2, 2, 2])
        g.scores["yacht"] = 50
        g.scores["twos"] = 6  # corresponding upper filled
        for cat in ["three_of_a_kind", "four_of_a_kind", "full_house",
                     "small_straight", "large_straight", "chance"]:
            g.scores[cat] = 0
        g.score("ones")  # fallback to any open upper
        assert g.scores["ones"] == 0  # five 2s → ones = 0

    def test_possible_scores_joker_priority_1(self):
        """possible_scores returns only the mandatory upper category."""
        g = make_game([3, 3, 3, 3, 3])
        g.scores["yacht"] = 50
        ps = g.possible_scores()
        assert ps == {"threes": 15}

    def test_possible_scores_joker_priority_2(self):
        """possible_scores returns open lower categories at joker values."""
        g = make_game([6, 6, 6, 6, 6])
        g.scores["yacht"] = 50
        g.scores["sixes"] = 18
        ps = g.possible_scores()
        assert "full_house" in ps
        assert ps["full_house"] == 25
        assert ps["large_straight"] == 40
        assert ps["small_straight"] == 30
        assert "yacht" not in ps  # already scored

    def test_possible_scores_joker_priority_3(self):
        """When all lower filled, returns open upper categories."""
        g = make_game([4, 4, 4, 4, 4])
        g.scores["yacht"] = 50
        g.scores["fours"] = 16
        for cat in ["three_of_a_kind", "four_of_a_kind", "full_house",
                     "small_straight", "large_straight", "chance"]:
            g.scores[cat] = 0
        ps = g.possible_scores()
        assert "ones" in ps
        assert "fours" not in ps

    def test_not_joker_when_yacht_not_scored_yet(self):
        """Normal scoring when yacht hasn't been scored at all."""
        g = make_game([5, 5, 5, 5, 5])
        ps = g.possible_scores()
        assert ps["yacht"] == 50
        assert len(ps) == 13

    def test_not_joker_when_yacht_scratched(self):
        """No joker when yacht was scored as 0."""
        g = make_game([2, 2, 2, 2, 2])
        g.scores["yacht"] = 0  # scratched
        ps = g.possible_scores()
        assert "twos" in ps
        assert ps["twos"] == 10
        assert ps["full_house"] == 0
