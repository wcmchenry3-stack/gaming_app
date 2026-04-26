"""Tests that error responses include a 'detail' field for frontend error display.

Covers #254/#255: the frontend httpClient reads `detail` from error JSON bodies.
If the backend omits `detail`, the frontend falls back to a raw statusText string
that is not user-friendly. These tests ensure every 404 response provides one.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from main import app

import blackjack.router as blackjack_router

client = TestClient(app)

TEST_SESSION_ID = str(uuid.uuid4())
SESSION_HEADERS = {"X-Session-ID": TEST_SESSION_ID}


@pytest.fixture(autouse=True)
def reset_all():
    blackjack_router.reset_game()
    yield
    blackjack_router.reset_game()


# ---------------------------------------------------------------------------
# Blackjack — 404 responses include detail
# ---------------------------------------------------------------------------


class TestBlackjack404Detail:
    def test_state_404_has_detail(self):
        res = client.get("/blackjack/state", headers=SESSION_HEADERS)
        assert res.status_code == 404
        assert "detail" in res.json()

    def test_bet_404_has_detail(self):
        res = client.post("/blackjack/bet", json={"amount": 10}, headers=SESSION_HEADERS)
        assert res.status_code == 404
        assert "detail" in res.json()

    def test_hit_404_has_detail(self):
        res = client.post("/blackjack/hit", headers=SESSION_HEADERS)
        assert res.status_code == 404
        assert "detail" in res.json()

    def test_stand_404_has_detail(self):
        res = client.post("/blackjack/stand", headers=SESSION_HEADERS)
        assert res.status_code == 404
        assert "detail" in res.json()

    def test_double_down_404_has_detail(self):
        res = client.post("/blackjack/double-down", headers=SESSION_HEADERS)
        assert res.status_code == 404
        assert "detail" in res.json()

    def test_new_hand_404_has_detail(self):
        res = client.post("/blackjack/new-hand", headers=SESSION_HEADERS)
        assert res.status_code == 404
        assert "detail" in res.json()


# ---------------------------------------------------------------------------
# Missing X-Session-ID header returns 422
# ---------------------------------------------------------------------------


class TestMissingSessionHeader:
    """All session-dependent endpoints require X-Session-ID."""

    @pytest.mark.parametrize(
        "method,path",
        [
            ("POST", "/blackjack/new"),
            ("GET", "/blackjack/state"),
        ],
    )
    def test_missing_header_returns_error(self, method, path):
        res = client.request(method, path)
        assert res.status_code in (400, 422)
