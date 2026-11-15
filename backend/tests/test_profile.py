"""Tests for the company profile routes (FR-02).

How these tests work:
- pytest runs every function whose name starts with `test_`.
- The arguments `client`, `auth_headers` and `db_session` are "fixtures"
  from tests/conftest.py. pytest sees the argument name and passes the
  matching fixture in automatically.
    client        sends HTTP requests to the app without starting a server.
    auth_headers  registers a new user in a new firm, logs in, and returns
                  the {"Authorization": "Bearer <token>"} header to send.
    db_session    a fresh, empty test database for each test, so tests
                  never affect each other or the real database.
- `assert` checks that something is true. If it is not, the test fails.

Run them from the backend folder with:  python -m pytest tests/test_profile.py
"""

from sqlalchemy import select

from app.models import CompanyProfile, PastContract

PROFILE = {
    "business_type": "Construction",
    "trade_licence_no": "TL-1234",
    "tin": "123456789012",
    "vat_reg": "VAT-001",
    "annual_turnover": "30000000.00",
    "liquid_assets": "7500000.00",
    "years_of_experience": 8,
}
CONTRACT = {
    "title": "Bridge approach road",
    "client": "LGED",
    "value": "20000000.00",
    "type": "road construction",
    "year": 2024,
}


# --- 1. update profile --------------------------------------------------------


def test_update_profile(client, auth_headers):
    headers = auth_headers()  # a logged-in user

    # Send the new profile.
    response = client.put("/api/profile", headers=headers, json=PROFILE)
    assert response.status_code == 200

    # Read it back and check every field was saved.
    saved = client.get("/api/profile", headers=headers).json()
    for field, value in PROFILE.items():
        assert saved[field] == value
    assert saved["updated_at"]


# --- 2. reject a negative turnover --------------------------------------------


def test_negative_turnover_is_rejected(client, auth_headers):
    headers = auth_headers()
    client.put("/api/profile", headers=headers, json=PROFILE)

    response = client.put(
        "/api/profile", headers=headers, json={**PROFILE, "annual_turnover": "-5"}
    )

    # 422 means "the data you sent is not valid", with a message for the field.
    assert response.status_code == 422
    assert "annual_turnover" in response.json()["errors"]
    # The saved profile was not changed by the rejected request.
    assert client.get("/api/profile", headers=headers).json()["annual_turnover"] == "30000000.00"


# --- 3. add and delete a contract ---------------------------------------------


def test_add_and_delete_contract(client, auth_headers):
    headers = auth_headers()

    # Add: 201 means "created", and the response contains the new contract.
    added = client.post("/api/profile/contracts", headers=headers, json=CONTRACT)
    assert added.status_code == 201
    assert added.json()["title"] == "Bridge approach road"
    contract_id = added.json()["id"]

    # It now appears in the list.
    listed = client.get("/api/profile/contracts", headers=headers).json()
    assert [c["id"] for c in listed] == [contract_id]

    # Delete: 204 means "done, nothing to send back".
    deleted = client.delete(f"/api/profile/contracts/{contract_id}", headers=headers)
    assert deleted.status_code == 204

    # The list is empty again.
    assert client.get("/api/profile/contracts", headers=headers).json() == []


# --- 4. one firm cannot read another firm's data ------------------------------


def test_one_firm_cannot_read_another_firms_data(client, auth_headers):
    # Two users in two different firms.
    acme = auth_headers("a@acme.com", "Acme")
    other = auth_headers("b@other.com", "Other")

    # Acme saves a profile and a contract.
    client.put("/api/profile", headers=acme, json=PROFILE)
    client.post("/api/profile/contracts", headers=acme, json=CONTRACT)

    # The other firm sees its own empty profile and no contracts.
    other_profile = client.get("/api/profile", headers=other).json()
    assert other_profile["tin"] is None
    assert other_profile["firm_id"] != client.get("/api/profile", headers=acme).json()["firm_id"]
    assert client.get("/api/profile/contracts", headers=other).json() == []


# --- more checks on the same routes -------------------------------------------


def test_get_profile_creates_an_empty_one_the_first_time(client, auth_headers, db_session):
    headers = auth_headers()

    first = client.get("/api/profile", headers=headers)
    second = client.get("/api/profile", headers=headers)

    assert first.status_code == 200
    assert first.json()["business_type"] is None
    assert second.json()["id"] == first.json()["id"]  # not created twice
    assert len(db_session.scalars(select(CompanyProfile)).all()) == 1


def test_put_replaces_the_whole_profile(client, auth_headers):
    headers = auth_headers()
    client.put("/api/profile", headers=headers, json=PROFILE)

    response = client.put("/api/profile", headers=headers, json={"tin": "999"})

    assert response.json()["tin"] == "999"
    assert response.json()["business_type"] is None  # left out, so cleared


def test_contracts_are_listed_newest_first(client, auth_headers):
    headers = auth_headers()
    client.post("/api/profile/contracts", headers=headers, json={**CONTRACT, "year": 2021})
    client.post("/api/profile/contracts", headers=headers, json=CONTRACT)

    listed = client.get("/api/profile/contracts", headers=headers).json()

    assert [c["year"] for c in listed] == [2024, 2021]


def test_invalid_contract_is_rejected_per_field(client, auth_headers):
    response = client.post(
        "/api/profile/contracts",
        headers=auth_headers(),
        json={"title": "  ", "value": "-1", "year": 1980},
    )

    assert response.status_code == 422
    assert set(response.json()["errors"]) == {"title", "value", "year"}


def test_delete_unknown_contract_returns_404(client, auth_headers):
    assert client.delete("/api/profile/contracts/999", headers=auth_headers()).status_code == 404


def test_cannot_delete_another_firms_contract(client, auth_headers, db_session):
    acme = auth_headers("a@acme.com", "Acme")
    other = auth_headers("b@other.com", "Other")
    contract_id = client.post("/api/profile/contracts", headers=acme, json=CONTRACT).json()["id"]

    response = client.delete(f"/api/profile/contracts/{contract_id}", headers=other)

    assert response.status_code == 404
    assert db_session.get(PastContract, contract_id) is not None  # still there


def test_firm_id_in_the_request_body_is_ignored(client, auth_headers):
    acme = auth_headers("a@acme.com", "Acme")
    other = auth_headers("b@other.com", "Other")
    other_firm_id = client.get("/api/profile", headers=other).json()["firm_id"]

    created = client.post(
        "/api/profile/contracts", headers=acme, json={**CONTRACT, "firm_id": other_firm_id}
    )

    assert created.json()["firm_id"] != other_firm_id
    assert client.get("/api/profile/contracts", headers=other).json() == []


def test_every_route_requires_login(client):
    assert client.get("/api/profile").status_code == 401
    assert client.put("/api/profile", json=PROFILE).status_code == 401
    assert client.get("/api/profile/contracts").status_code == 401
    assert client.post("/api/profile/contracts", json=CONTRACT).status_code == 401
    assert client.delete("/api/profile/contracts/1").status_code == 401
