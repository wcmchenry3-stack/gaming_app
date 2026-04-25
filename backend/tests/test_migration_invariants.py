"""Static invariant test: every game_type migration must include lifecycle events (#746).

Loads each alembic migration file, executes its upgrade() function against a
recording op stub, and asserts that every game_type_id (net of any later deletes)
has game_started and game_ended seeded in event_types.

Does NOT require DATABASE_URL — runs offline against the migration source files.
"""

from __future__ import annotations

import importlib.util
import pathlib
import re
import sys
from unittest.mock import MagicMock, patch

VERSIONS_DIR = pathlib.Path(__file__).parent.parent / "alembic" / "versions"
LIFECYCLE_EVENTS = frozenset({"game_started", "game_ended"})


class _OpRecorder:
    """Minimal alembic.op stub that records bulk_insert and execute calls."""

    def __init__(self) -> None:
        self.game_type_ids: set[int] = set()
        self.event_pairs: set[tuple[int, str]] = set()
        self._name_to_id: dict[str, int] = {}

    def bulk_insert(self, table: object, rows: list[dict]) -> None:
        table_name = getattr(table, "name", None)
        for row in rows:
            if table_name == "game_types" and "id" in row:
                gt_id = int(row["id"])
                self.game_type_ids.add(gt_id)
                if "name" in row:
                    self._name_to_id[str(row["name"])] = gt_id
            elif table_name == "event_types" and "game_type_id" in row and "name" in row:
                self.event_pairs.add((int(row["game_type_id"]), str(row["name"])))

    def execute(self, stmt: object) -> None:
        # Track: DELETE FROM game_types WHERE name = 'foo'
        m = re.search(
            r"DELETE\s+FROM\s+game_types\s+WHERE\s+name\s*=\s*'(\w+)'",
            str(stmt),
            re.IGNORECASE,
        )
        if m:
            gt_name = m.group(1)
            if gt_name in self._name_to_id:
                self.game_type_ids.discard(self._name_to_id[gt_name])

    def __getattr__(self, item: str):
        # Return a MagicMock so context-manager ops (batch_alter_table, etc.) also work.
        return MagicMock()


def _run_all_upgrades() -> _OpRecorder:
    recorder = _OpRecorder()
    mock_alembic = MagicMock()
    mock_alembic.op = recorder

    patches: dict[str, object] = {
        "alembic": mock_alembic,
        "alembic.op": recorder,
    }

    for path in sorted(VERSIONS_DIR.glob("*.py")):
        if path.name.startswith("__"):
            continue

        with patch.dict(sys.modules, patches):
            spec = importlib.util.spec_from_file_location(f"_mig_{path.stem}", path)
            assert spec and spec.loader
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore[union-attr]

        if hasattr(mod, "upgrade"):
            mod.op = recorder  # ensure upgrade() sees the recorder (belt-and-suspenders)
            mod.upgrade()

    return recorder


def test_every_game_type_has_lifecycle_events() -> None:
    """Each active game_type_id must have game_started + game_ended in event_types.

    Checks the aggregate state of all migrations in version order. A game_type_id
    that is later deleted (e.g. pachisi, id=5) is excluded from the assertion so
    only IDs still present in game_types must be covered.
    """
    recorder = _run_all_upgrades()

    missing: list[str] = []
    for gt_id in sorted(recorder.game_type_ids):
        seeded = {name for gid, name in recorder.event_pairs if gid == gt_id}
        lacking = LIFECYCLE_EVENTS - seeded
        if lacking:
            missing.append(f"  game_type_id={gt_id} missing {sorted(lacking)}")

    assert not missing, (
        "Some game_types lack lifecycle event_types rows:\n"
        + "\n".join(missing)
        + "\n\nFix: add a migration that inserts 'game_started' and 'game_ended' "
        "into event_types for each affected game_type_id."
    )
