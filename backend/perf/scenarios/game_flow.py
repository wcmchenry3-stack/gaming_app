"""
Scenario A: Full Yahtzee game flow (sequential, single user).

The backend has one global game instance — running this with more than 1
concurrent user will cause state collisions. Use --users 1 for this scenario.
"""
from locust import SequentialTaskSet, task

# All 13 scoring categories in order. The flow picks one per round regardless
# of dice values — the goal is latency measurement, not game strategy.
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
    "yahtzee",
    "chance",
]


class GameFlowTasks(SequentialTaskSet):
    """Complete a full 13-round Yahtzee game sequentially."""

    def on_start(self):
        self._round = 0

    @task
    def new_game(self):
        with self.client.post("/game/new", name="POST /game/new") as resp:
            resp.raise_for_status()
        self._round = 0

    @task
    def play_round_1(self):
        self._play_round(0)

    @task
    def play_round_2(self):
        self._play_round(1)

    @task
    def play_round_3(self):
        self._play_round(2)

    @task
    def play_round_4(self):
        self._play_round(3)

    @task
    def play_round_5(self):
        self._play_round(4)

    @task
    def play_round_6(self):
        self._play_round(5)

    @task
    def play_round_7(self):
        self._play_round(6)

    @task
    def play_round_8(self):
        self._play_round(7)

    @task
    def play_round_9(self):
        self._play_round(8)

    @task
    def play_round_10(self):
        self._play_round(9)

    @task
    def play_round_11(self):
        self._play_round(10)

    @task
    def play_round_12(self):
        self._play_round(11)

    @task
    def play_round_13(self):
        self._play_round(12)

    @task
    def verify_game_over(self):
        with self.client.get("/game/state", name="GET /game/state (final)") as resp:
            resp.raise_for_status()
            data = resp.json()
            if not data.get("game_over"):
                resp.failure("Expected game_over=true after 13 rounds")

    def _play_round(self, round_index: int):
        """Roll once, check possible scores, then score the given category."""
        held = [False, False, False, False, False]

        with self.client.post(
            "/game/roll",
            json={"held": held},
            name="POST /game/roll",
        ) as resp:
            resp.raise_for_status()

        with self.client.get(
            "/game/possible-scores",
            name="GET /game/possible-scores",
        ) as resp:
            resp.raise_for_status()

        with self.client.post(
            "/game/score",
            json={"category": CATEGORIES[round_index]},
            name="POST /game/score",
        ) as resp:
            resp.raise_for_status()
