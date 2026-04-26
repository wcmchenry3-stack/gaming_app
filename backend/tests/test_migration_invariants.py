"""Static invariant tests: migration + frontend/backend event-type contract (#746).

Does NOT require DATABASE_URL — runs offline against migration source files and
the frontend TypeScript config.

Tests:
  test_every_game_type_has_lifecycle_events — each active game_type_id must
    have game_started + game_ended seeded in event_types across all migrations.

  test_event_queue_config_names_are_seeded_in_backend — every event type name
    declared in frontend/src/game/_shared/eventQueueConfig.ts (LIFECYCLE_EVENTS
    + MID_EVENTS) must exist in at least one game's event_types rows across all
    migrations, so frontend-declared event names can never drift silently from
    the backend schema.
"""

from __future__ import annotations

import importlib.util
import pathlib
import re
import sys
from unittest.mock import MagicMock, patch

import pytest

VERSIONS_DIR = pathlib.Path(__file__).parent.parent / "alembic" / "versions"
EVENT_CONFIG_TS = (
    pathlib.Path(__file__).parent.parent.parent
    / "frontend"
    / "src"
    / "game"
    / "_shared"
    / "eventQueueConfig.ts"
)
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


def _parse_frontend_event_names() -> set[str]:
    """Extract all string literals from LIFECYCLE_EVENTS and MID_EVENTS in eventQueueConfig.ts."""
    if not EVENT_CONFIG_TS.exists():
        return set()
    text = EVENT_CONFIG_TS.read_text(encoding="utf-8")
    names: set[str] = set()
    for match in re.finditer(
        r"(?:LIFECYCLE_EVENTS|MID_EVENTS)\s*=\s*new Set\(\[([^\]]+)\]\)", text
    ):
        names.update(re.findall(r'"([^"]+)"', match.group(1)))
    return names


_ALEMBIC_VERSION_MAX_LEN = 32  # alembic_version.version_num is VARCHAR(32)


def test_revision_ids_fit_in_alembic_version_column() -> None:
    """All migration revision IDs must be ≤ 32 chars to fit in alembic_version VARCHAR(32).

    Regression guard for the bug that blocked deploys via migrations 0003 and 0010:
    alembic writes version_num to the DB after running upgrade(), and Postgres rejects
    values longer than VARCHAR(32) with StringDataRightTruncation, rolling back the
    entire migration transaction and leaving the service undeployable.
    """
    too_long: list[str] = []
    for path in sorted(VERSIONS_DIR.glob("*.py")):
        if path.name.startswith("__"):
            continue
        text = path.read_text(encoding="utf-8")
        m = re.search(r'^revision\s*:\s*str\s*=\s*"([^"]+)"', text, re.MULTILINE)
        if m:
            rev_id = m.group(1)
            if len(rev_id) > _ALEMBIC_VERSION_MAX_LEN:
                too_long.append(f"  {path.name}: '{rev_id}' ({len(rev_id)} chars)")

    assert not too_long, (
        "These migration revision IDs exceed VARCHAR(32) and will break 'alembic upgrade head':\n"
        + "\n".join(too_long)
        + "\n\nFix: shorten the revision string to ≤ 32 characters."
    )


def test_event_queue_config_names_are_seeded_in_backend() -> None:
    """Every event type declared in frontend/eventQueueConfig.ts must exist in at
    least one game's event_types rows across all migrations (#746 PR-B).

    This catches frontend/backend drift: if a developer adds a new event name to
    LIFECYCLE_EVENTS or MID_EVENTS without a matching backend migration, CI fails
    immediately rather than silently dead-lettering events in production.
    """
    if not EVENT_CONFIG_TS.exists():
        pytest.skip(f"eventQueueConfig.ts not found at {EVENT_CONFIG_TS}")

    frontend_names = _parse_frontend_event_names()
    assert frontend_names, "Could not parse any event names from eventQueueConfig.ts"

    recorder = _run_all_upgrades()
    all_seeded_names = {name for _, name in recorder.event_pairs}

    unmatched = sorted(frontend_names - all_seeded_names)
    assert not unmatched, (
        "These event types are declared in eventQueueConfig.ts but not seeded in any "
        "backend event_types migration:\n"
        + "\n".join(f"  • {n}" for n in unmatched)
        + "\n\nFix: add the missing event_types rows to the relevant migration(s) "
        "so the backend can accept these event names."
    )
