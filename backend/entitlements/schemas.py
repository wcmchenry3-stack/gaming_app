from __future__ import annotations

from pydantic import BaseModel


class EntitlementsResponse(BaseModel):
    token: str
    expires_at: str
