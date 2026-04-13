"""Async SQLAlchemy engine + session factory for Postgres.

DATABASE_URL is read from the environment. Render provides a `postgresql://`
URL; SQLAlchemy 2.x needs the `+asyncpg` driver qualifier to use the async API,
so we rewrite the scheme here.

If DATABASE_URL is unset (local dev without a DB), engine/session remain None
and callers can skip DB work. No module-level crash — the app still boots.
"""

from __future__ import annotations

import os
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def _normalize_url(raw: str) -> str:
    if raw.startswith("postgresql+asyncpg://"):
        return raw
    if raw.startswith("postgres://"):
        return "postgresql+asyncpg://" + raw[len("postgres://") :]
    if raw.startswith("postgresql://"):
        return "postgresql+asyncpg://" + raw[len("postgresql://") :]
    return raw


_raw_url = os.environ.get("DATABASE_URL", "").strip()
DATABASE_URL: str | None = _normalize_url(_raw_url) if _raw_url else None

engine: AsyncEngine | None = (
    create_async_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5)
    if DATABASE_URL
    else None
)

SessionLocal: async_sessionmaker[AsyncSession] | None = (
    async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    if engine
    else None
)


async def get_session() -> AsyncIterator[AsyncSession]:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured")
    async with SessionLocal() as session:
        yield session
