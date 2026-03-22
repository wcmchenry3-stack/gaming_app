# Yahtzee Game — Project Guide for Claude

## Project Overview
Single-player Yahtzee game. Python FastAPI backend + Expo (React Native / Web) frontend. Runs locally in the browser. Simple, standard rules.

## Stack
- **Backend:** Python 3, FastAPI, uvicorn (in-memory state, no database)
- **Frontend:** Expo (React Native), TypeScript, runs as Expo Web in browser
- **Communication:** REST JSON over HTTP

## Git Workflow — STRICTLY ENFORCED

- **Remote:** `https://github.com/wcmchenry3-stack/yahtzee_game.git`
- **Branches:**
  - `main` — production, protected
  - `dev` — development integration, protected
  - `feature/<name>` — all new work starts here

### Rules
1. **NEVER push directly to `main` or `dev`**
2. Always create a `feature/<name>` branch from `dev` before starting any work
3. Open a PR from `feature/<name>` → `dev` when the feature is complete
4. Merge `dev` → `main` only for releases
5. Use descriptive branch names: `feature/game-logic`, `feature/scorecard-ui`, etc.

### Typical workflow
```bash
git checkout dev
git checkout -b feature/my-feature
# ... do work, commit ...
git push -u origin feature/my-feature
gh pr create --base dev --title "..." --body "..."
```

## Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# API available at http://localhost:8000
# Auto-docs at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npx expo start --web
# Open http://localhost:8081 in browser
```

## Project Structure
```
yahtzee_game/
├── CLAUDE.md
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── main.py          # FastAPI app, routes, CORS
│   ├── game.py          # All Yahtzee logic (dataclass + scoring)
│   └── models.py        # Pydantic request/response models
└── frontend/
    ├── App.tsx
    └── src/
        ├── api/client.ts           # All fetch() calls, BASE_URL here
        ├── screens/
        │   ├── HomeScreen.tsx
        │   └── GameScreen.tsx      # Owns all game state on frontend
        └── components/
            ├── Die.tsx
            ├── DiceRow.tsx
            ├── Scorecard.tsx
            └── ScoreRow.tsx
```

## Key Conventions
- All Yahtzee rule enforcement is server-side (`game.py`). Frontend disables buttons as UX only.
- Frontend state is always replaced wholesale with the server response after each API call.
- `BASE_URL` in `frontend/src/api/client.ts` — change from `localhost` to LAN IP if testing on a physical device.
- Scoring categories use snake_case keys: `ones`, `twos`, ..., `three_of_a_kind`, `four_of_a_kind`, `full_house`, `small_straight`, `large_straight`, `yahtzee`, `chance`
