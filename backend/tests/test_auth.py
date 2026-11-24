from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models import CompanyProfile, Firm, User

VALID = {"email": "owner@example.com", "password": "passw0rd123", "firm_name": "Acme LLP"}


def register(client, **overrides):
    return client.post("/api/auth/register", json={**VALID, **overrides})


def login(client, email=VALID["email"], password=VALID["password"]):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# --- register ---------------------------------------------------------------


def test_register_creates_user_and_firm(client, db_session):
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "owner@example.com"
    assert body["firm"]["name"] == "Acme LLP"
    assert body["firm_id"] == body["firm"]["id"]
    assert "password" not in body and "hashed_password" not in body

    user = db_session.scalar(select(User))
    firm = db_session.scalar(select(Firm))
    assert user.firm_id == firm.id
    assert firm.name == "Acme LLP"


def test_register_creates_an_empty_profile_for_the_firm(client, db_session):
    firm_id = register(client).json()["firm_id"]

    profile = db_session.scalar(select(CompanyProfile))
    assert profile.firm_id == firm_id
    assert profile.annual_turnover is None and profile.trade_licence_no is None


def test_register_trims_and_lowercases_the_email(client):
    response = register(client, email="  Owner@Example.COM ")

    assert response.json()["email"] == "owner@example.com"
    assert login(client, email="owner@example.com").status_code == 200


@pytest.mark.parametrize("email", ["not-an-email", "owner@", "@example.com", "a b@example.com"])
def test_register_rejects_invalid_email_with_a_clear_message(client, email):
    response = register(client, email=email)

    assert response.status_code == 422
    assert response.json()["errors"]["email"].startswith("Enter a valid email address.")


def test_register_stores_bcrypt_hash_not_password(client, db_session):
    register(client)

    user = db_session.scalar(select(User))
    assert user.hashed_password != VALID["password"]
    assert user.hashed_password.startswith("$2")


def test_register_duplicate_email_returns_409(client, db_session):
    register(client)
    response = register(client, email="OWNER@Example.com", firm_name="Other")

    assert response.status_code == 409
    assert "email" in response.json()["errors"]
    # The failed attempt must not leave an orphan firm or profile behind.
    assert len(db_session.scalars(select(Firm)).all()) == 1
    assert len(db_session.scalars(select(CompanyProfile)).all()) == 1


@pytest.mark.parametrize(
    "password, expected",
    [
        ("sh0rt", "at least 8 characters"),
        ("12345678", "letter"),
        ("passwordonly", "digit"),
    ],
)
def test_register_rejects_weak_password(client, password, expected):
    response = register(client, password=password)

    assert response.status_code == 422
    assert expected in response.json()["errors"]["password"]


def test_register_returns_error_per_invalid_field(client):
    response = register(client, email="not-an-email", password="weak", firm_name="  ")

    assert response.status_code == 422
    assert set(response.json()["errors"]) == {"email", "password", "firm_name"}


def test_validation_error_does_not_echo_password(client):
    response = register(client, password="nodigitsecret")

    assert response.status_code == 422
    assert "nodigitsecret" not in response.text


# --- login ------------------------------------------------------------------


def test_login_returns_token_with_expiry(client):
    register(client)
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    claims = jwt.decode(
        body["access_token"], settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    assert claims["exp"] > datetime.now(timezone.utc).timestamp()


def test_login_same_error_for_wrong_email_and_wrong_password(client):
    register(client)
    wrong_password = login(client, password="wrongpass1")
    wrong_email = login(client, email="nobody@example.com")

    assert wrong_password.status_code == wrong_email.status_code == 401
    assert wrong_password.json() == wrong_email.json()


# --- get_current_user / me --------------------------------------------------


def test_me_returns_current_user(client):
    register(client)
    token = login(client).json()["access_token"]

    response = client.get("/api/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["email"] == "owner@example.com"
    assert response.json()["firm"]["name"] == "Acme LLP"


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_garbage_token(client):
    assert client.get("/api/auth/me", headers=auth_header("not.a.jwt")).status_code == 401


def test_me_rejects_expired_token(client):
    register(client)
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    assert client.get("/api/auth/me", headers=auth_header(expired)).status_code == 401


def test_me_rejects_token_signed_with_other_secret(client):
    register(client)
    forged = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "some-other-secret-some-other-secret-0000",
        algorithm="HS256",
    )
    assert client.get("/api/auth/me", headers=auth_header(forged)).status_code == 401
