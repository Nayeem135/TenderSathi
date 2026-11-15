import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models import Tender

PDF_BYTES = b"%PDF-1.7\n%fake test document\n%%EOF\n"


@pytest.fixture(autouse=True)
def upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    return tmp_path


def upload(client, headers, content=PDF_BYTES, filename="Road Works 2026.pdf", **form):
    return client.post(
        "/api/tenders",
        headers=headers,
        files={"file": (filename, content, "application/pdf")},
        data=form,
    )


def stored_files(upload_dir):
    return [p for p in upload_dir.rglob("*") if p.is_file()]


def test_upload_saves_file_and_creates_row(client, auth_headers, db_session, upload_dir):
    response = upload(client, auth_headers())

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Road Works 2026"
    assert body["status"] == "uploaded"
    assert "file_path" not in body

    tender = db_session.scalar(select(Tender))
    assert tender.id == body["id"]
    assert tender.firm_id == body["firm_id"]
    assert (upload_dir / tender.file_path).read_bytes() == PDF_BYTES


def test_upload_uses_given_title(client, auth_headers):
    response = upload(client, auth_headers(), title="  Bridge repair  ")

    assert response.json()["title"] == "Bridge repair"


def test_upload_never_uses_client_filename_on_disk(client, auth_headers, upload_dir):
    upload(client, auth_headers(), filename="../../evil.pdf")

    (stored,) = stored_files(upload_dir)
    assert stored.name != "evil.pdf"
    assert upload_dir in stored.parents


def test_upload_rejects_non_pdf(client, auth_headers, db_session, upload_dir):
    response = upload(client, auth_headers(), content=b"just some text", filename="fake.pdf")

    assert response.status_code == 415
    assert "file" in response.json()["errors"]
    assert db_session.scalar(select(Tender)) is None
    assert stored_files(upload_dir) == []


def test_upload_rejects_oversized_file(client, auth_headers, db_session, upload_dir, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size_mb", 1)
    too_big = PDF_BYTES + b"0" * (1024 * 1024)

    response = upload(client, auth_headers(), content=too_big)

    assert response.status_code == 413
    assert "file" in response.json()["errors"]
    assert db_session.scalar(select(Tender)) is None
    assert stored_files(upload_dir) == []


def test_upload_requires_file(client, auth_headers):
    response = client.post("/api/tenders", headers=auth_headers())

    assert response.status_code == 422
    assert "file" in response.json()["errors"]


def test_tender_routes_require_auth(client):
    assert client.get("/api/tenders").status_code == 401
    assert (
        client.post("/api/tenders", files={"file": ("a.pdf", PDF_BYTES)}).status_code == 401
    )


def test_list_returns_only_own_firms_tenders(client, auth_headers):
    acme = auth_headers("a@acme.com", "Acme")
    other = auth_headers("b@other.com", "Other")
    upload(client, acme, title="Acme one")
    upload(client, acme, title="Acme two")
    upload(client, other, title="Other one")

    acme_titles = [t["title"] for t in client.get("/api/tenders", headers=acme).json()]
    other_titles = [t["title"] for t in client.get("/api/tenders", headers=other).json()]

    assert sorted(acme_titles) == ["Acme one", "Acme two"]
    assert other_titles == ["Other one"]
