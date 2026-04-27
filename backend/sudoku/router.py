"""Sudoku leaderboards (#615, #748) — (variant, difficulty)-scoped top-10 lists.

Each (variant × difficulty) pair has its own leaderboard.  Variant defaults
to "classic" on both submit and read so existing clients remain unchanged.
Rows written before #748 have no ``variant`` key in ``game_metadata``; the
query treats those as "classic" so the classic leaderboard stays populated.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Path, Query, Request
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import get_session_factory
from db.models import Game, GameType
from limiter import limiter, session_key
from vocab import GameType as GameTypeEnum

from .models import Difficulty, LeaderboardResponse, ScoreEntry, ScoreSubmitRequest, Variant

router = APIRouter()

LEADERBOARD_LIMIT = 10
_SUDOKU_SESSION = "sudoku-anon"  # placeholder until SSO


async def _sudoku_game_type_id(db: AsyncSession) -> int:
    row = (
        await db.execute(select(GameType.id).where(GameType.name == GameTypeEnum.SUDOKU))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=500,
            detail="sudoku game_type missing — run alembic migrations.",
        )
    return row


async def _top_scores(
    db: AsyncSession, difficulty: Difficulty, variant: Variant = "classic"
) -> list[ScoreEntry]:
    gt_id = await _sudoku_game_type_id(db)
    # `as_string()` produces json_extract(...) on SQLite and ->> on JSONB.
    # Rows predating #748 lack a variant key; treat their NULL as "classic".
    variant_col = Game.game_metadata["variant"].as_string()
    if variant == "classic":
        variant_filter = or_(variant_col == "classic", variant_col.is_(None))
    else:
        variant_filter = variant_col == variant
    rows = (
        (
            await db.execute(
                select(Game)
                .where(
                    Game.game_type_id == gt_id,
                    Game.final_score.is_not(None),
                    Game.game_metadata["difficulty"].as_string() == difficulty,
                    variant_filter,
                )
                .order_by(desc(Game.final_score), Game.completed_at.asc())
                .limit(LEADERBOARD_LIMIT)
            )
        )
        .scalars()
        .all()
    )

    entries: list[ScoreEntry] = []
    for i, g in enumerate(rows):
        name = (g.game_metadata or {}).get("player_name") or "anon"
        entries.append(ScoreEntry(player_name=str(name), score=int(g.final_score or 0), rank=i + 1))
    return entries


@router.post("/score", response_model=ScoreEntry, status_code=201)
@limiter.limit("30/minute", key_func=session_key)
async def submit_score(request: Request, body: ScoreSubmitRequest) -> ScoreEntry:
    factory = get_session_factory()
    async with factory() as db:
        gt_id = await _sudoku_game_type_id(db)
        game = Game(
            session_id=_SUDOKU_SESSION,
            game_type_id=gt_id,
            final_score=body.score,
            completed_at=datetime.now(timezone.utc),
            game_metadata={
                "player_name": body.player_name,
                "difficulty": body.difficulty,
                "variant": body.variant,
            },
        )
        db.add(game)
        await db.commit()

        top = await _top_scores(db, body.difficulty, body.variant)

    for entry in top:
        if entry.player_name == body.player_name and entry.score == body.score:
            return entry
    # Not in top 10 — report the truncated-off rank.
    return ScoreEntry(player_name=body.player_name, score=body.score, rank=LEADERBOARD_LIMIT + 1)


@router.get("/scores/{difficulty}", response_model=LeaderboardResponse)
@limiter.limit("60/minute")
async def get_scores(
    request: Request,
    difficulty: Difficulty = Path(..., description="One of: easy, medium, hard"),
    variant: Variant = Query("classic", description="One of: classic, mini"),
) -> LeaderboardResponse:
    factory = get_session_factory()
    async with factory() as db:
        scores = await _top_scores(db, difficulty, variant)
    return LeaderboardResponse(scores=scores)
