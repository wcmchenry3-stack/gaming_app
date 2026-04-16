"""Contract tests for shared vocabulary (#537).

Verifies that frontend/src/api/vocab.ts stays in sync with backend/vocab.py.
These tests run in CI on every push — a drift between the Python enum and the
committed TypeScript file will fail the build with an actionable error message.
"""

from __future__ import annotations

import re
from pathlib import Path

from vocab import GameOutcome

_REPO_ROOT = Path(__file__).parents[2]
_VOCAB_TS = _REPO_ROOT / "frontend" / "src" / "api" / "vocab.ts"


def _parse_ts_outcomes() -> set[str]:
    """Extract string literals from the GAME_OUTCOMES array in vocab.ts."""
    content = _VOCAB_TS.read_text(encoding="utf-8")
    # Grab everything between `GAME_OUTCOMES = [` and the closing `]`
    match = re.search(r"GAME_OUTCOMES\s*=\s*\[(.*?)\]", content, re.DOTALL)
    assert match, f"Could not find GAME_OUTCOMES array in {_VOCAB_TS}"
    return set(re.findall(r'"([^"]+)"', match.group(1)))


def test_ts_vocab_file_exists() -> None:
    assert _VOCAB_TS.exists(), f"Missing {_VOCAB_TS} — run: python backend/scripts/gen_vocab_ts.py"


def test_game_outcome_ts_in_sync() -> None:
    """GAME_OUTCOMES in vocab.ts must exactly match GameOutcome in vocab.py."""
    py_values = {v.value for v in GameOutcome}
    ts_values = _parse_ts_outcomes()
    assert ts_values == py_values, (
        "frontend/src/api/vocab.ts is out of sync with backend/vocab.py.\n"
        f"  In Python only: {py_values - ts_values}\n"
        f"  In TypeScript only: {ts_values - py_values}\n"
        "Re-generate: python backend/scripts/gen_vocab_ts.py > frontend/src/api/vocab.ts"
    )


def test_game_outcome_enum_values() -> None:
    """Regression guard — no value should be silently removed from GameOutcome."""
    expected = {"win", "loss", "push", "blackjack", "completed", "abandoned", "kept_playing"}
    assert {v.value for v in GameOutcome} == expected
