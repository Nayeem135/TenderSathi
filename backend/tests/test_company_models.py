from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import CompanyProfile, Firm, PastContract


@pytest.fixture
def firm(db_session):
    firm = Firm(name="Acme Builders")
    db_session.add(firm)
    db_session.commit()
    return firm


def test_profile_can_be_saved_and_read_back(db_session, firm):
    db_session.add(
        CompanyProfile(
            firm_id=firm.id,
            business_type="Construction",
            trade_licence_no="TL-1234",
            tin="123456789012",
            vat_reg="VAT-001",
            annual_turnover=Decimal("30000000.00"),
            liquid_assets=Decimal("7500000.00"),
            years_of_experience=8,
        )
    )
    db_session.commit()

    profile = db_session.scalar(select(CompanyProfile))
    assert profile.firm_id == firm.id
    assert profile.annual_turnover == Decimal("30000000.00")
    assert profile.years_of_experience == 8
    assert profile.updated_at is not None


def test_profile_fields_can_be_left_empty(db_session, firm):
    db_session.add(CompanyProfile(firm_id=firm.id))
    db_session.commit()

    profile = db_session.scalar(select(CompanyProfile))
    assert profile.business_type is None
    assert profile.annual_turnover is None


def test_a_firm_cannot_have_two_profiles(db_session, firm):
    db_session.add(CompanyProfile(firm_id=firm.id))
    db_session.commit()

    db_session.add(CompanyProfile(firm_id=firm.id))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_a_firm_can_have_many_past_contracts(db_session, firm):
    db_session.add_all(
        [
            PastContract(firm_id=firm.id, title="Bridge approach road", client="LGED",
                         value=Decimal("20000000"), type="road construction", year=2024),
            PastContract(firm_id=firm.id, title="Town drainage", value=Decimal("16000000"), year=2023),
        ]
    )
    db_session.commit()

    contracts = db_session.scalars(select(PastContract).order_by(PastContract.year)).all()
    assert [c.title for c in contracts] == ["Town drainage", "Bridge approach road"]
    assert contracts[0].client is None and contracts[0].type is None
