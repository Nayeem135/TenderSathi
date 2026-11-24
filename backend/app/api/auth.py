from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.api.errors import FieldErrors
from app.core.security import create_access_token, hash_password, verify_password
from app.models import CompanyProfile, Firm, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Verified against when the email is unknown, so a login attempt takes about
# the same time whether or not the account exists.
_DUMMY_HASH = hash_password("timing-equaliser")

_INVALID_CREDENTIALS = "Invalid email or password"


def _email_taken() -> FieldErrors:
    return FieldErrors(
        status_code=status.HTTP_409_CONFLICT,
        detail="Email already registered",
        errors={"email": "An account with this email already exists"},
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession) -> User:
    if db.scalar(select(User.id).where(User.email == payload.email)) is not None:
        raise _email_taken()

    firm = Firm(name=payload.firm_name)
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        firm=firm,
    )
    db.add(user)
    try:
        # flush() writes the firm so it has an id; the empty profile needs it.
        # Everything is committed together, so a failure leaves nothing behind.
        db.flush()
        db.add(CompanyProfile(firm_id=firm.id))
        db.commit()
    except IntegrityError:
        # Lost a race with another registration for the same email.
        db.rollback()
        raise _email_taken() from None
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    password_ok = verify_password(
        payload.password, user.hashed_password if user else _DUMMY_HASH
    )
    if user is None or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser) -> User:
    return current_user
