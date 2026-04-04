"""
Scenario C: Read-only polling.

Simulates a client keeping the tab open and polling for game state.
These endpoints should be the fastest in the system — they establish
the latency floor for SLO calibration.

Requires an active game: run after POST /yacht/new.
"""

import uuid

from locust import TaskSet, task


class StatelessReadTasks(TaskSet):
    def on_start(self):
        """Ensure a game exists before polling."""
        self._session_id = str(uuid.uuid4())
        self._headers = {"X-Session-ID": self._session_id}
        self.client.post("/yacht/new", headers=self._headers, name="POST /yacht/new (setup)")

    @task(3)
    def get_state(self):
        with self.client.get("/yacht/state", headers=self._headers, name="GET /yacht/state") as resp:
            resp.raise_for_status()

    @task(1)
    def get_possible_scores(self):
        # possible-scores returns empty dict before rolling — that's valid (200)
        with self.client.get(
            "/yacht/possible-scores",
            headers=self._headers,
            name="GET /yacht/possible-scores",
        ) as resp:
            resp.raise_for_status()
