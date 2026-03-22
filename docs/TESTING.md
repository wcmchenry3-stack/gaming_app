# Testing Guide

## Setup

Install test dependencies (included in `backend/requirements.txt`):
```bash
cd backend
python -m pip install -r requirements.txt
```

## Running Tests

```bash
# All tests
cd backend && python -m pytest tests/ -v

# Unit tests only (game logic, no server)
python -m pytest tests/test_game.py -v

# API integration tests only
python -m pytest tests/test_api.py -v

# With coverage report
python -m pytest tests/ -v --cov=. --cov-report=term-missing
```

## Test Structure

```
backend/tests/
├── __init__.py
├── test_game.py   # Unit tests — YahtzeeGame logic and all 13 scoring categories
└── test_api.py    # Integration tests — FastAPI endpoints via TestClient
```

## What's Tested

### test_game.py
- All 13 scoring categories (hit and miss cases)
- Upper section bonus (triggers at ≥63, not below)
- Roll logic: first roll ignores held, subsequent rolls respect held
- Roll count enforcement (max 3 per turn)
- Scoring validation: must roll first, no duplicates, unknown category
- Round advancement and dice reset after scoring
- Game-over after round 13
- `possible_scores()` only returns unfilled categories

### test_api.py
- `POST /game/new` — fresh state returned
- `GET /game/state` — 404 when no game, 200 with game
- `POST /game/roll` — valid roll updates state; 400 when rolls exhausted
- `POST /game/score` — valid score advances round; 400 on duplicate; 400 before rolling
- `GET /game/possible-scores` — returns scores when rolled; empty before first roll

## Notes
- API tests use FastAPI's `TestClient` (no running server needed).
- Game logic tests set `game.dice` directly to avoid randomness.
- `game.rolls_used` is set manually in tests where a pre-rolled state is needed.
