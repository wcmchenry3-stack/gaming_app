"""Security tests — CORS scoping and response header hardening."""

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client_default():
    """Client using the default (dev) allowed origins."""
    os.environ.pop("ALLOWED_ORIGINS", None)
    import importlib
    import main as m

    importlib.reload(m)
    yield TestClient(m.app)


@pytest.fixture()
def client_prod():
    """Client with a production ALLOWED_ORIGINS env var."""
    os.environ["ALLOWED_ORIGINS"] = "https://yahtzee-frontend.onrender.com"
    import importlib
    import main as m

    importlib.reload(m)
    yield TestClient(m.app)
    os.environ.pop("ALLOWED_ORIGINS", None)
    importlib.reload(m)


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_security_headers_present(client_default):
    res = client_default.get("/game/state")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


# ---------------------------------------------------------------------------
# CORS — allowed origins
# ---------------------------------------------------------------------------


@pytest.mark.security
def test_cors_allowed_origin_localhost(client_default):
    res = client_default.get("/game/state", headers={"Origin": "http://localhost:8081"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:8081"


@pytest.mark.security
def test_cors_blocked_unknown_origin(client_default):
    res = client_default.get("/game/state", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in res.headers


@pytest.mark.security
def test_cors_prod_allows_frontend(client_prod):
    res = client_prod.get(
        "/game/state",
        headers={"Origin": "https://yahtzee-frontend.onrender.com"},
    )
    assert res.headers.get("access-control-allow-origin") == "https://yahtzee-frontend.onrender.com"


@pytest.mark.security
def test_cors_prod_blocks_localhost(client_prod):
    res = client_prod.get("/game/state", headers={"Origin": "http://localhost:8081"})
    assert "access-control-allow-origin" not in res.headers
