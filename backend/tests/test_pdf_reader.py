import pymupdf
import pytest

from app.ai.pdf_reader import PageText, PdfReadError, read_pdf


def make_pdf(path, page_texts, password=None):
    """Write a PDF with one page per entry; None makes a blank page."""
    document = pymupdf.open()
    for text in page_texts:
        page = document.new_page()
        if text is not None:
            page.insert_text((72, 72), text)
    if password:
        document.save(path, encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw=password)
    else:
        document.save(path)
    document.close()
    return path


def test_returns_text_per_page_with_page_numbers(tmp_path):
    path = make_pdf(tmp_path / "t.pdf", ["Eligibility criteria", "Turnover of 50 lakh"])

    assert read_pdf(path) == [
        PageText(page=1, text="Eligibility criteria"),
        PageText(page=2, text="Turnover of 50 lakh"),
    ]


def test_blank_page_is_kept_so_numbering_stays_correct(tmp_path):
    path = make_pdf(tmp_path / "t.pdf", ["first", None, "third"])

    pages = read_pdf(path)

    assert [p.page for p in pages] == [1, 2, 3]
    assert pages[1].text == ""
    assert pages[2].text == "third"


def test_multiline_text_is_preserved(tmp_path):
    path = make_pdf(tmp_path / "t.pdf", ["Clause 4.1\nBidder must be registered"])

    assert read_pdf(path)[0].text == "Clause 4.1\nBidder must be registered"


def test_accepts_str_path(tmp_path):
    path = make_pdf(tmp_path / "t.pdf", ["hello"])

    assert read_pdf(str(path))[0].text == "hello"


def test_not_a_pdf_raises(tmp_path):
    path = tmp_path / "fake.pdf"
    path.write_bytes(b"this is not a pdf")

    with pytest.raises(PdfReadError):
        read_pdf(path)


def test_missing_file_raises(tmp_path):
    with pytest.raises(PdfReadError):
        read_pdf(tmp_path / "nope.pdf")


def test_password_protected_raises(tmp_path):
    path = make_pdf(tmp_path / "locked.pdf", ["secret"], password="pw")

    with pytest.raises(PdfReadError, match="password"):
        read_pdf(path)
