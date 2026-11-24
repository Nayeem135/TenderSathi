import json
from decimal import Decimal

import pymupdf
import pytest
from sqlalchemy import select

from app.ai import extractor
from app.ai.extractor import (
    ExtractionError,
    extract_conditions,
    load_sample_conditions,
    split_into_sections,
)
from app.ai.pdf_reader import PageText
from app.core.config import settings
from app.models import Condition, Firm, Tender


def reply(*conditions):
    return json.dumps({"conditions": list(conditions)})


def condition(**overrides):
    return {
        "category": "turnover",
        "text": "Turnover of at least 50 lakh",
        "page": 1,
        "clause": "4.1",
        "numeric_value": 50,
        "unit": "lakh",
        **overrides,
    }


@pytest.fixture
def tender(db_session, tmp_path, monkeypatch):
    """A tender whose stored PDF has two pages of text."""
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    document = pymupdf.open()
    for text in ("Page one conditions", "Page two conditions"):
        document.new_page().insert_text((72, 72), text)
    document.save(tmp_path / "t.pdf")
    document.close()

    firm = Firm(name="Acme")
    db_session.add(firm)
    db_session.flush()
    tender = Tender(firm_id=firm.id, title="T", file_path="t.pdf")
    db_session.add(tender)
    db_session.commit()
    return tender


@pytest.fixture
def gemini(monkeypatch):
    """Turn on Gemini mode with a fake model; returns the list of prompts sent."""
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    calls = []
    replies = []

    def fake_generate(section_text):
        calls.append(section_text)
        return replies.pop(0) if replies else reply()

    monkeypatch.setattr(extractor, "_generate_json", fake_generate)
    fake_generate.calls = calls
    fake_generate.replies = replies
    return fake_generate


# --- sectioning -------------------------------------------------------------


def test_sections_group_pages_up_to_limit_and_keep_page_markers():
    pages = [PageText(1, "a" * 60), PageText(2, "b" * 60), PageText(3, "c" * 60)]

    sections = split_into_sections(pages, max_chars=130)

    assert [sorted(s.page_numbers) for s in sections] == [[1, 2], [3]]
    assert sections[0].text.startswith("[Page 1]\n")
    assert "[Page 2]\n" in sections[0].text


def test_sections_skip_empty_pages_and_keep_oversized_page_whole():
    pages = [PageText(1, ""), PageText(2, "x" * 500), PageText(3, "y")]

    sections = split_into_sections(pages, max_chars=100)

    assert [sorted(s.page_numbers) for s in sections] == [[2], [3]]


# --- Gemini mode ------------------------------------------------------------


def test_saves_validated_conditions_with_page_and_clause(db_session, tender, gemini):
    gemini.replies.append(
        reply(
            condition(),
            condition(category="required_document", text="Valid trade licence", page=2,
                      clause=None, numeric_value=None, unit=None),
        )
    )

    result = extract_conditions(db_session, tender)

    assert len(result) == 2
    rows = db_session.scalars(select(Condition).order_by(Condition.id)).all()
    assert [(r.category, r.page, r.clause) for r in rows] == [
        ("turnover", 1, "4.1"),
        ("required_document", 2, None),
    ]
    assert rows[0].numeric_value == Decimal("50")
    assert rows[0].unit == "lakh"
    assert rows[0].tender_id == tender.id


def test_sends_page_marked_text_to_gemini(db_session, tender, gemini):
    extract_conditions(db_session, tender)

    (prompt,) = gemini.calls
    assert "[Page 1]\nPage one conditions" in prompt
    assert "[Page 2]\nPage two conditions" in prompt


def test_calls_gemini_once_per_section(db_session, tender, gemini, monkeypatch):
    monkeypatch.setattr(extractor, "MAX_SECTION_CHARS", 20)
    gemini.replies.extend([reply(condition(page=1)), reply(condition(page=2))])

    extract_conditions(db_session, tender)

    assert len(gemini.calls) == 2
    assert [c.page for c in db_session.scalars(select(Condition)).all()] == [1, 2]


def test_page_not_in_section_is_dropped(db_session, tender, gemini):
    gemini.replies.append(reply(condition(page=99)))

    (saved,) = extract_conditions(db_session, tender)

    assert saved.page is None


def test_invalid_reply_is_retried_once(db_session, tender, gemini):
    gemini.replies.extend(["not json", reply(condition())])

    assert len(extract_conditions(db_session, tender)) == 1
    assert len(gemini.calls) == 2


@pytest.mark.parametrize(
    "bad",
    ["not json", reply(condition(category="made-up")), reply(condition(text="  "))],
)
def test_reply_failing_validation_saves_nothing(db_session, tender, gemini, bad):
    gemini.replies.extend([bad, bad])

    with pytest.raises(ExtractionError):
        extract_conditions(db_session, tender)

    assert db_session.scalars(select(Condition)).all() == []


def test_rerun_replaces_previous_conditions(db_session, tender, gemini):
    gemini.replies.extend([reply(condition(), condition()), reply(condition(text="New"))])

    extract_conditions(db_session, tender)
    extract_conditions(db_session, tender)

    assert [c.text for c in db_session.scalars(select(Condition)).all()] == ["New"]


def test_pdf_without_text_raises(db_session, tender, gemini, tmp_path):
    blank = pymupdf.open()
    blank.new_page()
    blank.save(tmp_path / "blank.pdf")
    blank.close()
    tender.file_path = "blank.pdf"

    with pytest.raises(ExtractionError, match="no extractable text"):
        extract_conditions(db_session, tender)


# --- fallback mode ----------------------------------------------------------


def test_without_api_key_loads_sample_conditions(db_session, tender, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")

    def must_not_be_called(_):
        raise AssertionError("Gemini must not be called without a key")

    monkeypatch.setattr(extractor, "_generate_json", must_not_be_called)
    tender.file_path = "does-not-exist.pdf"  # the PDF isn't needed either

    result = extract_conditions(db_session, tender)

    sample = json.loads(extractor.SAMPLE_CONDITIONS_PATH.read_text(encoding="utf-8"))
    assert len(result) == len(sample["conditions"]) > 0
    rows = db_session.scalars(select(Condition).order_by(Condition.id)).all()
    assert [r.text for r in rows] == [c["text"] for c in sample["conditions"]]
    assert all(r.page is not None and r.clause for r in rows)


def test_categories_match_the_agreed_list():
    from app.ai.extractor import CATEGORIES, _RESPONSE_SCHEMA

    assert CATEGORIES == [
        "experience",
        "turnover",
        "liquid_assets",
        "similar_contracts",
        "required_document",
        "tender_security",
        "other",
    ]
    item = _RESPONSE_SCHEMA["properties"]["conditions"]["items"]
    assert item["properties"]["category"]["enum"] == CATEGORIES


def test_sample_conditions_use_every_numeric_category():
    categories = {c.category for c in load_sample_conditions()}

    assert {"experience", "turnover", "liquid_assets", "similar_contracts", "tender_security"} <= categories
