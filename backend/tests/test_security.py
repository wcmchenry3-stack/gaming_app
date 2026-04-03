"""Security tests — CORS, response headers, rate limiting, session isolation, input sanitization."""

import importlib
import os
import uuid

import pytest
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings, strategies as st


@pytest.fixture()
def client_default():
    """Client using the default (dev) allowed origins. No reload — avoids accumulating
    duplicate rate-limit decorator registrations that halve the effective limit."""
    import main as m

    m._sessions.clear()
    yield TestClient(m.app)
    m._sessions.clear()


@pytest.fixture()
def client_prod():
    """Client with a production ALLOWED_ORIGINS env var.
    Reloads main twice (setup + teardown restore). limiter.reset() is called after each
    reload so accumulated registration counters don't bleed into subsequent tests."""
    from limiter import limiter

    os.environ["ALLOWED_ORIGINS"] = "https://dev-games.buffingchi.com"
    import main as m

    importlib.reload(m)
    limiter.reset()
    yield TestClient(m.app)
    os.environ.pop("ALLOWED_ORIGINS", None)
    importlib.reload(m)
    limiter.reset()
    m._sessions.clear()


def _sid() -> str:
    return str(uuid.uuid4())


def _new_game(client, session_id):
    return client.post("/game/new", headers={"X-Session-ID": session_id})


def _roll(client, session_id, held=None):
    if held is None:
        held = [False] * 5
    return client.post("/game/roll", json={"held": held}, headers={"X-Session-ID": session_id})


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_security_headers_present(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    res = client_default.get("/game/state", headers={"X-Session-ID": sid})
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


@pytest.mark.security
def test_csp_header_present_on_get(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    res = client_default.get("/game/state", headers={"X-Session-ID": sid})
    csp = res.headers.get("content-security-policy", "")
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


@pytest.mark.security
def test_csp_header_present_on_post(client_default):
    sid = _sid()
    res = _new_game(client_default, sid)
    csp = res.headers.get("content-security-policy", "")
    assert "default-src" in csp


@pytest.mark.security
def test_server_header_suppressed(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    res = client_default.get("/game/state", headers={"X-Session-ID": sid})
    assert "server" not in res.headers


# ---------------------------------------------------------------------------
# CORS — allowed origins (GET)
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_cors_allowed_origin_localhost(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    res = client_default.get(
        "/game/state",
        headers={"Origin": "http://localhost:8081", "X-Session-ID": sid},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:8081"


@pytest.mark.security
def test_cors_blocked_unknown_origin(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    res = client_default.get(
        "/game/state",
        headers={"Origin": "https://evil.example.com", "X-Session-ID": sid},
    )
    assert "access-control-allow-origin" not in res.headers


@pytest.mark.security
def test_cors_prod_allows_frontend(client_prod):
    sid = _sid()
    _new_game(client_prod, sid)
    res = client_prod.get(
        "/game/state",
        headers={
            "Origin": "https://dev-games.buffingchi.com",
            "X-Session-ID": sid,
        },
    )
    assert res.headers.get("access-control-allow-origin") == "https://dev-games.buffingchi.com"


@pytest.mark.security
def test_cors_prod_blocks_localhost(client_prod):
    sid = _sid()
    _new_game(client_prod, sid)
    res = client_prod.get(
        "/game/state",
        headers={"Origin": "http://localhost:8081", "X-Session-ID": sid},
    )
    assert "access-control-allow-origin" not in res.headers


# ---------------------------------------------------------------------------
# CORS — POST endpoints
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_cors_post_new_game_allowed_origin(client_default):
    res = client_default.post(
        "/game/new",
        headers={"Origin": "http://localhost:8081", "X-Session-ID": _sid()},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:8081"


@pytest.mark.security
def test_cors_post_new_game_blocked_origin(client_default):
    res = client_default.post(
        "/game/new",
        headers={"Origin": "https://evil.example.com", "X-Session-ID": _sid()},
    )
    assert "access-control-allow-origin" not in res.headers


@pytest.mark.security
def test_cors_post_roll_allowed(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    _roll(client_default, sid)
    # Add Origin for this check
    res2 = client_default.post(
        "/game/roll",
        json={"held": [False] * 5},
        headers={"Origin": "http://localhost:8081", "X-Session-ID": sid},
    )
    assert res2.headers.get("access-control-allow-origin") == "http://localhost:8081"


@pytest.mark.security
def test_cors_post_score_allowed(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    _roll(client_default, sid)
    res = client_default.post(
        "/game/score",
        json={"category": "chance"},
        headers={"Origin": "http://localhost:8081", "X-Session-ID": sid},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:8081"


# ---------------------------------------------------------------------------
# CORS — preflight OPTIONS
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_cors_preflight_allowed_origin(client_default):
    res = client_default.options(
        "/game/new",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, X-Session-ID",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:8081"


@pytest.mark.security
def test_cors_preflight_blocked_origin(client_default):
    res = client_default.options(
        "/game/new",
        headers={
            "Origin": "https://attacker.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in res.headers


@pytest.mark.security
def test_cors_null_origin_blocked(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    res = client_default.get(
        "/game/state",
        headers={"Origin": "null", "X-Session-ID": sid},
    )
    assert "access-control-allow-origin" not in res.headers


# ---------------------------------------------------------------------------
# Error message sanitization
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_unknown_category_error_is_fixed_string(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    _roll(client_default, sid)
    res = client_default.post(
        "/game/score",
        json={"category": "bogus_xyz_123"},
        headers={"X-Session-ID": sid},
    )
    assert res.status_code == 400
    assert "bogus_xyz_123" not in res.json()["detail"]
    assert "Unknown scoring category" in res.json()["detail"]


@pytest.mark.security
def test_xss_payload_not_reflected_in_error(client_default):
    payload = "<script>alert(1)</script>"
    sid = _sid()
    _new_game(client_default, sid)
    _roll(client_default, sid)
    res = client_default.post(
        "/game/score",
        json={"category": payload},
        headers={"X-Session-ID": sid},
    )
    assert res.status_code == 400
    assert payload not in res.json()["detail"]


@pytest.mark.security
def test_duplicate_category_error_is_fixed_string(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    _roll(client_default, sid)
    client_default.post("/game/score", json={"category": "chance"}, headers={"X-Session-ID": sid})
    _roll(client_default, sid)
    res = client_default.post(
        "/game/score", json={"category": "chance"}, headers={"X-Session-ID": sid}
    )
    assert res.status_code == 400
    assert "already scored" in res.json()["detail"]
    assert "chance" not in res.json()["detail"]


# ---------------------------------------------------------------------------
# Request body size limits
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_oversized_body_returns_413(client_default):
    sid = _sid()
    res = client_default.post(
        "/game/score",
        content=b"x" * 2000,
        headers={
            "Content-Type": "application/json",
            "Content-Length": "2000",
            "X-Session-ID": sid,
        },
    )
    assert res.status_code == 413


@pytest.mark.security
def test_normal_body_not_rejected(client_default):
    sid = _sid()
    _new_game(client_default, sid)
    _roll(client_default, sid)
    res = client_default.post(
        "/game/score", json={"category": "chance"}, headers={"X-Session-ID": sid}
    )
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_rate_limit_returns_429_after_threshold(client_default):
    """POST /game/new has a 10/minute limit; 11th request must be 429."""
    responses = [
        client_default.post("/game/new", headers={"X-Session-ID": _sid()}) for _ in range(11)
    ]
    assert any(r.status_code == 429 for r in responses)


@pytest.mark.security
def test_rate_limit_429_has_retry_after(client_default):
    """429 responses must include Retry-After header."""
    responses = [
        client_default.post("/game/new", headers={"X-Session-ID": _sid()}) for _ in range(11)
    ]
    rate_limited = [r for r in responses if r.status_code == 429]
    assert rate_limited, "Expected at least one 429"
    for r in rate_limited:
        assert "retry-after" in r.headers


@pytest.mark.security
def test_fruit_merge_score_strict_limit(client_default):
    """POST /fruit-merge/score has a 5/minute limit."""
    responses = [
        client_default.post(
            "/fruit-merge/score",
            json={"player_name": "tester", "score": i},
        )
        for i in range(7)
    ]
    assert any(r.status_code == 429 for r in responses)


# ---------------------------------------------------------------------------
# Session isolation
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_missing_session_id_returns_400(client_default):
    res = client_default.post("/game/new")
    assert res.status_code == 400


@pytest.mark.security
def test_invalid_uuid_session_id_returns_400(client_default):
    res = client_default.post("/game/new", headers={"X-Session-ID": "not-a-uuid"})
    assert res.status_code == 400


@pytest.mark.security
def test_two_sessions_are_isolated(client_default):
    sid1, sid2 = _sid(), _sid()
    _new_game(client_default, sid1)
    _new_game(client_default, sid2)
    _roll(client_default, sid1)
    state2 = client_default.get("/game/state", headers={"X-Session-ID": sid2}).json()
    assert state2["rolls_used"] == 0


# ---------------------------------------------------------------------------
# Fuzz tests (Hypothesis)
# ---------------------------------------------------------------------------


@pytest.mark.security
@given(category=st.text(min_size=0, max_size=200))
@settings(
    max_examples=50,
    deadline=2000,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_score_category_fuzz_never_500(client_default, category):
    """Arbitrary category strings must never produce 5xx errors."""
    from limiter import limiter

    limiter.reset()  # hypothesis runs many examples per test; reset to avoid 429s
    sid = _sid()
    _new_game(client_default, sid)
    _roll(client_default, sid)
    res = client_default.post(
        "/game/score",
        json={"category": category},
        headers={"X-Session-ID": sid},
    )
    assert res.status_code < 500, f"5xx for category={category!r}: {res.text}"


@pytest.mark.security
@given(held=st.lists(st.booleans(), min_size=0, max_size=20))
@settings(
    max_examples=30,
    deadline=2000,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_roll_held_fuzz_never_500(client_default, held):
    """Arbitrary held arrays must never produce 5xx errors."""
    from limiter import limiter

    limiter.reset()  # hypothesis runs many examples per test; reset to avoid 429s
    sid = _sid()
    _new_game(client_default, sid)
    res = client_default.post(
        "/game/roll",
        json={"held": held},
        headers={"X-Session-ID": sid},
    )
    assert res.status_code < 500, f"5xx for held={held!r}: {res.text}"
