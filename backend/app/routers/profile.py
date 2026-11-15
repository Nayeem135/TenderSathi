"""Company profile routes (FR-02).

A "route" is a function that FastAPI runs when a request arrives for a
given URL. Every route here needs a logged-in user, and only ever reads or
changes rows that belong to that user's own firm.

How the two `Depends(...)` parameters work: before running a route, FastAPI
calls the function named inside Depends() and passes its result in.
- Depends(get_current_user) reads the login token from the request and
  gives us the User. If the token is missing or invalid, the request is
  answered with 401 and our function never runs.
- Depends(get_db) gives us a database session for this one request.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CompanyProfile, PastContract, User
from app.schemas.company import (
    CompanyProfileIn,
    CompanyProfileOut,
    PastContractIn,
    PastContractOut,
)

# All routes in this file start with /api/profile. The tag only groups them
# together on the /docs page.
router = APIRouter(prefix="/api/profile", tags=["profile"])


def get_firm_id(user: User) -> int:
    """The id of the user's firm. Everything below is filtered by it."""
    if user.firm_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to a firm",
        )
    return user.firm_id


def get_or_create_profile(db: Session, firm_id: int) -> CompanyProfile:
    """Return the firm's profile, creating an empty one the first time."""
    profile = db.scalar(select(CompanyProfile).where(CompanyProfile.firm_id == firm_id))
    if profile is None:
        profile = CompanyProfile(firm_id=firm_id)
        db.add(profile)  # tell the session about the new row
        db.commit()  # write it to the database
        db.refresh(profile)  # read it back, to get the id and updated_at
    return profile


# --- the profile --------------------------------------------------------------


# response_model says which schema the returned object is converted to
# before it is sent as JSON. An empty path "" means the prefix itself:
# GET /api/profile.
@router.get("", response_model=CompanyProfileOut)
def read_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_or_create_profile(db, get_firm_id(current_user))


# `payload: CompanyProfileIn` tells FastAPI to read the request body as
# JSON and check it against the schema. Invalid data is rejected with 422
# before this function runs.
@router.put("", response_model=CompanyProfileOut)
def update_profile(
    payload: CompanyProfileIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, get_firm_id(current_user))

    # model_dump() turns the checked data into a dictionary such as
    # {"tin": "123", "annual_turnover": Decimal("5000")}. Copy every value
    # onto the database object. PUT replaces the whole profile, so a field
    # that was left out is saved as empty.
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)  # pick up the new updated_at
    return profile


# --- past contracts -----------------------------------------------------------


@router.get("/contracts", response_model=list[PastContractOut])
def list_contracts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    firm_id = get_firm_id(current_user)
    # Only this firm's contracts, newest first.
    query = (
        select(PastContract)
        .where(PastContract.firm_id == firm_id)
        .order_by(PastContract.year.desc(), PastContract.id.desc())
    )
    return db.scalars(query).all()


# 201 Created is the usual status code for "a new thing was made".
@router.post("/contracts", response_model=PastContractOut, status_code=status.HTTP_201_CREATED)
def add_contract(
    payload: PastContractIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # firm_id comes from the logged-in user, never from the request body,
    # so nobody can add a contract to another firm.
    contract = PastContract(firm_id=get_firm_id(current_user), **payload.model_dump())
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


# {contract_id} in the path is passed to the function as an argument.
# 204 No Content means "done, and there is nothing to send back".
@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    firm_id = get_firm_id(current_user)
    # Look for a contract with this id AND this firm. Another firm's
    # contract is simply "not found", so its existence is not revealed.
    contract = db.scalar(
        select(PastContract).where(
            PastContract.id == contract_id, PastContract.firm_id == firm_id
        )
    )
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    db.delete(contract)
    db.commit()
