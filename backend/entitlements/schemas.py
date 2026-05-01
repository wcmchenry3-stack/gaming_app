from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class EntitlementsResponse(BaseModel):
    token: str
    expires_at: datetime
