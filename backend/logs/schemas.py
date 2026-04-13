"""Pydantic schemas for the bug log write API (#364)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class BugLogIn(BaseModel):
    id: uuid.UUID
    logged_at: datetime
    level: Literal["warn", "error", "fatal"]
    source: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1, max_length=2048)
    context: dict[str, Any] = Field(default_factory=dict)


class BugLogBatchRequest(BaseModel):
    logs: list[BugLogIn] = Field(..., min_length=1, max_length=50)


class BugLogBatchResponse(BaseModel):
    accepted: int
    duplicates: int
