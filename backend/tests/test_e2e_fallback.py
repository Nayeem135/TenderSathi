"""One run through the whole flow in fallback mode (no Gemini API key):
register -> login -> upload a PDF -> extract conditions -> match -> results."""

from datetime import date
from decimal import Decimal

import pymupdf
from sqlalchemy import select

from app.ai import gemini
from app.ai.extractor import extract_conditions, load_sample_conditions
from app.ai.matcher import MET, NEEDS_REVIEW, NOT_MET, ContractData, ProfileData, match_tender
from app.core.config import settings
from app.models import Condition, EligibilityResult, Tender

LAKH = Decimal(100_000)


def pdf_bytes():
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), "Invitation for tender: road works")
    data = document.tobytes()
    document.close()
    return data


def test_full_flow_in_fallback_mode(client, auth_headers, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    monkeypatch.setattr(settings, "gemini_api_key", "")

    def no_network(*args, **kwargs):
        raise AssertionError("Gemini must not be called in fallback mode")

    monkeypatch.setattr(gemini, "generate_json", no_network)

    # Register, log in, upload.
    headers = auth_headers("owner@example.com", "Acme Builders")
    upload = client.post(
        "/api/tenders",
        headers=headers,
        files={"file": ("road-works.pdf", pdf_bytes(), "application/pdf")},
    )
    assert upload.status_code == 201
    tender_id = upload.json()["id"]
    assert [t["id"] for t in client.get("/api/tenders", headers=headers).json()] == [tender_id]

    # Extract: with no key, the sample conditions are saved for this tender.
    tender = db_session.get(Tender, tender_id)
    conditions = extract_conditions(db_session, tender)

    sample = load_sample_conditions()
    assert [c.text for c in conditions] == [c.text for c in sample]
    assert db_session.scalars(select(Condition.tender_id).distinct()).all() == [tender_id]

    # Match against a firm that passes three of the four numeric conditions.
    profile = ProfileData(
        annual_turnovers={2023: 300 * LAKH, 2024: 350 * LAKH, 2025: 400 * LAKH},  # average 350
        liquid_assets=50 * LAKH,  # below the required 75
        years_of_experience=8,
        contracts=(
            ContractData("Bridge approach road", 200 * LAKH, date(2024, 3, 1)),
            ContractData("Town drainage", 160 * LAKH, date(2023, 6, 15)),
        ),
    )
    summary = match_tender(db_session, tender, profile, today=date(2026, 11, 15))

    assert (summary.met, summary.not_met, summary.needs_review) == (3, 1, 6)
    assert summary.total == len(sample)

    # One saved result per condition, each with a reason.
    results = db_session.scalars(select(EligibilityResult)).all()
    assert sorted(r.condition_id for r in results) == sorted(c.id for c in conditions)
    assert all(r.reason for r in results)

    status_of = {r.condition.text: r.status for r in results}

    def status_containing(phrase):
        (status,) = [s for text, s in status_of.items() if phrase in text]
        return status

    assert status_containing("turnover") == MET
    assert status_containing("years of general experience") == MET
    assert status_containing("works of similar nature") == MET
    assert status_containing("liquid assets") == NOT_MET
    # Text conditions can't be checked without the LLM.
    assert status_containing("trade licence") == NEEDS_REVIEW
