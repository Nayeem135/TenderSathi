from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.ai.matcher import MatchSummary


class TenderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    title: str
    status: str
    uploaded_at: datetime


class ConditionOut(BaseModel):
    """One condition extracted from a tender (FR-10, FR-11)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    text: str
    page: int | None
    clause: str | None
    numeric_value: Decimal | None
    unit: str | None


class AnalysisOut(BaseModel):
    """The answer to POST /api/tenders/{id}/analyze."""

    tender: TenderOut
    conditions: int  # how many conditions were extracted
    summary: MatchSummary


class ReportItemOut(ConditionOut):
    """A condition with the verdict on whether the firm meets it (FR-12, FR-13)."""

    status: str  # met, not_met or needs_review
    reason: str


class ReportOut(BaseModel):
    """The eligibility report for one tender (FR-14)."""

    tender: TenderOut
    summary: MatchSummary
    results: list[ReportItemOut]
