"""One run through the whole flow in fallback mode (no Gemini API key), using
only the HTTP API, as the frontend does:
register -> login -> upload a PDF -> fill in the company profile ->
analyze (extract conditions, then match) -> conditions -> report."""

from datetime import date
from decimal import Decimal

import pymupdf

from app.ai import gemini
from app.ai.extractor import load_sample_conditions
from app.ai.matcher import MET, NEEDS_REVIEW, NOT_MET
from app.core.config import settings

LAKH = Decimal(100_000)


def pdf_bytes():
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), "Invitation for tender: road works")
    data = document.tobytes()
    document.close()
    return data


def test_full_flow_in_fallback_mode(client, auth_headers, tmp_path, monkeypatch):
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

    # The firm fills in its profile: it passes three of the four numeric
    # conditions in the sample.
    saved = client.put(
        "/api/profile",
        headers=headers,
        json={
            "annual_turnover": str(350 * LAKH),  # required: 300 lakh
            "liquid_assets": str(50 * LAKH),  # required: 75 lakh
            "years_of_experience": 8,  # required: 5
        },
    )
    assert saved.status_code == 200
    # Two contracts of at least 150 lakh, both within the last 5 years.
    this_year = date.today().year
    for title, lakh, year in [("Bridge approach road", 200, this_year - 1), ("Town drainage", 160, this_year - 2)]:
        added = client.post(
            "/api/profile/contracts",
            headers=headers,
            json={"title": title, "value": str(lakh * LAKH), "year": year},
        )
        assert added.status_code == 201

    # Analyze: with no key, the sample conditions are extracted, then matched
    # against the saved profile.
    analysis = client.post(f"/api/tenders/{tender_id}/analyze", headers=headers)
    assert analysis.status_code == 200, analysis.text
    body = analysis.json()
    sample = load_sample_conditions()
    assert body["tender"]["status"] == "analyzed"
    assert body["conditions"] == len(sample)
    assert body["summary"] == {
        "met": 3,
        "not_met": 1,
        "needs_review": 6,
        "total": len(sample),
        "headline": f"3 of {len(sample)} conditions met",
    }

    # The conditions, with page and clause kept.
    conditions = client.get(f"/api/tenders/{tender_id}/conditions", headers=headers).json()
    assert [c["text"] for c in conditions] == [c.text for c in sample]
    assert all(c["page"] and c["clause"] for c in conditions)

    # The report: one verdict with a reason per condition.
    report = client.get(f"/api/tenders/{tender_id}/report", headers=headers).json()
    assert report["summary"] == body["summary"]
    assert [r["id"] for r in report["results"]] == [c["id"] for c in conditions]
    assert all(r["reason"] for r in report["results"])

    def status_containing(phrase):
        (status,) = [r["status"] for r in report["results"] if phrase in r["text"]]
        return status

    assert status_containing("turnover") == MET
    assert status_containing("years of general experience") == MET
    assert status_containing("works of similar nature") == MET
    assert status_containing("liquid assets") == NOT_MET
    # Text conditions can't be checked without the LLM.
    assert status_containing("trade licence") == NEEDS_REVIEW
