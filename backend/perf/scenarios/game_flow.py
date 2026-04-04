"""
Scenario A: Full Yacht game flow (sequential, single user).

Each user generates a unique session ID so multiple concurrent users
don't collide on shared game state.
"""

import uuid

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
    "yacht",
    "chance",
]


class GameFlowTasks(SequentialTaskSet):
    """Complete a full 13-round Yacht game sequentially."""

    def on_start(self):
        self._round = 0
        self._session_id = str(uuid.uuid4())
        self._headers = {"X-Session-ID": self._session_id}

    @task
    def new_game(self):
        with self.client.post("/yacht/new", headers=self._headers, name="POST /yacht/new") as resp:
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
        with self.client.get(
            "/yacht/state", headers=self._headers, name="GET /yacht/state (final)"
        ) as resp:
            resp.raise_for_status()
            data = resp.json()
            if not data.get("game_over"):
                resp.failure("Expected game_over=true after 13 rounds")

    def _play_round(self, round_index: int):
        """Roll once, check possible scores, then score the given category."""
        held = [False, False, False, False, False]

        with self.client.post(
            "/yacht/roll",
            json={"held": held},
            headers=self._headers,
            name="POST /yacht/roll",
        ) as resp:
            resp.raise_for_status()

        with self.client.get(
            "/yacht/possible-scores",
            headers=self._headers,
            name="GET /yacht/possible-scores",
        ) as resp:
            resp.raise_for_status()

        with self.client.post(
            "/yacht/score",
            json={"category": CATEGORIES[round_index]},
            headers=self._headers,
            name="POST /yacht/score",
        ) as resp:
            resp.raise_for_status()
