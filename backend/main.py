import os

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from game import YahtzeeGame
from models import GameStateResponse, PossibleScoresResponse, RollRequest, ScoreRequest
from fruit_merge.router import router as fruit_merge_router
from blackjack.router import router as blackjack_router
from ludo.router import router as ludo_router

app = FastAPI(title="Gaming App API")
app.include_router(fruit_merge_router, prefix="/fruit-merge")
app.include_router(blackjack_router, prefix="/blackjack")
app.include_router(ludo_router, prefix="/ludo")


# CORS — scoped to known origins; set ALLOWED_ORIGINS env var (comma-separated) in production.
# Render's fromService with property: url returns a bare subdomain slug (e.g. "yahtzee-frontend-xyz")
# rather than a full URL, so we normalise it to https://<slug>.onrender.com when needed.
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


game: YahtzeeGame | None = None


def _state_response() -> GameStateResponse:
    assert game is not None
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


@app.post("/game/new", response_model=GameStateResponse)
def new_game():
    global game
    game = YahtzeeGame()
    return _state_response()


@app.get("/game/state", response_model=GameStateResponse)
def get_state():
    if game is None:
        raise HTTPException(status_code=404, detail="No game in progress. POST /game/new first.")
    return _state_response()


@app.post("/game/roll", response_model=GameStateResponse)
def roll(request: RollRequest):
    if game is None:
        raise HTTPException(status_code=404, detail="No game in progress. POST /game/new first.")
    if len(request.held) != 5:
        raise HTTPException(status_code=422, detail="'held' must have exactly 5 booleans.")
    try:
        game.roll(request.held)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response()


@app.post("/game/score", response_model=GameStateResponse)
def score(request: ScoreRequest):
    if game is None:
        raise HTTPException(status_code=404, detail="No game in progress. POST /game/new first.")
    try:
        game.score(request.category)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _state_response()


@app.get("/game/possible-scores", response_model=PossibleScoresResponse)
def possible_scores():
    if game is None:
        raise HTTPException(status_code=404, detail="No game in progress. POST /game/new first.")
    if game.rolls_used == 0:
        return PossibleScoresResponse(possible_scores={})
    return PossibleScoresResponse(possible_scores=game.possible_scores())
