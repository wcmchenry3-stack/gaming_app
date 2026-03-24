"""
Yahtzee Game — Locust performance test entry point.

Three user classes covering distinct load scenarios:

  YahtzeeGameUser   — full 13-round game flow (sequential, --users 1 only)
  LeaderboardUser   — concurrent leaderboard read/write (--users 10)
  ReadOnlyUser      — polling GET endpoints (--users 20)

Usage examples:

  # Single-user game flow (local):
  locust -f perf/locustfile.py --headless --users 1 --spawn-rate 1 \
         --run-time 120s --host http://localhost:8000 \
         YahtzeeGameUser

  # Leaderboard concurrent load (local):
  locust -f perf/locustfile.py --headless --users 10 --spawn-rate 2 \
         --run-time 60s --host http://localhost:8000 \
         LeaderboardUser

  # All scenarios together (default):
  locust -f perf/locustfile.py --headless --users 5 --spawn-rate 1 \
         --run-time 60s --host http://localhost:8000 --csv perf-results

See backend/perf/thresholds.json for SLO definitions.
See docs/PERFORMANCE.md for full documentation.
"""

from locust import HttpUser, between

from scenarios.game_flow import GameFlowTasks
from scenarios.leaderboard import LeaderboardTasks
from scenarios.stateless_reads import StatelessReadTasks


class YahtzeeGameUser(HttpUser):
    """
    Simulates one player completing a full 13-round game.

    IMPORTANT: The backend has a single global game instance. Running this
    with more than 1 concurrent user will cause state collisions. Always
    run this class with --users 1. See docs/PERFORMANCE.md for details.
    """

    tasks = [GameFlowTasks]
    wait_time = between(0.5, 1.5)


class LeaderboardUser(HttpUser):
    """
    Simulates concurrent players submitting and reading leaderboard scores.
    These endpoints are the safest to test with multiple concurrent users.
    Run with --users 10 as the baseline.
    """

    tasks = [LeaderboardTasks]
    wait_time = between(0.5, 2)


class ReadOnlyUser(HttpUser):
    """
    Simulates a client polling game state. Establishes the latency floor.
    Run with --users 20 to measure read throughput.
    """

    tasks = [StatelessReadTasks]
    wait_time = between(1, 3)
