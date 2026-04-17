"""GameModule Protocol — single contract for all game modules (#540).

Any object with a ``game_type`` attribute and a ``stats_shape`` method
satisfies this Protocol without inheriting from it (structural subtyping).

Adding a new game
-----------------
1. Create ``backend/<game>/module.py`` with a class whose instance passes
   ``isinstance(instance, GameModule)``.
2. Register it in ``backend/games/registry.py``.
3. Implement ``stats_shape`` to transform the raw aggregate dict into the
   game's final API shape.  See ``backend/blackjack/module.py`` for an
   example that renames keys; see ``backend/cascade/module.py`` for the
   default pass-through pattern.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from vocab import GameType


@runtime_checkable
class GameModule(Protocol):
    """Structural interface every game module must satisfy.

    Attributes
    ----------
    game_type:
        The ``GameType`` enum value that identifies this module in the DB and
        the registry.  Must be a class-level constant so it is accessible
        without instantiation.

    Methods
    -------
    stats_shape(raw_stats):
        Transform a raw aggregate stats dict (produced by
        ``games/service.py``) into the final shape for the ``/stats/me``
        API response.

        ``raw_stats`` keys
            played         int
            best           int | None   (highest ``final_score``)
            avg            float | None (mean ``final_score``)
            last_played_at datetime | None
            latest_score   int | None   (``final_score`` of most-recent game)

        Return a dict whose keys are a subset of ``GameTypeStats`` fields.
        Omitted keys default to ``None`` in the caller.
    """

    game_type: GameType

    def stats_shape(self, raw_stats: dict) -> dict: ...
