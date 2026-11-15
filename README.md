# TenderSathi

Final year capstone project.

- `backend/` — FastAPI + SQLAlchemy + Alembic (PostgreSQL)
- `frontend/` — Vite app (dev server on http://localhost:5173)

## Run with Docker

```
cp .env.example .env
docker compose up --build
```

- API: http://localhost:8000 (`/health`, interactive docs at `/docs`)
- PostgreSQL: `localhost:5432`
- Migrations run automatically when the `api` container starts.

## Run the backend without Docker

Needs a PostgreSQL reachable at the `DATABASE_URL` in `.env`.

```
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## Backend layout

```
backend/
├── alembic/            migrations (versions/)
├── app/
│   ├── main.py         FastAPI app, CORS, router registration
│   ├── api/            route modules
│   ├── core/config.py  settings loaded from .env
│   ├── db/             Base, engine, get_db session dependency
│   ├── models/         SQLAlchemy models
│   ├── schemas/        Pydantic request/response models
│   └── services/       business logic
└── tests/
```

## Common tasks

```
pytest                                         # run tests (from backend/)
alembic revision --autogenerate -m "message"   # new migration after changing models
alembic upgrade head                           # apply migrations
```

New models must be imported in `app/models/__init__.py` so Alembic can see them.
