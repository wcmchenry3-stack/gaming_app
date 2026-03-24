"""
Scenario C: Read-only polling.

Simulates a client keeping the tab open and polling for game state.
These endpoints should be the fastest in the system — they establish
the latency floor for SLO calibration.

Requires an active game: run after POST /game/new.
"""

from locust import TaskSet, task


class StatelessReadTasks(TaskSet):
    def on_start(self):
        """Ensure a game exists before polling."""
        self.client.post("/game/new", name="POST /game/new (setup)")

    @task(3)
    def get_state(self):
        with self.client.get("/game/state", name="GET /game/state") as resp:
            resp.raise_for_status()

    @task(1)
    def get_possible_scores(self):
        # possible-scores returns empty dict before rolling — that's valid (200)
        with self.client.get(
            "/game/possible-scores",
            name="GET /game/possible-scores",
        ) as resp:
            resp.raise_for_status()
