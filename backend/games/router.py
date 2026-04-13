"""FastAPI router for /games/* (#364)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request

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


@router.post("", response_model=CreateGameResponse)
@limiter.limit("10/minute", key_func=session_key)
async def create_game(request: Request, body: CreateGameRequest) -> CreateGameResponse:
    sid = get_session_id(request)
    factory = get_session_factory()
    async with factory() as db:
        try:
            game = await service.create_game(
                db,
                session_id=sid,
                client_id=body.id,
                game_type_name=body.game_type,
                metadata=body.metadata,
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
