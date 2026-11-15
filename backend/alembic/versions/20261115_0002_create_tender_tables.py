"""create tenders, conditions and eligibility_results

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="uploaded", nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["firm_id"], ["firms.id"], name=op.f("fk_tenders_firm_id_firms"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tenders")),
    )
    op.create_index(op.f("ix_tenders_firm_id"), "tenders", ["firm_id"], unique=False)

    op.create_table(
        "conditions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tender_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("clause", sa.String(length=64), nullable=True),
        sa.Column("numeric_value", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(
            ["tender_id"],
            ["tenders.id"],
            name=op.f("fk_conditions_tender_id_tenders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_conditions")),
    )
    op.create_index(op.f("ix_conditions_tender_id"), "conditions", ["tender_id"], unique=False)

    op.create_table(
        "eligibility_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("condition_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["condition_id"],
            ["conditions.id"],
            name=op.f("fk_eligibility_results_condition_id_conditions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_eligibility_results")),
    )
    op.create_index(
        op.f("ix_eligibility_results_condition_id"),
        "eligibility_results",
        ["condition_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_eligibility_results_condition_id"), table_name="eligibility_results")
    op.drop_table("eligibility_results")
    op.drop_index(op.f("ix_conditions_tender_id"), table_name="conditions")
    op.drop_table("conditions")
    op.drop_index(op.f("ix_tenders_firm_id"), table_name="tenders")
    op.drop_table("tenders")
