# Testing Guide

## Backend

### Setup
```bash
cd backend && python -m pip install -r requirements.txt
```

### Running
```bash
# All tests
python -m pytest tests/ -v

# By file
python -m pytest tests/test_game.py -v       # Yahtzee game logic
python -m pytest tests/test_api.py -v        # Yahtzee API endpoints
python -m pytest tests/test_fruit_merge_api.py -v  # Fruit Merge leaderboard API

# With coverage
python -m pytest tests/ -v --cov=. --cov-report=term-missing
```

### Structure
```
backend/tests/
├── __init__.py
├── test_game.py              # YahtzeeGame unit tests — all 13 scoring categories
├── test_api.py               # Yahtzee FastAPI endpoints via TestClient
└── test_fruit_merge_api.py   # Fruit Merge leaderboard endpoints via TestClient
```

### What's Tested

**test_game.py**
- All 13 scoring categories (hit and miss cases)
- Upper section bonus (triggers at ≥63)
- Roll logic, roll count enforcement (max 3), held dice
- Scoring validation: must roll first, no duplicates, unknown category
- Round advancement, game-over after round 13
- `possible_scores()` only returns unfilled categories

**test_api.py**
- `POST /game/new`, `GET /game/state`, `POST /game/roll`, `POST /game/score`, `GET /game/possible-scores`

**test_fruit_merge_api.py**
- `POST /fruit-merge/score` — valid submission (201), invalid payloads (422)
- `GET /fruit-merge/scores` — empty initially, sorted descending, capped at 10

### Notes
- API tests use FastAPI's `TestClient` (no running server needed).
- Each test file has an `autouse` fixture that resets in-memory state before/after each test.
- Game logic tests set `game.dice` and `game.rolls_used` directly to avoid randomness.

---

## Frontend

### Setup
```bash
cd frontend && npm install
```

### Running
```bash
npm test
```

### Structure
```
frontend/src/
├── game/fruit-merge/__tests__/
│   ├── scoring.test.ts     # scoreForMerge() pure function
│   └── fruitQueue.test.ts  # FruitQueue peek/consume/bounds
└── theme/__tests__/
    └── fruitSets.test.ts   # All fruit set structural invariants
```

### What's Tested

**scoring.test.ts**
- `scoreForMerge(tier)` returns correct points per tier
- Values double each tier (tiers 0–9)
- Tier 10 (Watermelon) returns the disappear bonus (256)
- Cumulative scoring adds correctly

**fruitQueue.test.ts**
- `peek()` and `peekNext()` return tiers within `[0, MAX_SPAWN_TIER]`
- `consume()` returns the current peek value
- Queue advances correctly after consume
- Never spawns above `MAX_SPAWN_TIER` across 200 samples

**fruitSets.test.ts**
- All 3 sets (fruits, gems, planets) define exactly 11 tiers
- No duplicate tiers within a set; all tiers 0–10 covered
- Every fruit has non-empty name, emoji, and color
- Radii increase monotonically with tier
- Radii are identical across all sets for the same tier (physics skin-agnostic)

### Notes
- Physics engine (Matter.js) is not unit-tested — third-party, no jest DOM available.
- Only pure logic modules are tested (no React components, no canvas).
