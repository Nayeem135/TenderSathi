from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models import CompanyProfile
from app.schemas.company import CompanyProfileIn, CompanyProfileOut, PastContractIn

THIS_YEAR = date.today().year
CONTRACT = {"title": "Bridge approach road", "value": "20000000", "year": 2024}


def error_fields(exc_info):
    """The names of the fields that failed validation."""
    return {error["loc"][0] for error in exc_info.value.errors()}


# --- company profile ----------------------------------------------------------


def test_profile_accepts_valid_data():
    profile = CompanyProfileIn(
        business_type="  Construction ",
        trade_licence_no="TL-1234",
        annual_turnover="30000000.50",
        liquid_assets=0,
        years_of_experience=8,
    )

    assert profile.business_type == "Construction"  # spaces stripped
    assert profile.annual_turnover == Decimal("30000000.50")
    assert profile.liquid_assets == 0  # zero is allowed, only negatives are not


def test_profile_fields_are_all_optional():
    profile = CompanyProfileIn()

    assert profile.tin is None and profile.annual_turnover is None


def test_profile_blank_text_becomes_none():
    profile = CompanyProfileIn(tin="   ", vat_reg="")

    assert profile.tin is None and profile.vat_reg is None


@pytest.mark.parametrize("field", ["annual_turnover", "liquid_assets"])
def test_profile_rejects_negative_money(field):
    with pytest.raises(ValidationError) as exc_info:
        CompanyProfileIn(**{field: "-1"})

    assert error_fields(exc_info) == {field}


def test_profile_rejects_negative_years_of_experience():
    with pytest.raises(ValidationError) as exc_info:
        CompanyProfileIn(years_of_experience=-1)

    assert error_fields(exc_info) == {"years_of_experience"}


def test_profile_rejects_text_longer_than_the_column():
    with pytest.raises(ValidationError) as exc_info:
        CompanyProfileIn(tin="1" * 51)

    assert error_fields(exc_info) == {"tin"}


def test_profile_out_reads_from_a_database_object():
    row = CompanyProfile(id=1, firm_id=7, tin="123", annual_turnover=Decimal("5.00"))
    row.updated_at = date.today()

    out = CompanyProfileOut.model_validate(row)

    assert (out.id, out.firm_id, out.tin) == (1, 7, "123")


# --- past contract ------------------------------------------------------------


def test_contract_accepts_valid_data():
    contract = PastContractIn(**CONTRACT, client=" LGED ", type="")

    assert contract.title == "Bridge approach road"
    assert contract.client == "LGED"
    assert contract.type is None
    assert contract.value == Decimal("20000000")


@pytest.mark.parametrize("title", ["", "   "])
def test_contract_rejects_empty_title(title):
    with pytest.raises(ValidationError) as exc_info:
        PastContractIn(**{**CONTRACT, "title": title})

    assert error_fields(exc_info) == {"title"}


def test_contract_requires_title_value_and_year():
    with pytest.raises(ValidationError) as exc_info:
        PastContractIn()

    assert error_fields(exc_info) == {"title", "value", "year"}


def test_contract_rejects_negative_value():
    with pytest.raises(ValidationError) as exc_info:
        PastContractIn(**{**CONTRACT, "value": "-0.01"})

    assert error_fields(exc_info) == {"value"}


@pytest.mark.parametrize("year", [1990, 2005, THIS_YEAR])
def test_contract_accepts_years_in_range(year):
    assert PastContractIn(**{**CONTRACT, "year": year}).year == year


@pytest.mark.parametrize("year", [1989, THIS_YEAR + 1, 0])
def test_contract_rejects_years_out_of_range(year):
    with pytest.raises(ValidationError) as exc_info:
        PastContractIn(**{**CONTRACT, "year": year})

    assert error_fields(exc_info) == {"year"}
    assert f"between 1990 and {THIS_YEAR}" in str(exc_info.value)
