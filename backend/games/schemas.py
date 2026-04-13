"""Pydantic request/response schemas for the games write API (#364)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class CreateGameRequest(BaseModel):
    id: uuid.UUID | None = None
    game_type: str = Field(..., min_length=1, max_length=64)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventIn(BaseModel):
    event_index: int = Field(..., ge=0)
    event_type: str = Field(..., min_length=1, max_length=64)
    data: dict[str, Any] = Field(default_factory=dict)


class AppendEventsRequest(BaseModel):
    events: list[EventIn] = Field(..., min_length=1, max_length=200)


class CompleteGameRequest(BaseModel):
    final_score: int | None = None
    outcome: str | None = None
    duration_ms: int | None = Field(default=None, ge=0)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class CreateGameResponse(BaseModel):
    id: uuid.UUID
    started_at: datetime


class AppendEventsResponse(BaseModel):
    accepted: int
    duplicates: int
    rejected: list[str] = Field(default_factory=list)


class GameStateResponse(BaseModel):
    id: uuid.UUID
    game_type: str
    session_id: str
    started_at: datetime
    completed_at: datetime | None
    final_score: int | None
    outcome: str | None
    duration_ms: int | None
