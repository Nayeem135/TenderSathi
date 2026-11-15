"""create company_profiles and past_contracts

A migration is a small script that changes the database structure.
upgrade() applies the change; downgrade() undoes it. Alembic runs the
migrations in order, using `down_revision` to know which one comes before.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("business_type", sa.String(length=100), nullable=True),
        sa.Column("trade_licence_no", sa.String(length=100), nullable=True),
        sa.Column("tin", sa.String(length=50), nullable=True),
        sa.Column("vat_reg", sa.String(length=50), nullable=True),
        sa.Column("annual_turnover", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("liquid_assets", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("years_of_experience", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["firm_id"],
            ["firms.id"],
            name=op.f("fk_company_profiles_firm_id_firms"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_company_profiles")),
        # One profile per firm.
        sa.UniqueConstraint("firm_id", name=op.f("uq_company_profiles_firm_id")),
    )

    op.create_table(
        "past_contracts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("firm_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("client", sa.String(length=255), nullable=True),
        sa.Column("value", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["firm_id"],
            ["firms.id"],
            name=op.f("fk_past_contracts_firm_id_firms"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_past_contracts")),
    )
    op.create_index(op.f("ix_past_contracts_firm_id"), "past_contracts", ["firm_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_past_contracts_firm_id"), table_name="past_contracts")
    op.drop_table("past_contracts")
    op.drop_table("company_profiles")
