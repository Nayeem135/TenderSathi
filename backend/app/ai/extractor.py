"""Extracts tender conditions from a PDF and saves them as Condition rows.

    from app.ai.extractor import extract_conditions

    conditions = extract_conditions(db, tender)

With GEMINI_API_KEY set, the PDF text is sent to Gemini section by section
and each reply is validated before anything is saved. Without a key, the
conditions come from sample_conditions.json, so the demo runs offline.
"""

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ValidationError, field_validator
from sqlalchemy.orm import Session

from app.ai import gemini
from app.ai.pdf_reader import PageText, read_pdf
from app.models import Condition, Tender
from app.services import tender_storage

SAMPLE_CONDITIONS_PATH = Path(__file__).with_name("sample_conditions.json")

# Roughly 3k tokens of tender text per request.
MAX_SECTION_CHARS = 12_000

# The matcher decides turnover, liquid_assets, similar_contracts and
# experience (in years) with arithmetic, so those four must be kept apart
# from everything else.
Category = Literal[
    "experience",
    "turnover",
    "liquid_assets",
    "similar_contracts",
    "required_document",
    "tender_security",
    "other",
]
CATEGORIES: list[str] = list(Category.__args__)

_SYSTEM_INSTRUCTION = """\
You extract bidder conditions from tender documents.

The user message is a section of a tender. Each page starts with a marker
line like [Page 12]. Return every condition a bidder must satisfy or every
document a bidder must submit. For each condition give:
- category, exactly one of:
  experience: how many years the firm itself has worked in the field.
    Experience required of staff (an engineer, a project manager) is other.
  turnover: annual or average annual turnover.
  liquid_assets: liquid assets, available credit facilities, working capital.
  similar_contracts: number or value of similar works the firm has completed.
  required_document: a licence, registration, certificate, statement or
    declaration the bidder must hold or submit (trade licence, TIN, VAT,
    audited accounts).
  tender_security: the bid or tender security, earnest money, or bank
    guarantee submitted with the bid.
  other: anything else, such as equipment, key personnel or work methods.
- text: the condition, quoted or closely paraphrased from the tender.
- page: the number from the [Page N] marker the condition appears under.
- clause: the clause or section number if one is shown (e.g. "4.1(b)"), else null.
- numeric_value and unit: the threshold when the condition has one
  (e.g. 50 and "lakh", 5 and "years"), else null for both.

Only use what is written in the section. Do not invent conditions. If the
section has none, return an empty list.
"""

# Hand-written rather than generated from the Pydantic models: Gemini wants
# every property required and nullable fields as a type array.
_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "conditions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": CATEGORIES},
                    "text": {"type": "string"},
                    "page": {"type": "integer"},
                    "clause": {"type": ["string", "null"]},
                    "numeric_value": {"type": ["number", "null"]},
                    "unit": {"type": ["string", "null"]},
                },
                "required": ["category", "text", "page", "clause", "numeric_value", "unit"],
            },
        }
    },
    "required": ["conditions"],
}


class ExtractionError(Exception):
    """Gemini could not be reached or its reply was not usable."""


class NoTextError(ExtractionError):
    """The PDF has no text to extract from, usually because it is scanned."""


class ExtractedCondition(BaseModel):
    category: Category
    text: str
    page: int | None = None
    clause: str | None = None
    numeric_value: Decimal | None = None
    unit: str | None = None

    @field_validator("text")
    @classmethod
    def _text_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("text is empty")
        return value

    @field_validator("clause", "unit")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class ExtractionReply(BaseModel):
    conditions: list[ExtractedCondition]


@dataclass(frozen=True)
class Section:
    pages: tuple[PageText, ...]

    @property
    def page_numbers(self) -> set[int]:
        return {p.page for p in self.pages}

    @property
    def text(self) -> str:
        return "\n\n".join(f"[Page {p.page}]\n{p.text}" for p in self.pages)


def split_into_sections(
    pages: list[PageText], max_chars: int | None = None
) -> list[Section]:
    """Group consecutive pages into sections of at most max_chars of text
    (default MAX_SECTION_CHARS).

    Pages are never split, so a single page longer than max_chars becomes its
    own section. Pages without text are skipped.
    """
    max_chars = max_chars or MAX_SECTION_CHARS
    sections: list[Section] = []
    current: list[PageText] = []
    size = 0
    for page in pages:
        if not page.text:
            continue
        if current and size + len(page.text) > max_chars:
            sections.append(Section(tuple(current)))
            current, size = [], 0
        current.append(page)
        size += len(page.text)
    if current:
        sections.append(Section(tuple(current)))
    return sections


def load_sample_conditions() -> list[ExtractedCondition]:
    return ExtractionReply.model_validate_json(
        SAMPLE_CONDITIONS_PATH.read_text(encoding="utf-8")
    ).conditions


def _generate_json(section_text: str) -> str:
    """One Gemini call for one section; returns the raw JSON reply."""
    try:
        return gemini.generate_json(_SYSTEM_INSTRUCTION, section_text, _RESPONSE_SCHEMA)
    except gemini.GeminiError as exc:
        raise ExtractionError(str(exc)) from exc


def _extract_section(section: Section) -> list[ExtractedCondition]:
    # One retry: an occasional malformed reply shouldn't fail the whole tender.
    last_error: Exception | None = None
    for _ in range(2):
        try:
            reply = ExtractionReply.model_validate_json(_generate_json(section.text))
        except ValidationError as exc:
            last_error = exc
            continue
        for condition in reply.conditions:
            # A page the model wasn't shown can't be trusted as a citation.
            if condition.page not in section.page_numbers:
                condition.page = None
        return reply.conditions
    pages = sorted(section.page_numbers)
    raise ExtractionError(
        f"Gemini reply for pages {pages[0]}-{pages[-1]} failed validation: {last_error}"
    )


def extract_from_pages(pages: list[PageText]) -> list[ExtractedCondition]:
    sections = split_into_sections(pages)
    if not sections:
        raise NoTextError("The PDF has no extractable text (it may be scanned)")
    return [c for section in sections for c in _extract_section(section)]


def extract_conditions(db: Session, tender: Tender) -> list[Condition]:
    """Extract the tender's conditions and save them, replacing any earlier ones.

    Nothing is written unless the whole document extracts successfully.
    Raises ExtractionError, or PdfReadError if the file can't be read.
    """
    if gemini.is_configured():
        pages = read_pdf(tender_storage.resolve(tender.file_path))
        extracted = extract_from_pages(pages)
    else:
        extracted = load_sample_conditions()

    tender.conditions = [
        Condition(
            category=c.category,
            text=c.text,
            page=c.page,
            clause=c.clause[:64] if c.clause else None,
            numeric_value=c.numeric_value,
            unit=c.unit[:32] if c.unit else None,
        )
        for c in extracted
    ]
    db.commit()
    return tender.conditions
