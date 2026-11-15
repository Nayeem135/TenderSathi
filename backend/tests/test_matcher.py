import json
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.ai import gemini, matcher
from app.ai.extractor import load_sample_conditions
from app.ai.matcher import (
    MET,
    NEEDS_REVIEW,
    NOT_MET,
    ContractData,
    ProfileData,
    evaluate,
    match_tender,
)
from app.core.config import settings
from app.models import Condition, EligibilityResult, Firm, Tender

LAKH = Decimal(100_000)
TODAY = date(2026, 11, 15)


def cond(text, value=None, unit=None, category="financial"):
    return Condition(
        category=category,
        text=text,
        numeric_value=Decimal(str(value)) if value is not None else None,
        unit=unit,
    )


def contract(title, lakh, completed=None):
    return ContractData(title=title, value=lakh * LAKH, completed_on=completed)


def one(condition, profile):
    (outcome,) = evaluate([condition], profile, TODAY)
    return outcome


@pytest.fixture(autouse=True)
def llm(monkeypatch):
    """Gemini mode with a fake model. `llm.verdicts` maps index -> (verdict, reason);
    any numeric condition reaching it is a test failure waiting to be noticed
    via `llm.prompts`."""
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    prompts = []

    def fake(prompt):
        prompts.append(json.loads(prompt))
        sent = prompts[-1]["conditions"]
        return json.dumps(
            {
                "results": [
                    {"index": c["index"], "verdict": v, "reason": r}
                    for c in sent
                    for v, r in [fake.verdicts.get(c["index"], ("uncertain", "Not in the profile."))]
                ]
            }
        )

    fake.prompts = prompts
    fake.verdicts = {}
    monkeypatch.setattr(matcher, "_generate_json", fake)
    return fake


# --- turnover -----------------------------------------------------------------

TURNOVER = cond(
    "Average annual construction turnover over the last 3 years must be at least 300 lakh.",
    300, "lakh",
)  # fmt: skip


def test_turnover_met_uses_average_of_latest_years(llm):
    profile = ProfileData(
        annual_turnovers={2022: 10 * LAKH, 2023: 250 * LAKH, 2024: 300 * LAKH, 2025: 380 * LAKH}
    )

    outcome = one(TURNOVER, profile)

    assert outcome.status == MET
    assert "310 lakh" in outcome.reason and "2023-2025" in outcome.reason
    assert llm.prompts == []


def test_turnover_not_met():
    profile = ProfileData(annual_turnovers={2023: 100 * LAKH, 2024: 200 * LAKH, 2025: 300 * LAKH})

    outcome = one(TURNOVER, profile)

    assert outcome.status == NOT_MET
    assert "200 lakh" in outcome.reason


def test_turnover_with_too_few_years_needs_review():
    profile = ProfileData(annual_turnovers={2024: 900 * LAKH, 2025: 900 * LAKH})

    assert one(TURNOVER, profile).status == NEEDS_REVIEW


def test_turnover_in_crore_is_converted():
    condition = cond("Minimum annual turnover of 2 crore.", 2, "crore")
    profile = ProfileData(annual_turnovers={2025: 250 * LAKH})

    assert one(condition, profile).status == MET


# --- liquid assets ------------------------------------------------------------

LIQUID = cond("Liquid assets or available credit facilities of at least 75 lakh.", 75, "lakh")


@pytest.mark.parametrize(
    "assets, expected",
    [(80 * LAKH, MET), (75 * LAKH, MET), (60 * LAKH, NOT_MET), (None, NEEDS_REVIEW)],
)
def test_liquid_assets(llm, assets, expected):
    assert one(LIQUID, ProfileData(liquid_assets=assets)).status == expected
    assert llm.prompts == []


# --- years of experience ------------------------------------------------------

YEARS = cond("At least 5 years of general experience in construction works.", 5, "years", "experience")


@pytest.mark.parametrize("years, expected", [(8, MET), (5, MET), (3, NOT_MET), (None, NEEDS_REVIEW)])
def test_years_of_experience(llm, years, expected):
    assert one(YEARS, ProfileData(years_of_experience=years)).status == expected
    assert llm.prompts == []


def test_staff_experience_is_not_treated_as_firm_experience(llm):
    condition = cond(
        "The project manager must be a civil engineer with at least 10 years of experience.",
        10, "years", "technical",
    )  # fmt: skip

    one(condition, ProfileData(years_of_experience=20))

    assert len(llm.prompts) == 1  # went to the LLM, not the arithmetic check


# --- past contracts -----------------------------------------------------------

SIMILAR = cond(
    "Must have completed at least 2 works of similar nature, each valued at not less "
    "than 150 lakh, within the last 5 years.",
    150, "lakh", "experience",
)  # fmt: skip


def test_contracts_met_counts_value_and_recency(llm):
    profile = ProfileData(
        contracts=(
            contract("Bridge", 200, date(2024, 3, 1)),
            contract("Road", 150, date(2022, 1, 10)),
            contract("Small drain", 40, date(2025, 1, 1)),
            contract("Old school", 500, date(2015, 1, 1)),
        )
    )

    outcome = one(SIMILAR, profile)

    assert outcome.status == MET
    assert "Bridge" in outcome.reason and "Road" in outcome.reason
    assert "Small drain" not in outcome.reason and "Old school" not in outcome.reason
    assert llm.prompts == []


def test_contracts_not_met():
    profile = ProfileData(
        contracts=(contract("Bridge", 200, date(2024, 3, 1)), contract("Old", 500, date(2015, 1, 1)))
    )

    assert one(SIMILAR, profile).status == NOT_MET


def test_contracts_without_dates_need_review_when_they_could_decide():
    profile = ProfileData(contracts=(contract("Bridge", 200, date(2024, 3, 1)), contract("Undated", 300)))

    assert one(SIMILAR, profile).status == NEEDS_REVIEW


def test_contract_count_as_the_numeric_value():
    condition = cond("Must have completed 3 similar contracts.", 3, "contracts", "experience")
    two = ProfileData(contracts=(contract("A", 1), contract("B", 1)))
    three = ProfileData(contracts=two.contracts + (contract("C", 1),))

    assert one(condition, two).status == NOT_MET
    assert one(condition, three).status == MET


# --- text conditions ----------------------------------------------------------

LICENCE = cond("The bidder must hold a valid trade licence.", category="legal")
TAX = cond("The bidder must have a valid tax identification number.", category="legal")
ISO = cond("The bidder must be ISO 9001 certified.", category="technical")


def test_text_conditions_go_to_llm_with_profile_data(llm):
    llm.verdicts = {0: ("met", "Trade licence valid until 2027."), 1: ("not_met", "No TIN listed.")}
    profile = ProfileData(details={"trade_licence": "valid until 2027-06-30"})

    outcomes = evaluate([LICENCE, TAX, ISO], profile, TODAY)

    assert [o.status for o in outcomes] == [MET, NOT_MET, NEEDS_REVIEW]
    assert outcomes[0].reason == "Trade licence valid until 2027."
    (prompt,) = llm.prompts
    assert prompt["company_profile"]["details"] == {"trade_licence": "valid until 2027-06-30"}
    assert [c["text"] for c in prompt["conditions"]] == [LICENCE.text, TAX.text, ISO.text]


def test_numeric_conditions_are_never_sent_to_llm(llm):
    evaluate([TURNOVER, LICENCE, LIQUID, YEARS, SIMILAR], ProfileData(), TODAY)

    (prompt,) = llm.prompts
    assert [c["text"] for c in prompt["conditions"]] == [LICENCE.text]


def test_outcomes_keep_condition_order(llm):
    llm.verdicts = {0: ("met", "ok"), 1: ("not_met", "no")}
    profile = ProfileData(liquid_assets=80 * LAKH)

    outcomes = evaluate([LICENCE, LIQUID, TAX], profile, TODAY)

    assert [o.status for o in outcomes] == [MET, MET, NOT_MET]
    assert "Liquid assets" in outcomes[1].reason


@pytest.mark.parametrize("failure", ["not json", gemini.GeminiError("offline")])
def test_llm_failure_marks_text_conditions_needs_review(monkeypatch, failure):
    def broken(_):
        if isinstance(failure, Exception):
            raise failure
        return failure

    monkeypatch.setattr(matcher, "_generate_json", broken)

    outcomes = evaluate([LICENCE, LIQUID], ProfileData(liquid_assets=80 * LAKH), TODAY)

    assert [o.status for o in outcomes] == [NEEDS_REVIEW, MET]


def test_condition_missing_from_llm_reply_needs_review(monkeypatch):
    monkeypatch.setattr(
        matcher,
        "_generate_json",
        lambda _: json.dumps({"results": [{"index": 0, "verdict": "met", "reason": "ok"}]}),
    )

    outcomes = evaluate([LICENCE, TAX], ProfileData(), TODAY)

    assert [o.status for o in outcomes] == [MET, NEEDS_REVIEW]


def test_without_api_key_text_conditions_need_review_and_llm_is_not_called(llm, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")

    outcomes = evaluate([LICENCE, LIQUID], ProfileData(liquid_assets=80 * LAKH), TODAY)

    assert [o.status for o in outcomes] == [NEEDS_REVIEW, MET]
    assert llm.prompts == []


# --- saving -------------------------------------------------------------------


@pytest.fixture
def tender(db_session):
    firm = Firm(name="Acme")
    db_session.add(firm)
    db_session.flush()
    tender = Tender(firm_id=firm.id, title="T", file_path="t.pdf")
    tender.conditions = [
        cond(LIQUID.text, 75, "lakh"),
        cond(YEARS.text, 5, "years", "experience"),
        cond(LICENCE.text, category="legal"),
        cond(ISO.text, category="technical"),
    ]
    db_session.add(tender)
    db_session.commit()
    return tender


def test_match_tender_saves_one_result_per_condition_and_returns_counts(db_session, tender, llm):
    llm.verdicts = {0: ("met", "Licence on file.")}
    profile = ProfileData(liquid_assets=80 * LAKH, years_of_experience=2)

    summary = match_tender(db_session, tender, profile, TODAY)

    assert (summary.met, summary.not_met, summary.needs_review, summary.total) == (2, 1, 1, 4)
    results = db_session.scalars(select(EligibilityResult).order_by(EligibilityResult.condition_id)).all()
    assert [r.condition_id for r in results] == [c.id for c in tender.conditions]
    assert [r.status for r in results] == [MET, NOT_MET, MET, NEEDS_REVIEW]
    assert all(r.reason for r in results)


def test_match_tender_rerun_replaces_results(db_session, tender):
    match_tender(db_session, tender, ProfileData(liquid_assets=80 * LAKH), TODAY)
    match_tender(db_session, tender, ProfileData(liquid_assets=10 * LAKH), TODAY)

    results = db_session.scalars(select(EligibilityResult)).all()
    assert len(results) == len(tender.conditions)
    assert results[0].status == NOT_MET


def test_match_tender_without_profile_says_loader_is_not_connected(db_session, tender):
    with pytest.raises(NotImplementedError, match="CompanyProfile"):
        match_tender(db_session, tender)


# --- the sample conditions used by the offline demo ---------------------------


def test_sample_conditions_route_as_expected(llm):
    conditions = [
        Condition(category=c.category, text=c.text, numeric_value=c.numeric_value, unit=c.unit)
        for c in load_sample_conditions()
    ]

    evaluate(conditions, ProfileData(), TODAY)

    sent = [c["text"] for c in llm.prompts[0]["conditions"]]
    numeric = [c.text for c in conditions if c.text not in sent]
    assert len(numeric) == 4  # experience years, similar works, turnover, liquid assets
    assert any("turnover" in t for t in numeric)
    assert any("liquid assets" in t for t in numeric)
    assert not any("tender security" in t for t in numeric)
