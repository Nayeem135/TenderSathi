from pathlib import PurePath
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select

from app.ai.extractor import ExtractionError, NoTextError, extract_conditions
from app.ai.matcher import MatchSummary, match_tender
from app.ai.pdf_reader import PdfReadError
from app.api.deps import CurrentUser, DbSession
from app.api.errors import FieldErrors
from app.core.config import settings
from app.models import Condition, EligibilityResult, Tender, User
from app.schemas.tender import AnalysisOut, ConditionOut, ReportItemOut, ReportOut, TenderOut
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


# --- analysis (FR-10 to FR-14) ------------------------------------------------

ANALYZED = "analyzed"
FAILED = "failed"


def _own_tender(db: DbSession, user: User, tender_id: int) -> Tender:
    """The tender, if it belongs to the user's firm. Another firm's tender
    gets the same 404 as one that does not exist, so ids reveal nothing."""
    tender = db.get(Tender, tender_id)
    if tender is None or tender.firm_id != _firm_id(user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return tender


def _conditions_of(db: DbSession, tender: Tender) -> list[Condition]:
    return list(
        db.scalars(select(Condition).where(Condition.tender_id == tender.id).order_by(Condition.id))
    )


@router.post("/{tender_id}/analyze", response_model=AnalysisOut)
def analyze_tender(tender_id: int, current_user: CurrentUser, db: DbSession) -> AnalysisOut:
    """Extract the tender's conditions, then check each one against the
    firm's saved profile. Replaces any earlier analysis of this tender.

    With a Gemini key this can take a while for a long document. Without
    one, the sample conditions are used (fallback mode).
    """
    tender = _own_tender(db, current_user, tender_id)

    def fail(status_code: int, detail: str) -> HTTPException:
        # Earlier conditions and results are kept; only the status changes.
        db.rollback()
        tender.status = FAILED
        db.commit()
        return HTTPException(status_code=status_code, detail=detail)

    try:
        conditions = extract_conditions(db, tender)
    except (PdfReadError, NoTextError) as exc:
        raise fail(status.HTTP_422_UNPROCESSABLE_CONTENT, f"The PDF could not be analyzed: {exc}") from None
    except ExtractionError as exc:
        raise fail(status.HTTP_502_BAD_GATEWAY, f"Condition extraction failed: {exc}") from None

    summary = match_tender(db, tender)
    tender.status = ANALYZED
    db.commit()
    return AnalysisOut(
        tender=TenderOut.model_validate(tender), conditions=len(conditions), summary=summary
    )


@router.get("/{tender_id}/conditions", response_model=list[ConditionOut])
def list_conditions(tender_id: int, current_user: CurrentUser, db: DbSession) -> list[Condition]:
    """The conditions found by the last analysis, in document order."""
    tender = _own_tender(db, current_user, tender_id)
    return _conditions_of(db, tender)


@router.get("/{tender_id}/report", response_model=ReportOut)
def get_report(tender_id: int, current_user: CurrentUser, db: DbSession) -> ReportOut:
    """Every checked condition with its verdict and reason, and the counts.

    Before the tender is analyzed, results is empty and every count is 0.
    """
    tender = _own_tender(db, current_user, tender_id)
    results: list[ReportItemOut] = []
    for condition in _conditions_of(db, tender):
        if not condition.eligibility_results:
            continue
        latest = max(condition.eligibility_results, key=lambda result: result.id)
        results.append(
            ReportItemOut(
                **ConditionOut.model_validate(condition).model_dump(),
                status=latest.status,
                reason=latest.reason,
            )
        )
    return ReportOut(
        tender=TenderOut.model_validate(tender),
        summary=MatchSummary.count(item.status for item in results),
        results=results,
    )


@router.delete("/{tender_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tender(tender_id: int, current_user: CurrentUser, db: DbSession) -> None:
    """Delete the tender, its conditions and results, and the stored PDF."""
    tender = _own_tender(db, current_user, tender_id)
    file_path = tender.file_path

    # Deleted explicitly rather than left to ON DELETE CASCADE, so the same
    # thing happens on every database (SQLite only cascades when told to).
    condition_ids = select(Condition.id).where(Condition.tender_id == tender.id)
    db.execute(delete(EligibilityResult).where(EligibilityResult.condition_id.in_(condition_ids)))
    db.execute(delete(Condition).where(Condition.tender_id == tender.id))
    # Forget any conditions already loaded, so the ORM does not try to
    # delete the same rows a second time.
    db.expire(tender, ["conditions"])
    db.delete(tender)
    db.commit()

    # The file goes last: if the database step failed, the tender would
    # still exist and still need its file.
    tender_storage.delete(file_path)
