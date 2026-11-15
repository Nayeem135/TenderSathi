"""Pydantic schemas for the company profile feature (FR-02).

Models (app/models/company.py) describe database tables. Schemas describe
the JSON that travels through the API:

- "In" schemas check the data a client sends. If anything is wrong, FastAPI
  rejects the request with a 422 and a message per field, before any of our
  own code runs.
- "Out" schemas decide which fields are sent back in the response.
"""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# The earliest year a past contract may have.
MIN_CONTRACT_YEAR = 1990

# Rules for a money amount, written once and reused below:
# - ge=0 means "greater than or equal to 0", so negative amounts are rejected.
# - max_digits / decimal_places match the Numeric(18, 2) database columns.
MONEY = dict(ge=0, max_digits=18, decimal_places=2)


class CompanyProfileIn(BaseModel):
    """The data a client sends to create or update a firm's profile."""

    # Remove spaces from the start and end of every text field, so "  abc "
    # is stored as "abc" and a field of only spaces counts as empty.
    model_config = ConfigDict(str_strip_whitespace=True)

    # Optional text fields: `str | None = None` means the field may be left
    # out. max_length matches the size of the database column.
    business_type: str | None = Field(default=None, max_length=100)
    trade_licence_no: str | None = Field(default=None, max_length=100)
    tin: str | None = Field(default=None, max_length=50)
    vat_reg: str | None = Field(default=None, max_length=50)

    # Optional money fields. `**MONEY` applies the rules defined above.
    annual_turnover: Decimal | None = Field(default=None, **MONEY)
    liquid_assets: Decimal | None = Field(default=None, **MONEY)

    # A whole number that cannot be negative.
    years_of_experience: int | None = Field(default=None, ge=0, le=200)

    # A validator is a function Pydantic runs on a field's value. This one
    # runs on the four text fields and turns an empty string into None, so
    # the database stores "no value" instead of "".
    @field_validator("business_type", "trade_licence_no", "tin", "vat_reg")
    @classmethod
    def empty_text_becomes_none(cls, value: str | None) -> str | None:
        return value or None


class CompanyProfileOut(BaseModel):
    """The profile as it is sent back to the client."""

    # from_attributes=True lets Pydantic read the values straight from a
    # CompanyProfile database object, so a route can simply return the object.
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    business_type: str | None
    trade_licence_no: str | None
    tin: str | None
    vat_reg: str | None
    annual_turnover: Decimal | None
    liquid_assets: Decimal | None
    years_of_experience: int | None
    updated_at: datetime


class PastContractIn(BaseModel):
    """The data a client sends to add or change a past contract."""

    model_config = ConfigDict(str_strip_whitespace=True)

    # Required text: there is no default, so it must be sent, and
    # min_length=1 (checked after the spaces are stripped) rejects "" and "   ".
    title: str = Field(min_length=1, max_length=255)

    # Optional text.
    client: str | None = Field(default=None, max_length=255)
    type: str | None = Field(default=None, max_length=100)

    # Required money amount, not negative.
    value: Decimal = Field(**MONEY)

    # Required; the allowed range is checked by the validator below.
    year: int

    @field_validator("client", "type")
    @classmethod
    def empty_text_becomes_none(cls, value: str | None) -> str | None:
        return value or None

    # The upper limit is "this year", which changes over time, so it is
    # worked out each time a request is checked. Writing Field(le=2026)
    # would be wrong from next January.
    @field_validator("year")
    @classmethod
    def year_in_range(cls, value: int) -> int:
        current_year = date.today().year
        if not MIN_CONTRACT_YEAR <= value <= current_year:
            raise ValueError(f"Year must be between {MIN_CONTRACT_YEAR} and {current_year}")
        return value


class PastContractOut(BaseModel):
    """A past contract as it is sent back to the client."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    title: str
    client: str | None
    value: Decimal
    type: str | None
    year: int
