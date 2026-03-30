import json
import logging
import os
import time
import uuid
from collections import OrderedDict

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from game import YahtzeeGame
from limiter import _real_ip, limiter
from models import GameStateResponse, PossibleScoresResponse, RollRequest, ScoreRequest
from session import get_session_id
from fruit_merge.router import router as fruit_merge_router
from blackjack.router import router as blackjack_router
from ludo.router import router as ludo_router

# ---------------------------------------------------------------------------
# Audit logger — emits JSON lines; Render's log aggregator handles timestamps
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(message)s")
_audit_log = logging.getLogger("audit")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Gaming App API")
app.include_router(fruit_merge_router, prefix="/fruit-merge")
app.include_router(blackjack_router, prefix="/blackjack")
app.include_router(ludo_router, prefix="/ludo")

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    _audit_log.warning(
        json.dumps(
            {
                "event": "rate_limit_exceeded",
                "ip": _real_ip(request),
                "method": request.method,
                "path": request.url.path,
            }
        )
    )
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Try again later."},
        headers={"Retry-After": "60"},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# ---------------------------------------------------------------------------
# CORS — scoped to known origins; set ALLOWED_ORIGINS env var (comma-separated)
# in production. Render's fromService with property: url returns a bare
# subdomain slug so we normalise it to https://<slug>.onrender.com when needed.
# ---------------------------------------------------------------------------


def _normalise_origin(origin: str) -> str:
    origin = origin.strip()
    if "://" not in origin:
        return f"https://{origin}.onrender.com"
    return origin


_raw = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins: list[str] = (
    [_normalise_origin(o) for o in _raw.split(",") if o.strip()]
    if _raw
    else ["http://localhost:8081", "http://localhost:19006"]
)

# ---------------------------------------------------------------------------
# Middleware stack (registered last = outermost in Starlette)
# Order outermost → innermost:
#   1. request_logger  (logs all requests including 429s)
#   2. SlowAPIMiddleware  (rate limiting)
#   3. MaxBodySizeMiddleware  (reject oversized bodies early)
#   4. CORSMiddleware
#   5. security_headers  (@app.middleware decorator, innermost)
# ---------------------------------------------------------------------------

MAX_BODY_BYTES = 1_024  # 1 KB — generous for all valid game payloads (~50 bytes max)


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_BYTES:
            return Response(
                content='{"detail":"Request body too large."}',
                status_code=413,
                media_type="application/json",
            )
        return await call_next(request)


# Register in reverse of desired execution order (last registered = outermost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Session-ID"],
)
app.add_middleware(MaxBodySizeMiddleware)
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def request_logger(request: Request, call_next) -> Response:
    """Outermost middleware — logs every request, including 429s."""
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000, 1)

    record: dict = {
        "ip": _real_ip(request),
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "ms": duration_ms,
    }
    if response.status_code == 429:
        record["event"] = "rate_limit_exceeded"
    elif response.status_code == 413:
        record["event"] = "body_too_large"
    elif response.status_code >= 500:
        record["event"] = "server_error"

    _audit_log.info(json.dumps(record))
    return response


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "connect-src 'self' https://yahtzee-api.onrender.com https://games.buffingchi.com; "
        "frame-ancestors 'none'"
    )
    if "server" in response.headers:
        del response.headers["server"]
    return response


# ---------------------------------------------------------------------------
# Session-isolated Yahtzee state
# ---------------------------------------------------------------------------

_MAX_SESSIONS = 500
_sessions: OrderedDict[str, YahtzeeGame | None] = OrderedDict()


def _evict_if_full() -> None:
    while len(_sessions) >= _MAX_SESSIONS:
        _sessions.popitem(last=False)


def _get_game(session_id: str) -> YahtzeeGame:
    game = _sessions.get(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="No game in progress. POST /game/new first.")
    return game


def _state_response(game: YahtzeeGame) -> GameStateResponse:
    return GameStateResponse(
        dice=game.dice,
        held=game.held,
        rolls_used=game.rolls_used,
        round=game.round,
        scores=game.scores,
        game_over=game.game_over,
        upper_subtotal=game.upper_subtotal(),
        upper_bonus=game.upper_bonus(),
        total_score=game.total_score(),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/game/new", response_model=GameStateResponse)
@limiter.limit("10/minute")
def new_game(request: Request) -> GameStateResponse:
    sid = get_session_id(request)
    _evict_if_full()
    _sessions[sid] = YahtzeeGame()
    return _state_response(_sessions[sid])


@app.get("/game/state", response_model=GameStateResponse)
@limiter.limit("60/minute")
def get_state(request: Request) -> GameStateResponse:
    sid = get_session_id(request)
    return _state_response(_get_game(sid))


@app.post("/game/roll", response_model=GameStateResponse)
@limiter.limit("30/minute")
def roll(request: Request, body: RollRequest) -> GameStateResponse:
    sid = get_session_id(request)
    game = _get_game(sid)
    if len(body.held) != 5:
        raise HTTPException(status_code=422, detail="'held' must have exactly 5 booleans.")
    try:
        game.roll(body.held)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@app.post("/game/score", response_model=GameStateResponse)
@limiter.limit("20/minute")
def score(request: Request, body: ScoreRequest) -> GameStateResponse:
    sid = get_session_id(request)
    game = _get_game(sid)
    try:
        game.score(body.category)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response(game)


@app.get("/game/possible-scores", response_model=PossibleScoresResponse)
@limiter.limit("60/minute")
def possible_scores(request: Request) -> PossibleScoresResponse:
    sid = get_session_id(request)
    game = _get_game(sid)
    if game.rolls_used == 0:
        return PossibleScoresResponse(possible_scores={})
    return PossibleScoresResponse(possible_scores=game.possible_scores())


@app.get("/health")
@limiter.limit("120/minute")
def health(request: Request) -> dict:
    return {"status": "ok"}
