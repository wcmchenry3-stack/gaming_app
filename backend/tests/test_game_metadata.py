"""Tests for per-game Pydantic metadata models and CreateGameRequest validation (#539)."""

from __future__ import annotations

import os
import uuid
from typing import Iterator

import pytest
from pydantic import ValidationError

from blackjack.models import BlackjackMetadata
from cascade.models import CascadeMetadata
from games.schemas import CreateGameRequest
from pachisi.models import PachisiMetadata

# ---------------------------------------------------------------------------
# BlackjackMetadata unit tests
# ---------------------------------------------------------------------------


def test_blackjack_metadata_empty_dict_valid() -> None:
    BlackjackMetadata.model_validate({})


def test_blackjack_metadata_rejects_unknown_field() -> None:
    with pytest.raises(ValidationError):
        BlackjackMetadata.model_validate({"deck_count": 6})


# ---------------------------------------------------------------------------
# CascadeMetadata unit tests
# ---------------------------------------------------------------------------


def test_cascade_metadata_empty_dict_valid() -> None:
    CascadeMetadata.model_validate({})


def test_cascade_metadata_player_name_valid() -> None:
    m = CascadeMetadata.model_validate({"player_name": "Alice"})
    assert m.player_name == "Alice"


def test_cascade_metadata_player_name_too_long() -> None:
    with pytest.raises(ValidationError):
        CascadeMetadata.model_validate({"player_name": "x" * 65})


def test_cascade_metadata_rejects_unknown_field() -> None:
    with pytest.raises(ValidationError):
        CascadeMetadata.model_validate({"score": 9999})


# ---------------------------------------------------------------------------
# PachisiMetadata unit tests
# ---------------------------------------------------------------------------


def test_pachisi_metadata_empty_dict_valid() -> None:
    PachisiMetadata.model_validate({})


def test_pachisi_metadata_rejects_unknown_field() -> None:
    with pytest.raises(ValidationError):
        PachisiMetadata.model_validate({"cpu_player": "yellow"})


# ---------------------------------------------------------------------------
# CreateGameRequest metadata validation
# ---------------------------------------------------------------------------


def test_create_game_request_valid_blackjack_metadata() -> None:
    req = CreateGameRequest(game_type="blackjack", metadata={})
    assert req.metadata == {}


def test_create_game_request_invalid_blackjack_metadata_raises_422() -> None:
    with pytest.raises(ValidationError):
        CreateGameRequest(game_type="blackjack", metadata={"unknown": True})


def test_create_game_request_valid_cascade_metadata() -> None:
    req = CreateGameRequest(game_type="cascade", metadata={"player_name": "Bob"})
    assert req.metadata["player_name"] == "Bob"


def test_create_game_request_invalid_cascade_metadata_raises_422() -> None:
    with pytest.raises(ValidationError):
        CreateGameRequest(game_type="cascade", metadata={"player_name": "x" * 65})


def test_create_game_request_valid_pachisi_metadata() -> None:
    req = CreateGameRequest(game_type="pachisi", metadata={})
    assert req.metadata == {}


def test_create_game_request_invalid_pachisi_metadata_raises_422() -> None:
    with pytest.raises(ValidationError):
        CreateGameRequest(game_type="pachisi", metadata={"cpu": "red"})


def test_create_game_request_unregistered_game_type_skips_validation() -> None:
    # yacht/twenty48 are in GameType but not yet in the registry — should not raise
    req = CreateGameRequest(game_type="yacht", metadata={"anything": True})
    assert req.metadata == {"anything": True}


# ---------------------------------------------------------------------------
# API-level 422 test (requires DATABASE_URL)
# ---------------------------------------------------------------------------

pytestmark_db = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set — skipping live API tests",
)


@pytest.fixture()
def client() -> Iterator:
    from db.base import is_configured

    assert is_configured()
    from main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c


def _headers(sid: str) -> dict[str, str]:
    return {"X-Session-ID": sid, "Content-Type": "application/json"}


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set — skipping live API tests",
)
def test_post_games_invalid_metadata_returns_422(client) -> None:
    sid = str(uuid.uuid4())
    r = client.post(
        "/games",
        headers=_headers(sid),
        json={"game_type": "blackjack", "metadata": {"unknown_field": 42}},
    )
    assert r.status_code == 422


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set — skipping live API tests",
)
def test_post_games_valid_cascade_metadata_accepted(client) -> None:
    sid = str(uuid.uuid4())
    r = client.post(
        "/games",
        headers=_headers(sid),
        json={"game_type": "cascade", "metadata": {"player_name": "Eve"}},
    )
    assert r.status_code == 200
