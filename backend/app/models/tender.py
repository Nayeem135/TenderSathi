from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[int] = mapped_column(primary_key=True)
    firm_id: Mapped[int] = mapped_column(
        ForeignKey("firms.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    # Relative to the upload root; resolve with app.services.tender_storage.resolve().
    file_path: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(
        String(32), default="uploaded", server_default="uploaded"
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conditions: Mapped[list["Condition"]] = relationship(
        back_populates="tender", cascade="all, delete-orphan", passive_deletes=True
    )


class Condition(Base):
    __tablename__ = "conditions"

    id: Mapped[int] = mapped_column(primary_key=True)
    tender_id: Mapped[int] = mapped_column(
        ForeignKey("tenders.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(64))
    text: Mapped[str] = mapped_column(Text)
    page: Mapped[int | None]
    clause: Mapped[str | None] = mapped_column(String(64))
    numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    unit: Mapped[str | None] = mapped_column(String(32))

    tender: Mapped["Tender"] = relationship(back_populates="conditions")
    eligibility_results: Mapped[list["EligibilityResult"]] = relationship(
        back_populates="condition", cascade="all, delete-orphan", passive_deletes=True
    )


class EligibilityResult(Base):
    __tablename__ = "eligibility_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    condition_id: Mapped[int] = mapped_column(
        ForeignKey("conditions.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    condition: Mapped["Condition"] = relationship(back_populates="eligibility_results")
