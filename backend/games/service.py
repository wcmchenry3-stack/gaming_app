"""DB service layer for the games write API (#364).

Idempotency strategy:
- Games: client may supply `id`; re-creating with the same id returns existing.
- Events: `(game_id, event_index)` is the composite PK. We use dialect-aware
  `INSERT ... ON CONFLICT DO NOTHING` so repeat batches are safe.
- Complete: re-completing a finished game returns its existing state without
  overwriting.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import EventType, Game, GameEvent, GameType
from vocab import GameOutcome

_VALID_OUTCOMES = frozenset(v.value for v in GameOutcome)


class GameServiceError(Exception):
    """Base error raised by the games service — translated to HTTP by the router."""

    def __init__(self, status_code: int, detail: str | dict):
        self.status_code = status_code
        self.detail = detail
        super().__init__(str(detail))


@dataclass
class AppendResult:
    accepted: int
    duplicates: int
    rejected: list[str]


async def _resolve_game_type(session: AsyncSession, name: str) -> GameType:
    gt = (await session.execute(select(GameType).where(GameType.name == name))).scalar_one_or_none()
    if gt is None or not gt.is_active:
        raise GameServiceError(400, f"Unknown or inactive game_type: {name!r}")
    return gt


async def _load_event_type_map(session: AsyncSession, game_type_id: int) -> dict[str, EventType]:
    rows = (
        (
            await session.execute(
                select(EventType).where(
                    EventType.game_type_id == game_type_id,
                    EventType.deprecated_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    return {et.name: et for et in rows}


async def create_game(
    session: AsyncSession,
    *,
    session_id: str,
    client_id: uuid.UUID | None,
    game_type_name: str,
    metadata: dict[str, Any],
) -> Game:
    gt = await _resolve_game_type(session, game_type_name)

    if client_id is not None:
        existing = (
            await session.execute(select(Game).where(Game.id == client_id))
        ).scalar_one_or_none()
        if existing is not None:
            if existing.session_id != session_id:
                raise GameServiceError(403, "Game belongs to a different session.")
            return existing

    game = Game(
        id=client_id or uuid.uuid4(),
        session_id=session_id,
        game_type_id=gt.id,
        game_metadata=metadata or {},
    )
    session.add(game)
    await session.commit()
    await session.refresh(game)
    return game


async def _get_owned_game(session: AsyncSession, game_id: uuid.UUID, session_id: str) -> Game:
    game = (await session.execute(select(Game).where(Game.id == game_id))).scalar_one_or_none()
    if game is None:
        raise GameServiceError(404, "Game not found.")
    if game.session_id != session_id:
        raise GameServiceError(403, "Game belongs to a different session.")
    return game


def _upsert_ignore(session: AsyncSession, table, rows: list[dict]):
    """Dialect-aware INSERT ... ON CONFLICT DO NOTHING.

    Postgres and SQLite both support on_conflict_do_nothing via their
    dialect-specific insert() constructors. We branch on bind.dialect.name
    so the API test suite can run against either backend.
    """
    dialect = session.bind.dialect.name if session.bind else "postgresql"
    if dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:
        from sqlalchemy.dialects.postgresql import insert as _insert
    return _insert(table).values(rows).on_conflict_do_nothing()


async def append_events(
    session: AsyncSession,
    *,
    game_id: uuid.UUID,
    session_id: str,
    events: list[dict[str, Any]],
) -> AppendResult:
    game = await _get_owned_game(session, game_id, session_id)
    if game.completed_at is not None:
        raise GameServiceError(409, "Game is already completed.")

    event_type_map = await _load_event_type_map(session, game.game_type_id)

    valid_rows: list[dict[str, Any]] = []
    valid_indices: list[int] = []
    rejected: set[str] = set()
    seen_indices: set[int] = set()

    for ev in events:
        name = ev["event_type"]
        idx = ev["event_index"]
        if name not in event_type_map:
            rejected.add(name)
            continue
        if idx in seen_indices:
            # duplicate within the same batch → ignore second occurrence
            continue
        seen_indices.add(idx)
        valid_indices.append(idx)
        valid_rows.append(
            {
                "game_id": game.id,
                "event_index": idx,
                "event_type_id": event_type_map[name].id,
                "data": ev["data"],
            }
        )

    if rejected:
        raise GameServiceError(
            400,
            {"error": "unknown_event_type", "rejected": sorted(rejected)},
        )

    duplicates = 0
    if valid_rows:
        # Pre-check which indices already exist so we can count duplicates.
        existing = (
            (
                await session.execute(
                    select(GameEvent.event_index).where(
                        GameEvent.game_id == game.id,
                        GameEvent.event_index.in_(valid_indices),
                    )
                )
            )
            .scalars()
            .all()
        )
        existing_set = set(existing)
        duplicates = sum(1 for i in valid_indices if i in existing_set)

        stmt = _upsert_ignore(session, GameEvent.__table__, valid_rows)
        await session.execute(stmt)
        await session.commit()

    return AppendResult(
        accepted=len(valid_rows) - duplicates,
        duplicates=duplicates,
        rejected=[],
    )


# ---------------------------------------------------------------------------
# Read-side queries (#365)
# ---------------------------------------------------------------------------


@dataclass
class GameTypeStats:
    played: int
    best: int | None
    avg: float | None
    last_played_at: datetime | None
    best_chips: int | None = None
    current_chips: int | None = None


@dataclass
class StatsSummary:
    total_games: int
    by_game: dict[str, GameTypeStats]
    favorite_game: str | None


async def get_stats_for_session(session: AsyncSession, *, session_id: str) -> StatsSummary:
    """Aggregate per-game-type stats for a single session.

    Only counts completed games — in-progress games are excluded from
    played/best/avg so the leaderboard stays stable until a game finishes.
    """
    rows = (
        await session.execute(
            select(
                GameType.name,
                func.count(Game.id).label("played"),
                func.max(Game.final_score).label("best"),
                func.avg(Game.final_score).label("avg"),
                func.max(Game.completed_at).label("last_played_at"),
            )
            .select_from(Game)
            .join(GameType, Game.game_type_id == GameType.id)
            .where(
                Game.session_id == session_id,
                Game.completed_at.is_not(None),
            )
            .group_by(GameType.name)
        )
    ).all()

    by_game: dict[str, GameTypeStats] = {}
    total = 0
    favorite: str | None = None
    favorite_count = -1

    for name, played, best, avg, last_played in rows:
        total += played
        stats = GameTypeStats(
            played=played,
            best=int(best) if best is not None else None,
            avg=round(float(avg), 1) if avg is not None else None,
            last_played_at=last_played,
        )
        # Blackjack renames `best` → `best_chips` and adds `current_chips`
        # (latest completed game's final_score). Keep generic fields None so
        # the JSON output reflects the spec shape per game type.
        if name == "blackjack":
            stats.best_chips = stats.best
            stats.best = None
            stats.avg = None
            latest = (
                await session.execute(
                    select(Game.final_score)
                    .where(
                        Game.session_id == session_id,
                        Game.game_type_id
                        == (
                            select(GameType.id)
                            .where(GameType.name == "blackjack")
                            .scalar_subquery()
                        ),
                        Game.completed_at.is_not(None),
                    )
                    .order_by(Game.completed_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            stats.current_chips = int(latest) if latest is not None else None
        by_game[name] = stats
        if played > favorite_count:
            favorite = name
            favorite_count = played

    return StatsSummary(total_games=total, by_game=by_game, favorite_game=favorite)


@dataclass
class GameRow:
    id: uuid.UUID
    game_type: str
    started_at: datetime
    completed_at: datetime | None
    final_score: int | None
    outcome: str | None
    duration_ms: int | None
    metadata: dict[str, Any]


@dataclass
class GamePage:
    items: list[GameRow]
    next_cursor: str | None


async def list_games_for_session(
    session: AsyncSession,
    *,
    session_id: str,
    limit: int,
    cursor: datetime | None,
) -> GamePage:
    stmt = (
        select(Game, GameType.name)
        .join(GameType, Game.game_type_id == GameType.id)
        .where(Game.session_id == session_id)
        .order_by(Game.started_at.desc(), Game.id.desc())
        .limit(limit + 1)
    )
    if cursor is not None:
        stmt = stmt.where(Game.started_at < cursor)

    rows = (await session.execute(stmt)).all()
    items = [
        GameRow(
            id=g.id,
            game_type=name,
            started_at=g.started_at,
            completed_at=g.completed_at,
            final_score=g.final_score,
            outcome=g.outcome,
            duration_ms=g.duration_ms,
            metadata=g.game_metadata,
        )
        for g, name in rows[:limit]
    ]
    next_cursor = rows[limit][0].started_at.isoformat() if len(rows) > limit else None
    return GamePage(items=items, next_cursor=next_cursor)


@dataclass
class GameDetail:
    row: GameRow
    events: list[dict[str, Any]] | None


async def get_game_detail(
    session: AsyncSession,
    *,
    game_id: uuid.UUID,
    session_id: str,
    include_events: bool,
) -> GameDetail:
    opts = [selectinload(Game.game_type)]
    if include_events:
        opts.append(selectinload(Game.events).selectinload(GameEvent.event_type))
    game = (
        await session.execute(select(Game).options(*opts).where(Game.id == game_id))
    ).scalar_one_or_none()
    if game is None:
        raise GameServiceError(404, "Game not found.")
    if game.session_id != session_id:
        raise GameServiceError(403, "Game belongs to a different session.")

    row = GameRow(
        id=game.id,
        game_type=game.game_type.name,
        started_at=game.started_at,
        completed_at=game.completed_at,
        final_score=game.final_score,
        outcome=game.outcome,
        duration_ms=game.duration_ms,
        metadata=game.game_metadata,
    )
    events: list[dict[str, Any]] | None = None
    if include_events:
        events = [
            {
                "event_index": e.event_index,
                "event_type": e.event_type.name,
                "occurred_at": e.occurred_at,
                "data": e.data,
            }
            for e in game.events
        ]
    return GameDetail(row=row, events=events)


async def complete_game(
    session: AsyncSession,
    *,
    game_id: uuid.UUID,
    session_id: str,
    final_score: int | None,
    outcome: str | None,
    duration_ms: int | None,
) -> Game:
    game = await _get_owned_game(session, game_id, session_id)
    if game.completed_at is not None:
        return game  # idempotent — do not overwrite

    if outcome is not None and outcome not in _VALID_OUTCOMES:
        raise GameServiceError(400, f"Invalid outcome: {outcome!r}")

    game.completed_at = datetime.now(timezone.utc)
    game.final_score = final_score
    game.outcome = outcome
    game.duration_ms = duration_ms
    await session.commit()
    await session.refresh(game)
    return game
