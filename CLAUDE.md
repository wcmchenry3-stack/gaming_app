# Yahtzee Game — Claude Guide
<!-- Global standards: ~/.claude/CLAUDE.md and ~/.claude/standards/ -->

## Stack
- **Backend:** Python 3, FastAPI, uvicorn (in-memory, no DB)
- **Frontend:** Expo TypeScript, runs in browser via Expo Web
- **Docs:** See `docs/` for testing, deployment, and workflow details

## Git Workflow
See [~/.claude/standards/git.md](~/.claude/standards/git.md).
- Never push directly to `main` or `dev`
- Branch: `git checkout dev && git checkout -b feat/<name>`
- PR: `feat/<name>` → `dev` → `main` (releases only)

## Running Locally
```bash
# Backend (Terminal 1)
cd backend && python -m pip install -r requirements.txt
python -m uvicorn main:app --reload   # http://localhost:8000

# Frontend (Terminal 2)
cd frontend && npm install
npx expo start --web                  # http://localhost:8081
```

## Testing
See [~/.claude/standards/testing.md](~/.claude/standards/testing.md) + [`docs/TESTING.md`](docs/TESTING.md) for project-specific test cases.
```bash
cd backend && python -m pytest tests/ -v
```

## Deployment
See [`docs/RENDER.md`](docs/RENDER.md) for Render hosting setup.

## Key Conventions
- All rule enforcement is server-side (`backend/game.py`). Frontend is display only.
- Frontend replaces state wholesale from each API response.
- Scoring category keys: `ones` `twos` `threes` `fours` `fives` `sixes`
  `three_of_a_kind` `four_of_a_kind` `full_house` `small_straight`
  `large_straight` `yahtzee` `chance`
- `EXPO_PUBLIC_API_URL` env var overrides `BASE_URL` in `frontend/src/api/client.ts`.
