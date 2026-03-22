import pytest
from fastapi.testclient import TestClient
import fruit_merge.router as fruit_merge_router_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_leaderboard():
    fruit_merge_router_module.reset_leaderboard()
    yield
    fruit_merge_router_module.reset_leaderboard()


def _submit(player_name: str, score: int):
    return client.post("/fruit-merge/score", json={"player_name": player_name, "score": score})


# ---------------------------------------------------------------------------
# POST /fruit-merge/score
# ---------------------------------------------------------------------------

class TestSubmitScore:
    def test_valid_submission_returns_201(self):
        res = _submit("Alice", 500)
        assert res.status_code == 201
        body = res.json()
        assert body["player_name"] == "Alice"
        assert body["score"] == 500

    def test_missing_player_name_returns_422(self):
        res = client.post("/fruit-merge/score", json={"score": 100})
        assert res.status_code == 422

    def test_missing_score_returns_422(self):
        res = client.post("/fruit-merge/score", json={"player_name": "Bob"})
        assert res.status_code == 422

    def test_empty_player_name_returns_422(self):
        res = _submit("", 100)
        assert res.status_code == 422

    def test_negative_score_returns_422(self):
        res = _submit("Alice", -1)
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# GET /fruit-merge/scores
# ---------------------------------------------------------------------------

class TestGetScores:
    def test_empty_initially(self):
        res = client.get("/fruit-merge/scores")
        assert res.status_code == 200
        assert res.json()["scores"] == []

    def test_returns_submitted_entries(self):
        _submit("Alice", 300)
        _submit("Bob", 100)
        res = client.get("/fruit-merge/scores")
        scores = res.json()["scores"]
        assert len(scores) == 2

    def test_ordered_by_score_descending(self):
        _submit("Alice", 100)
        _submit("Bob", 500)
        _submit("Carol", 250)
        scores = client.get("/fruit-merge/scores").json()["scores"]
        assert scores[0]["score"] == 500
        assert scores[1]["score"] == 250
        assert scores[2]["score"] == 100

    def test_capped_at_ten_entries(self):
        for i in range(15):
            _submit(f"Player{i}", i * 10)
        scores = client.get("/fruit-merge/scores").json()["scores"]
        assert len(scores) == 10
        assert scores[0]["score"] == 140  # top score kept
