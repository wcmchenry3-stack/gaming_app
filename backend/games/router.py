"""FastAPI router for /games/* (#364)."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request

from db.base import get_session_factory
from limiter import limiter, session_key
from session import get_session_id

from . import service
from .schemas import (
    AppendEventsRequest,
    AppendEventsResponse,
    CompleteGameRequest,
    CreateGameRequest,
    CreateGameResponse,
    GameDetailResponse,
    GameEventResponse,
    GameHistoryResponse,
    GameRowResponse,
    GameStateResponse,
)

router = APIRouter()


def _to_state(game) -> GameStateResponse:
    return GameStateResponse(
        id=game.id,
        game_type=game.game_type.name if game.game_type else "",
        session_id=game.session_id,
        started_at=game.started_at,
        completed_at=game.completed_at,
        final_score=game.final_score,
        outcome=game.outcome,
        duration_ms=game.duration_ms,
    )


# ---------------------------------------------------------------------------
# Read routes (#365) — registered before /{game_id} so literal paths win
# ---------------------------------------------------------------------------


def _to_row(g) -> GameRowResponse:
    return GameRowResponse(
        id=g.id,
        game_type=g.game_type,
        started_at=g.started_at,
        completed_at=g.completed_at,
        final_score=g.final_score,
        outcome=g.outcome,
        duration_ms=g.duration_ms,
        metadata=g.metadata,
        players=g.players,
    )


@router.get("/me", response_model=GameHistoryResponse)
@limiter.limit("60/minute", key_func=session_key)
async def list_my_games(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
) -> GameHistoryResponse:
    sid = get_session_id(request)
    parsed_cursor: datetime | None = None
    if cursor:
        try:
            parsed_cursor = datetime.fromisoformat(cursor)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor.")
    factory = get_session_factory()
    async with factory() as db:
        page = await service.list_games_for_session(
            db, session_id=sid, limit=limit, cursor=parsed_cursor
        )
    return GameHistoryResponse(items=[_to_row(r) for r in page.items], next_cursor=page.next_cursor)


@router.get("/{game_id}", response_model=GameDetailResponse)
@limiter.limit("60/minute", key_func=session_key)
async def get_game_detail(
    request: Request,
    game_id: uuid.UUID,
    include_events: int = Query(0, ge=0, le=1),
) -> GameDetailResponse:
    sid = get_session_id(request)
    factory = get_session_factory()
    async with factory() as db:
        try:
            detail = await service.get_game_detail(
                db,
                game_id=game_id,
                session_id=sid,
                include_events=bool(include_events),
            )
        except service.GameServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
    row = detail.row
    events = None
    if detail.events is not None:
        events = [GameEventResponse(**e) for e in detail.events]
    return GameDetailResponse(
        id=row.id,
        game_type=row.game_type,
        started_at=row.started_at,
        completed_at=row.completed_at,
        final_score=row.final_score,
        outcome=row.outcome,
        duration_ms=row.duration_ms,
        metadata=row.metadata,
        players=row.players,
        events=events,
    )


# ---------------------------------------------------------------------------
# Write routes (#364)
# ---------------------------------------------------------------------------


@router.post("", response_model=CreateGameResponse)
@limiter.limit("10/minute", key_func=session_key)
async def create_game(request: Request, body: CreateGameRequest) -> CreateGameResponse:
    sid = get_session_id(request)
    # Default to the creating session when the client omits players (#543).
    players = [p.model_dump() for p in body.players] if body.players else [{"player_id": sid}]
    factory = get_session_factory()
    async with factory() as db:
        try:
            game = await service.create_game(
                db,
                session_id=sid,
                client_id=body.id,
                game_type_name=body.game_type,
                metadata=body.metadata,
                players=players,
            )
        except service.GameServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        return CreateGameResponse(id=game.id, started_at=game.started_at)


@router.post("/{game_id}/events", response_model=AppendEventsResponse)
@limiter.limit("60/minute", key_func=session_key)
async def append_events(
    request: Request, game_id: uuid.UUID, body: AppendEventsRequest
) -> AppendEventsResponse:
    sid = get_session_id(request)
    factory = get_session_factory()
    async with factory() as db:
        try:
            result = await service.append_events(
                db,
                game_id=game_id,
                session_id=sid,
                events=[e.model_dump() for e in body.events],
            )
        except service.GameServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        return AppendEventsResponse(
            accepted=result.accepted,
            duplicates=result.duplicates,
            rejected=result.rejected,
        )


@router.patch("/{game_id}/complete", response_model=GameStateResponse)
@limiter.limit("10/minute", key_func=session_key)
async def complete_game(
    request: Request, game_id: uuid.UUID, body: CompleteGameRequest
) -> GameStateResponse:
    sid = get_session_id(request)
    factory = get_session_factory()
    async with factory() as db:
        try:
            game = await service.complete_game(
                db,
                game_id=game_id,
                session_id=sid,
                final_score=body.final_score,
                outcome=body.outcome,
                duration_ms=body.duration_ms,
            )
        except service.GameServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        # Refresh with relationship loaded for response
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from db.models import Game

        loaded = (
            await db.execute(
                select(Game).options(selectinload(Game.game_type)).where(Game.id == game.id)
            )
        ).scalar_one()
        return _to_state(loaded)
