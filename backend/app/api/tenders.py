from pathlib import PurePath
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.api.errors import FieldErrors
from app.core.config import settings
from app.models import Tender, User
from app.schemas.tender import TenderOut
from app.services import tender_storage

router = APIRouter(prefix="/api/tenders", tags=["tenders"])

_TITLE_MAX = 255


def _firm_id(user: User) -> int:
    if user.firm_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to a firm",
        )
    return user.firm_id


def _title_for(title: str | None, filename: str | None) -> str:
    title = (title or "").strip()
    if not title and filename:
        # Handles both / and \ separators in client-supplied names.
        title = PurePath(filename.replace("\\", "/")).stem.strip()
    return title[:_TITLE_MAX] or "Untitled tender"


@router.post("", response_model=TenderOut, status_code=status.HTTP_201_CREATED)
def upload_tender(
    file: UploadFile,
    current_user: CurrentUser,
    db: DbSession,
    title: Annotated[str | None, Form(max_length=_TITLE_MAX)] = None,
) -> Tender:
    firm_id = _firm_id(current_user)

    try:
        file_path = tender_storage.save_tender_pdf(file.file, firm_id)
    except tender_storage.NotAPdfError:
        raise FieldErrors(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type",
            errors={"file": "Only PDF files are accepted"},
        ) from None
    except tender_storage.FileTooLargeError:
        raise FieldErrors(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="File too large",
            errors={"file": f"File must be at most {settings.max_upload_size_mb} MB"},
        ) from None

    tender = Tender(
        firm_id=firm_id,
        title=_title_for(title, file.filename),
        file_path=file_path,
    )
    db.add(tender)
    try:
        db.commit()
    except Exception:
        db.rollback()
        tender_storage.delete(file_path)
        raise
    return tender


@router.get("", response_model=list[TenderOut])
def list_tenders(current_user: CurrentUser, db: DbSession) -> list[Tender]:
    firm_id = _firm_id(current_user)
    return list(
        db.scalars(
            select(Tender)
            .where(Tender.firm_id == firm_id)
            .order_by(Tender.uploaded_at.desc(), Tender.id.desc())
        )
    )
