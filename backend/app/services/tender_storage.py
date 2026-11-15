"""Stores uploaded tender PDFs on disk under the upload root.

Paths returned (and stored in Tender.file_path) are relative to the upload
root, so the root can move without touching the database.
"""

from pathlib import Path, PurePosixPath
from typing import BinaryIO
from uuid import uuid4

from app.core.config import settings

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_CHUNK_SIZE = 1024 * 1024
_PDF_MAGIC = b"%PDF-"
# The PDF spec allows the header anywhere in the first 1024 bytes.
_HEADER_WINDOW = 1024


class NotAPdfError(Exception):
    pass


class FileTooLargeError(Exception):
    pass


def upload_root() -> Path:
    root = Path(settings.upload_dir)
    return root if root.is_absolute() else _BACKEND_DIR / root


def resolve(relative_path: str) -> Path:
    """Absolute path of a stored file, e.g. resolve(tender.file_path)."""
    return upload_root() / relative_path


def delete(relative_path: str) -> None:
    resolve(relative_path).unlink(missing_ok=True)


def save_tender_pdf(stream: BinaryIO, firm_id: int) -> str:
    """Write the upload to disk and return its path relative to the upload root.

    The content must be a PDF (checked by its header, not the client-supplied
    filename or content type) and no larger than the configured limit. The
    stored name is generated, never taken from the client.
    """
    head = stream.read(_HEADER_WINDOW)
    if _PDF_MAGIC not in head:
        raise NotAPdfError

    relative = PurePosixPath("tenders", str(firm_id), f"{uuid4().hex}.pdf")
    destination = upload_root() / relative
    destination.parent.mkdir(parents=True, exist_ok=True)

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    size = 0
    try:
        with destination.open("wb") as out:
            chunk = head
            while chunk:
                size += len(chunk)
                if size > max_bytes:
                    raise FileTooLargeError
                out.write(chunk)
                chunk = stream.read(_CHUNK_SIZE)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return relative.as_posix()
