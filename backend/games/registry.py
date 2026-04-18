"""Game module registry (#540).

Maps each ``GameType`` string value to its ``GameModule`` instance.
``service.py`` uses this for generic dispatch instead of ``if name ==`` branches.

To register a new game: import its module singleton and add an entry below.
"""

from __future__ import annotations

from blackjack.module import module as blackjack_module
from cascade.module import module as cascade_module

from games.protocol import GameModule

# Keyed by GameType.value (str) so lookups work directly against the name
# column returned by DB queries.
_REGISTRY: dict[str, GameModule] = {
    blackjack_module.game_type.value: blackjack_module,
    cascade_module.game_type.value: cascade_module,
}


def get_module(game_type_name: str) -> GameModule | None:
    """Return the GameModule for *game_type_name*, or None if unregistered."""
    return _REGISTRY.get(game_type_name)
