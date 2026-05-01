"""Tests for GET /entitlements (#1050)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Iterator

import jwt
import pytest
from fastapi.testclient import TestClient

from entitlements import service as entitlements_service


@pytest.fixture()
def client() -> Iterator[TestClient]:
    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def session_id() -> str:
    return str(uuid.uuid4())


def _headers(sid: str) -> dict[str, str]:
    return {"X-Session-ID": sid}


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_get_entitlements_returns_200(client: TestClient, session_id: str) -> None:
    r = client.get("/entitlements", headers=_headers(session_id))
    assert r.status_code == 200
    body = r.json()
    assert "token" in body
    assert "expires_at" in body


def test_token_is_valid_rs256(client: TestClient, session_id: str) -> None:
    r = client.get("/entitlements", headers=_headers(session_id))
    assert r.status_code == 200
    token = r.json()["token"]

    pub_pem = entitlements_service.get_public_key_pem()
    decoded = jwt.decode(token, pub_pem, algorithms=["RS256"])

    assert decoded["sub"] == session_id
    assert decoded["entitled_games"] == []
    assert "iat" in decoded
    assert "exp" in decoded


def test_entitled_games_empty_by_default(client: TestClient, session_id: str) -> None:
    r = client.get("/entitlements", headers=_headers(session_id))
    token = r.json()["token"]
    pub_pem = entitlements_service.get_public_key_pem()
    decoded = jwt.decode(token, pub_pem, algorithms=["RS256"])
    assert decoded["entitled_games"] == []


def test_expires_at_is_24h_ahead(client: TestClient, session_id: str) -> None:
    before = datetime.now(timezone.utc)
    r = client.get("/entitlements", headers=_headers(session_id))
    body = r.json()

    expires_at = datetime.fromisoformat(body["expires_at"])
    delta_hours = (expires_at - before).total_seconds() / 3600
    assert 23.9 <= delta_hours <= 24.1


def test_token_exp_matches_expires_at(client: TestClient, session_id: str) -> None:
    r = client.get("/entitlements", headers=_headers(session_id))
    body = r.json()
    token = body["token"]
    expires_at = datetime.fromisoformat(body["expires_at"])

    pub_pem = entitlements_service.get_public_key_pem()
    decoded = jwt.decode(token, pub_pem, algorithms=["RS256"])
    assert decoded["exp"] == int(expires_at.timestamp())


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------


def test_missing_session_id_returns_400(client: TestClient) -> None:
    r = client.get("/entitlements")
    assert r.status_code == 400
    assert "X-Session-ID" in r.json()["detail"]


def test_invalid_session_id_returns_400(client: TestClient) -> None:
    r = client.get("/entitlements", headers={"X-Session-ID": "not-a-uuid"})
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Private key not leaked
# ---------------------------------------------------------------------------


def test_private_key_not_in_response(client: TestClient, session_id: str) -> None:
    r = client.get("/entitlements", headers=_headers(session_id))
    raw = r.text
    assert "PRIVATE KEY" not in raw
    assert "BEGIN RSA" not in raw
