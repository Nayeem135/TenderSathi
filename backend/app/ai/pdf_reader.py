"""Extracts text from a PDF page by page, keeping page numbers.

    from app.ai.pdf_reader import read_pdf
    from app.services import tender_storage

    pages = read_pdf(tender_storage.resolve(tender.file_path))
    for page in pages:
        print(page.page, page.text)
"""

from dataclasses import dataclass
from pathlib import Path

import pymupdf


class PdfReadError(Exception):
    """The file is missing, not a readable PDF, or password-protected."""


@dataclass(frozen=True)
class PageText:
    page: int  # 1-based, as a reader would cite it
    text: str


def read_pdf(path: str | Path) -> list[PageText]:
    """Return one PageText per page, in order.

    Every page is included, even if it has no extractable text (blank or
    scanned pages come back with an empty string), so list position and
    page number always line up. No OCR is performed.
    """
    try:
        document = pymupdf.open(path, filetype="pdf")
    except Exception as exc:
        raise PdfReadError(f"Could not open PDF: {exc}") from exc

    with document:
        if document.needs_pass:
            raise PdfReadError("PDF is password-protected")
        try:
            return [
                PageText(page=number, text=page.get_text("text").strip())
                for number, page in enumerate(document, start=1)
            ]
        except Exception as exc:
            raise PdfReadError(f"Could not read PDF: {exc}") from exc
