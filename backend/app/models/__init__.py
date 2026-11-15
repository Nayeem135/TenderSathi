"""Import every model here so Alembic autogenerate sees it."""

from app.models.firm import Firm
from app.models.user import User

__all__ = ["Firm", "User"]
