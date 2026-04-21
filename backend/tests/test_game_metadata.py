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
from hearts.models import HeartsMetadata
from solitaire.models import SolitaireMetadata
from sudoku.models import SudokuMetadata

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
# SolitaireMetadata unit tests
# ---------------------------------------------------------------------------


def test_solitaire_metadata_empty_dict_valid() -> None:
    SolitaireMetadata.model_validate({})


def test_solitaire_metadata_player_name_valid() -> None:
    m = SolitaireMetadata.model_validate({"player_name": "Alice"})
    assert m.player_name == "Alice"


def test_solitaire_metadata_player_name_too_long() -> None:
    with pytest.raises(ValidationError):
        SolitaireMetadata.model_validate({"player_name": "x" * 65})


def test_solitaire_metadata_rejects_unknown_field() -> None:
    with pytest.raises(ValidationError):
        SolitaireMetadata.model_validate({"score": 9999})


# ---------------------------------------------------------------------------
# HeartsMetadata unit tests
# ---------------------------------------------------------------------------


def test_hearts_metadata_empty_dict_valid() -> None:
    HeartsMetadata.model_validate({})


def test_hearts_metadata_player_name_valid() -> None:
    m = HeartsMetadata.model_validate({"player_name": "Alice"})
    assert m.player_name == "Alice"


def test_hearts_metadata_player_name_too_long() -> None:
    with pytest.raises(ValidationError):
        HeartsMetadata.model_validate({"player_name": "x" * 65})


def test_hearts_metadata_rejects_unknown_field() -> None:
    with pytest.raises(ValidationError):
        HeartsMetadata.model_validate({"score": 9999})


# ---------------------------------------------------------------------------
# SudokuMetadata unit tests
# ---------------------------------------------------------------------------


def test_sudoku_metadata_valid_easy() -> None:
    m = SudokuMetadata.model_validate({"difficulty": "easy"})
    assert m.difficulty == "easy"
    assert m.player_name == ""


def test_sudoku_metadata_valid_with_player_name() -> None:
    m = SudokuMetadata.model_validate({"player_name": "Alice", "difficulty": "hard"})
    assert m.player_name == "Alice"
    assert m.difficulty == "hard"


def test_sudoku_metadata_all_difficulty_values_accepted() -> None:
    for d in ("easy", "medium", "hard"):
        assert SudokuMetadata.model_validate({"difficulty": d}).difficulty == d


def test_sudoku_metadata_missing_difficulty_rejected() -> None:
    with pytest.raises(ValidationError):
        SudokuMetadata.model_validate({})


def test_sudoku_metadata_invalid_difficulty_rejected() -> None:
    with pytest.raises(ValidationError):
        SudokuMetadata.model_validate({"difficulty": "impossible"})


def test_sudoku_metadata_player_name_too_long() -> None:
    with pytest.raises(ValidationError):
        SudokuMetadata.model_validate({"difficulty": "easy", "player_name": "x" * 65})


def test_sudoku_metadata_rejects_unknown_field() -> None:
    with pytest.raises(ValidationError):
        SudokuMetadata.model_validate({"difficulty": "easy", "score": 9999})


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


def test_create_game_request_valid_solitaire_metadata() -> None:
    req = CreateGameRequest(game_type="solitaire", metadata={"player_name": "Bob"})
    assert req.metadata["player_name"] == "Bob"


def test_create_game_request_invalid_solitaire_metadata_raises_422() -> None:
    with pytest.raises(ValidationError):
        CreateGameRequest(game_type="solitaire", metadata={"player_name": "x" * 65})


def test_create_game_request_valid_sudoku_metadata() -> None:
    req = CreateGameRequest(
        game_type="sudoku", metadata={"player_name": "Bob", "difficulty": "medium"}
    )
    assert req.metadata["difficulty"] == "medium"


def test_create_game_request_invalid_sudoku_metadata_raises_422() -> None:
    with pytest.raises(ValidationError):
        CreateGameRequest(game_type="sudoku", metadata={"difficulty": "impossible"})


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


# ---------------------------------------------------------------------------
# _validate_client_timestamp unit tests (#659)
# ---------------------------------------------------------------------------

from datetime import timezone, timedelta
from games.service import _validate_client_timestamp


def _now():
    from datetime import datetime
    return datetime.now(timezone.utc)


def test_validate_timestamp_within_window_returns_ts():
    now = _now()
    ts = now - timedelta(hours=1)
    result = _validate_client_timestamp(ts, now)
    assert result == ts


def test_validate_timestamp_too_old_returns_none():
    now = _now()
    ts = now - timedelta(days=400)
    assert _validate_client_timestamp(ts, now) is None


def test_validate_timestamp_future_beyond_window_returns_none():
    now = _now()
    ts = now + timedelta(hours=25)
    assert _validate_client_timestamp(ts, now) is None


def test_validate_timestamp_just_within_future_window():
    now = _now()
    ts = now + timedelta(hours=23, minutes=59)
    result = _validate_client_timestamp(ts, now)
    assert result is not None


def test_validate_timestamp_naive_treated_as_utc():
    from datetime import datetime
    now = _now()
    naive = datetime(now.year, now.month, now.day, now.hour)
    result = _validate_client_timestamp(naive, now)
    # Naive within window should be accepted and returned with UTC tzinfo.
    assert result is not None
    assert result.tzinfo is not None
