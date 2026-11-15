import os

# Must be set before the app (and its settings) are imported.
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-0000")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app


@pytest.fixture
def db_session():
    """A fresh in-memory SQLite database per test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db_session):
    fastapi_app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(fastapi_app)
    finally:
        fastapi_app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Factory: register a user in a new firm, log in, return auth headers."""

    def _make(email="owner@example.com", firm_name="Acme LLP"):
        credentials = {"email": email, "password": "passw0rd123"}
        response = client.post(
            "/api/auth/register", json={**credentials, "firm_name": firm_name}
        )
        assert response.status_code == 201, response.text
        token = client.post("/api/auth/login", json=credentials).json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _make
