"""Import every model here so Alembic autogenerate sees it."""

from app.models.company import CompanyProfile, PastContract
from app.models.firm import Firm
from app.models.tender import Condition, EligibilityResult, Tender
from app.models.user import User

__all__ = [
    "CompanyProfile",
    "Condition",
    "EligibilityResult",
    "Firm",
    "PastContract",
    "Tender",
    "User",
]
