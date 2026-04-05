import pytest
from fastapi.testclient import TestClient
import cascade.router as cascade_router_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_leaderboard():
    cascade_router_module.reset_leaderboard()
    yield
    cascade_router_module.reset_leaderboard()


def _submit(player_name: str, score: int):
    return client.post("/cascade/score", json={"player_name": player_name, "score": score})


# ---------------------------------------------------------------------------
# POST /cascade/score
# ---------------------------------------------------------------------------


class TestSubmitScore:
    def test_valid_submission_returns_201(self):
        res = _submit("Alice", 500)
        assert res.status_code == 201
        body = res.json()
        assert body["player_name"] == "Alice"
        assert body["score"] == 500
        assert body["rank"] == 1  # first entry

    def test_missing_player_name_returns_422(self):
        res = client.post("/cascade/score", json={"score": 100})
        assert res.status_code == 422

    def test_missing_score_returns_422(self):
        res = client.post("/cascade/score", json={"player_name": "Bob"})
        assert res.status_code == 422

    def test_empty_player_name_returns_422(self):
        res = _submit("", 100)
        assert res.status_code == 422

    def test_negative_score_returns_422(self):
        res = _submit("Alice", -1)
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# GET /cascade/scores
# ---------------------------------------------------------------------------


class TestGetScores:
    def test_empty_initially(self):
        res = client.get("/cascade/scores")
        assert res.status_code == 200
        assert res.json()["scores"] == []

    def test_returns_submitted_entries(self):
        _submit("Alice", 300)
        _submit("Bob", 100)
        res = client.get("/cascade/scores")
        scores = res.json()["scores"]
        assert len(scores) == 2

    def test_ordered_by_score_descending(self):
        _submit("Alice", 100)
        _submit("Bob", 500)
        _submit("Carol", 250)
        scores = client.get("/cascade/scores").json()["scores"]
        assert scores[0]["score"] == 500
        assert scores[1]["score"] == 250
        assert scores[2]["score"] == 100

    def test_capped_at_ten_entries(self):
        from limiter import limiter

        for i in range(15):
            limiter.reset()  # bypass rate limit — this test targets cap logic, not limiting
            _submit(f"Player{i}", i * 10)
        scores = client.get("/cascade/scores").json()["scores"]
        assert len(scores) == 10
        assert scores[0]["score"] == 140  # top score kept


# ---------------------------------------------------------------------------
# Rank in submission response
# ---------------------------------------------------------------------------


class TestSubmitRank:
    def test_first_submission_rank_1(self):
        assert _submit("Alice", 500).json()["rank"] == 1

    def test_lower_score_ranked_lower(self):
        from limiter import limiter

        limiter.reset()
        _submit("Alice", 500)
        limiter.reset()
        body = _submit("Bob", 200).json()
        assert body["rank"] == 2

    def test_highest_score_takes_rank_1(self):
        from limiter import limiter

        limiter.reset()
        _submit("Alice", 200)
        limiter.reset()
        body = _submit("Bob", 500).json()
        assert body["rank"] == 1

    def test_middle_insert(self):
        from limiter import limiter

        for name, score in [("A", 500), ("B", 300), ("C", 100)]:
            limiter.reset()
            _submit(name, score)
        limiter.reset()
        body = _submit("Middle", 400).json()
        # 500, 400, 300, 100 → Middle is rank 2
        assert body["rank"] == 2

    def test_new_tie_ranks_below_existing(self):
        from limiter import limiter

        limiter.reset()
        _submit("Alice", 500)
        limiter.reset()
        body = _submit("Tied", 500).json()
        # Stable sort: older entry stays first, new entry takes rank 2.
        assert body["rank"] == 2

    def test_off_leaderboard_returns_rank_11(self):
        """Submit 10 high scores then an 11th lower one — rank should be 11."""
        from limiter import limiter

        for i in range(10):
            limiter.reset()
            _submit(f"Top{i}", 1000)
        limiter.reset()
        body = _submit("Lowly", 1).json()
        assert body["rank"] == 11

    def test_middle_insert_renumbers_tail(self):
        """Inserting into the middle shifts everyone below by one rank."""
        from limiter import limiter

        for name, score in [("A", 500), ("B", 300), ("C", 100)]:
            limiter.reset()
            _submit(name, score)
        limiter.reset()
        _submit("Middle", 400)
        scores = client.get("/cascade/scores").json()["scores"]
        # A@500 rank=1, Middle@400 rank=2, B@300 rank=3, C@100 rank=4
        ranks_by_name = {s["player_name"]: s["rank"] for s in scores}
        assert ranks_by_name == {"A": 1, "Middle": 2, "B": 3, "C": 4}

    def test_leaderboard_returns_sequential_ranks(self):
        from limiter import limiter

        for name, score in [("A", 500), ("B", 300), ("C", 100)]:
            limiter.reset()
            _submit(name, score)
        scores = client.get("/cascade/scores").json()["scores"]
        assert [s["rank"] for s in scores] == [1, 2, 3]
