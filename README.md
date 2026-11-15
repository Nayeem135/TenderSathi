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
│   ├── ai/             tender analysis pipeline (PDF reading, condition extraction, eligibility matching)
│   ├── api/            route modules
│   ├── core/config.py  settings loaded from .env
│   ├── db/             Base, engine, get_db session dependency
│   ├── models/         SQLAlchemy models
│   ├── schemas/        Pydantic request/response models
│   └── services/       business logic
└── tests/
```

## Auth

| Endpoint | Body | Success |
| --- | --- | --- |
| `POST /api/auth/register` | `{email, password, firm_name}` | `201` user (with `firm`) |
| `POST /api/auth/login` | `{email, password}` | `200` `{access_token, token_type}` |
| `GET /api/auth/me` | — | `200` current user |

Send the token as `Authorization: Bearer <access_token>`.

Errors with per-field messages (validation `422`, duplicate email `409`) look like:

```json
{"detail": "Validation failed", "errors": {"password": "Password must contain at least one digit"}}
```

To protect a route, depend on the current user (returns the `User` model, or a `401`):

```python
from app.api.deps import CurrentUser

@router.get("/things")
def list_things(current_user: CurrentUser):
    ...
```

`current_user: User = Depends(get_current_user)` from the same module is equivalent.

## Tenders

Both need the bearer token and are scoped to the caller's firm.

| Endpoint | Body | Success |
| --- | --- | --- |
| `POST /api/tenders` | multipart form: `file` (PDF), optional `title` | `201` tender |
| `GET /api/tenders` | — | `200` list, newest first |

A non-PDF returns `415` and a file over `MAX_UPLOAD_SIZE_MB` (default 20) returns `413`,
both with `errors.file`. If `title` is omitted, the file name is used. Files are stored
under `backend/uploads/` (gitignored).

## Company profile

All need the bearer token and only touch the caller's own firm.

| Endpoint | Body | Success |
| --- | --- | --- |
| `GET /api/profile` | — | `200` profile (an empty one is created on first use) |
| `PUT /api/profile` | profile fields | `200` updated profile |
| `GET /api/profile/contracts` | — | `200` list, newest first |
| `POST /api/profile/contracts` | `{title, client, value, type, year}` | `201` contract |
| `DELETE /api/profile/contracts/{id}` | — | `204` |

Money amounts are in plain currency units and are returned as strings (`"30000000.00"`).
`PUT` replaces the whole profile, so send every field.

## Common tasks

```
pytest                                         # run tests (from backend/)
alembic revision --autogenerate -m "message"   # new migration after changing models
alembic upgrade head                           # apply migrations
```

New models must be imported in `app/models/__init__.py` so Alembic can see them.
