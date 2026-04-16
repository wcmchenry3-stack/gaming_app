"""Shared vocabulary enums — single source of truth for string constants that
cross system boundaries (Python ↔ DB ↔ TypeScript).

Import from here, never redefine elsewhere. The DB CHECK constraint in
db/models.py and the TypeScript types in frontend/src/api/vocab.ts are both
derived from these enums.

To add or rename an outcome:
  1. Update GameOutcome below.
  2. Generate a new Alembic migration (the CHECK constraint rebuilds from the enum).
  3. Re-run: python scripts/gen_vocab_ts.py > ../frontend/src/api/vocab.ts
"""

from __future__ import annotations

from enum import Enum


class GameOutcome(str, Enum):
    # Result vocabulary — games with a concrete winner/loser (Blackjack).
    WIN = "win"
    LOSS = "loss"
    PUSH = "push"
    BLACKJACK = "blackjack"

    # Lifecycle vocabulary — score-based games (Yacht, Cascade, Twenty48, …).
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    KEPT_PLAYING = "kept_playing"
