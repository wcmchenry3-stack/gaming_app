"""add game_entitlements table (#1050)

Revision ID: 0014_add_game_entitlements
Revises: 0013_add_freecell_game_type
Create Date: 2026-04-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_add_game_entitlements"
down_revision: Union[str, None] = "0013_add_freecell_game_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "game_entitlements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("game_slug", sa.Text(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "game_entitlements_session_id_idx",
        "game_entitlements",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_index("game_entitlements_session_id_idx", table_name="game_entitlements")
    op.drop_table("game_entitlements")
