"""Company profile models (FR-02).

A "model" is a Python class that describes one database table. Each
attribute written as `name: Mapped[type] = mapped_column(...)` becomes one
column in that table. SQLAlchemy turns rows into objects of these classes
and back, so the rest of the code never has to write SQL by hand.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CompanyProfile(Base):
    """The details of one firm. Each firm has at most one profile."""

    # The name of the table in the database.
    __tablename__ = "company_profiles"

    # Every row needs a unique id. primary_key=True makes the database
    # number the rows automatically: 1, 2, 3, ...
    id: Mapped[int] = mapped_column(primary_key=True)

    # Which firm this profile belongs to.
    # - ForeignKey("firms.id") means the value must be the id of a real row
    #   in the firms table.
    # - ondelete="CASCADE" means: if the firm is deleted, delete its profile too.
    # - unique=True means no two profiles can have the same firm_id, which is
    #   what makes it "one profile per firm".
    firm_id: Mapped[int] = mapped_column(
        ForeignKey("firms.id", ondelete="CASCADE"), unique=True
    )

    # `str | None` means the column may be left empty (NULL), so a firm can
    # save its profile bit by bit. String(100) is the maximum length.
    business_type: Mapped[str | None] = mapped_column(String(100))
    trade_licence_no: Mapped[str | None] = mapped_column(String(100))
    tin: Mapped[str | None] = mapped_column(String(50))
    vat_reg: Mapped[str | None] = mapped_column(String(50))

    # Money is stored as an exact decimal, never a float, so that amounts do
    # not pick up rounding errors. Numeric(18, 2) allows up to 18 digits with
    # 2 after the decimal point. Amounts are in plain currency units
    # (30000000, not "300 lakh").
    annual_turnover: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    liquid_assets: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # No mapped_column() needed here: a plain whole-number column that may be empty.
    years_of_experience: Mapped[int | None]

    # When the profile was last saved.
    # - server_default=func.now() fills in the current time when the row is created.
    # - onupdate=func.now() refreshes it every time the row is changed.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PastContract(Base):
    """One contract a firm completed in the past. A firm can have many."""

    __tablename__ = "past_contracts"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Not unique this time, because one firm has many contracts.
    # index=True makes "all contracts of firm X" fast to look up.
    firm_id: Mapped[int] = mapped_column(
        ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )

    # `str` without `| None` means the column is required.
    title: Mapped[str] = mapped_column(String(255))
    client: Mapped[str | None] = mapped_column(String(255))

    # Contract value in plain currency units, like the amounts above.
    value: Mapped[Decimal] = mapped_column(Numeric(18, 2))

    # The kind of work, for example "road construction".
    type: Mapped[str | None] = mapped_column(String(100))

    # The year the contract was completed, for example 2024.
    year: Mapped[int]
