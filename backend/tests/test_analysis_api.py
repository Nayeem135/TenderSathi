"""The analysis endpoints: POST /api/tenders/{id}/analyze,
GET /api/tenders/{id}/conditions and GET /api/tenders/{id}/report.

The happy path through all three is in test_e2e_fallback.py; these tests
cover access control and failures."""

from decimal import Decimal

import pymupdf
import pytest

from app.ai import gemini
from app.ai.extractor import load_sample_conditions
from app.core.config import settings

LAKH = Decimal(100_000)
SAMPLE_COUNT = len(load_sample_conditions())


def pdf_bytes(text="Invitation for tender: road works"):
    document = pymupdf.open()
    page = document.new_page()
    if text:
        page.insert_text((72, 72), text)
    data = document.tobytes()
    document.close()
    return data


@pytest.fixture(autouse=True)
def fallback_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    monkeypatch.setattr(settings, "gemini_api_key", "")


def upload(client, headers, content=None):
    response = client.post(
        "/api/tenders",
        headers=headers,
        files={"file": ("tender.pdf", content or pdf_bytes(), "application/pdf")},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def analyze(client, headers, tender_id):
    return client.post(f"/api/tenders/{tender_id}/analyze", headers=headers)


def get(client, headers, tender_id, what):
    return client.get(f"/api/tenders/{tender_id}/{what}", headers=headers)


def tender_status(client, headers, tender_id):
    (tender,) = [t for t in client.get("/api/tenders", headers=headers).json() if t["id"] == tender_id]
    return tender["status"]


def test_report_before_analysis_is_empty(client, auth_headers):
    headers = auth_headers()
    tender_id = upload(client, headers)

    report = get(client, headers, tender_id, "report").json()

    assert report["results"] == []
    assert report["summary"]["total"] == 0
    assert report["summary"]["headline"] == "0 of 0 conditions met"
    assert get(client, headers, tender_id, "conditions").json() == []


def test_analysis_uses_the_firms_saved_profile(client, auth_headers):
    headers = auth_headers()
    tender_id = upload(client, headers)

    before = analyze(client, headers, tender_id).json()["summary"]
    client.put("/api/profile", headers=headers, json={"liquid_assets": str(100 * LAKH)})
    after = analyze(client, headers, tender_id).json()["summary"]

    assert after["met"] == before["met"] + 1


def test_analyzing_again_replaces_the_conditions(client, auth_headers):
    headers = auth_headers()
    tender_id = upload(client, headers)

    analyze(client, headers, tender_id)
    first = get(client, headers, tender_id, "conditions").json()
    analyze(client, headers, tender_id)
    second = get(client, headers, tender_id, "conditions").json()

    assert len(second) == len(first) == SAMPLE_COUNT
    assert {c["id"] for c in first}.isdisjoint(c["id"] for c in second)
    assert len(get(client, headers, tender_id, "report").json()["results"]) == SAMPLE_COUNT


@pytest.mark.parametrize("method, what", [("post", "analyze"), ("get", "conditions"), ("get", "report")])
def test_another_firms_tender_is_not_found(client, auth_headers, method, what):
    owner = auth_headers("owner@example.com", "Owner Ltd")
    tender_id = upload(client, owner)
    analyze(client, owner, tender_id)
    other = auth_headers("other@example.com", "Other Ltd")

    response = getattr(client, method)(f"/api/tenders/{tender_id}/{what}", headers=other)

    assert response.status_code == 404
    assert response.json()["detail"] == "Tender not found"


@pytest.mark.parametrize("method, what", [("post", "analyze"), ("get", "conditions"), ("get", "report")])
def test_unknown_tender_is_not_found(client, auth_headers, method, what):
    response = getattr(client, method)(f"/api/tenders/9999/{what}", headers=auth_headers())

    assert response.status_code == 404


@pytest.mark.parametrize("method, what", [("post", "analyze"), ("get", "conditions"), ("get", "report")])
def test_login_is_required(client, method, what):
    assert getattr(client, method)(f"/api/tenders/1/{what}").status_code == 401


def test_scanned_pdf_fails_with_422(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    headers = auth_headers()
    tender_id = upload(client, headers, pdf_bytes(text=""))  # a page with no text

    response = analyze(client, headers, tender_id)

    assert response.status_code == 422
    assert "no extractable text" in response.json()["detail"]
    assert tender_status(client, headers, tender_id) == "failed"


def test_gemini_failure_keeps_the_earlier_analysis(client, auth_headers, monkeypatch):
    headers = auth_headers()
    tender_id = upload(client, headers)
    analyze(client, headers, tender_id)  # fallback mode: succeeds

    def broken(*args, **kwargs):
        raise gemini.GeminiError("Gemini request failed: timeout")

    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(gemini, "generate_json", broken)
    response = analyze(client, headers, tender_id)

    assert response.status_code == 502
    assert "timeout" in response.json()["detail"]
    assert tender_status(client, headers, tender_id) == "failed"
    assert len(get(client, headers, tender_id, "conditions").json()) == SAMPLE_COUNT
    assert len(get(client, headers, tender_id, "report").json()["results"]) == SAMPLE_COUNT


# --- deleting a tender --------------------------------------------------------


def test_delete_removes_the_tender_its_analysis_and_its_file(client, auth_headers, db_session, tmp_path):
    from sqlalchemy import func, select

    from app.models import Condition, EligibilityResult, Tender

    headers = auth_headers()
    tender_id = upload(client, headers)
    analyze(client, headers, tender_id)
    stored = [p for p in tmp_path.rglob("*") if p.is_file()]
    assert len(stored) == 1

    response = client.delete(f"/api/tenders/{tender_id}", headers=headers)

    assert response.status_code == 204
    assert client.get("/api/tenders", headers=headers).json() == []
    assert get(client, headers, tender_id, "report").status_code == 404
    assert db_session.scalar(select(func.count()).select_from(Tender)) == 0
    assert db_session.scalar(select(func.count()).select_from(Condition)) == 0
    assert db_session.scalar(select(func.count()).select_from(EligibilityResult)) == 0
    assert not stored[0].exists()


def test_cannot_delete_another_firms_tender(client, auth_headers):
    owner = auth_headers("owner@example.com", "Owner Ltd")
    tender_id = upload(client, owner)
    other = auth_headers("other@example.com", "Other Ltd")

    assert client.delete(f"/api/tenders/{tender_id}", headers=other).status_code == 404
    assert len(client.get("/api/tenders", headers=owner).json()) == 1


def test_delete_requires_login(client):
    assert client.delete("/api/tenders/1").status_code == 401
