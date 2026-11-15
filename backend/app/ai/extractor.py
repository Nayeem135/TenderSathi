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
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ValidationError, field_validator
from sqlalchemy.orm import Session

from app.ai.pdf_reader import PageText, read_pdf
from app.core.config import settings
from app.models import Condition, Tender
from app.services import tender_storage

SAMPLE_CONDITIONS_PATH = Path(__file__).with_name("sample_conditions.json")

# Roughly 3k tokens of tender text per request.
MAX_SECTION_CHARS = 12_000

Category = Literal["financial", "experience", "technical", "legal", "document", "other"]
_CATEGORIES = list(Category.__args__)

_SYSTEM_INSTRUCTION = """\
You extract bidder conditions from tender documents.

The user message is a section of a tender. Each page starts with a marker
line like [Page 12]. Return every condition a bidder must satisfy or every
document a bidder must submit. For each condition give:
- category: financial (turnover, liquid assets, securities, fees),
  experience (past works, years in business), technical (equipment, staff,
  capacity), legal (licences, registration, tax, declarations),
  document (papers to submit), or other.
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
                    "category": {"type": "string", "enum": _CATEGORIES},
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


@lru_cache
def _client():
    from google import genai

    return genai.Client(api_key=settings.gemini_api_key)


def _generate_json(section_text: str) -> str:
    """One Gemini call for one section; returns the raw JSON reply."""
    try:
        interaction = _client().interactions.create(
            model=settings.gemini_model,
            system_instruction=_SYSTEM_INSTRUCTION,
            input=section_text,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": _RESPONSE_SCHEMA,
            },
        )
    except Exception as exc:
        raise ExtractionError(f"Gemini request failed: {exc}") from exc
    if interaction.status != "completed" or not interaction.output_text:
        raise ExtractionError(f"Gemini returned no result (status: {interaction.status})")
    return interaction.output_text


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
        raise ExtractionError("The PDF has no extractable text (it may be scanned)")
    return [c for section in sections for c in _extract_section(section)]


def extract_conditions(db: Session, tender: Tender) -> list[Condition]:
    """Extract the tender's conditions and save them, replacing any earlier ones.

    Nothing is written unless the whole document extracts successfully.
    Raises ExtractionError, or PdfReadError if the file can't be read.
    """
    if settings.gemini_api_key:
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
