# How the tender analysis works

`POST /api/tenders/{id}/analyze` runs three steps:

1. **`pdf_reader.py`** reads the PDF with PyMuPDF, one page at a time, and keeps each
   page's number (starting at 1). Blank or scanned pages are kept as empty text, so
   page numbers never shift.
2. **`extractor.py`** sends the text to Gemini in sections of about 12,000 characters.
   Each page starts with a `[Page N]` marker, so the model can say which page a
   condition is on. The replies are checked and saved as `Condition` rows. Without
   `GEMINI_API_KEY`, the conditions come from `sample_conditions.json` instead
   (fallback mode).
3. **`matcher.py`** checks every condition against the firm's saved company profile
   and past contracts, saves one `EligibilityResult` (status and reason) per condition,
   and returns the counts ("9 of 11 conditions met").

`gemini.py` is the only file that calls the Gemini API.

The rest of this file explains three design decisions.

## 1. Why numeric conditions are checked with rules, not the LLM

Conditions with a number (turnover, liquid assets, years of experience, number and
value of similar contracts) are decided in plain Python in `matcher.py`. They are
never sent to the LLM. Only conditions that need reading and judgement, such as "must
hold a valid trade licence", go to Gemini.

The reasons:

- **The answer must be exact.** Eligibility is pass or fail on a threshold. A firm with
  299 lakh turnover against a 300 lakh requirement is not eligible. An LLM predicts
  likely text; it does not calculate. It can get comparisons, averages and unit
  conversions wrong (1 crore = 100 lakh = 10,000,000), and nothing tells you when it
  has. `annual_turnover >= required` is right every time.
- **The same input must give the same answer.** An LLM can answer differently each
  time it is asked. A firm that is "met" today and "not met" tomorrow, with nothing
  changed, could not trust the report. A rule always gives the same answer.
- **The reason must be checkable.** A rule's reason states the actual numbers: "Average
  annual turnover for 2023-2025 is 310 lakh, which meets the required 300 lakh." A user
  can verify that against their own records. An LLM's explanation may sound right
  without being how the answer was reached.
- **It can be tested.** `tests/test_matcher.py` checks the edge cases: exactly on the
  threshold, just below it, crore against lakh, contracts outside the "last 5 years"
  window, and missing data. A rule passes those tests on every run, which can't be
  promised for a model.
- **It is free, fast, and works offline.** No API call, no cost, no waiting. In fallback
  mode the numeric checks still work with no internet.

The LLM is still used where it is strong: reading the tender. During extraction it
finds each condition and pulls out its number and unit (`numeric_value: 300,
unit: "lakh"`). The rules then do the arithmetic. So the LLM reads and the code
calculates.

Missing data is never guessed. If the profile has no turnover figure, or a contract
has no date, the result is `needs_review` with a reason saying what is missing. The
same applies to everything the LLM is unsure about.

## 2. How the structured output schema works

The extractor needs a list of conditions that it can save straight into the
database, not free text. Two layers make sure that is what comes back.

**Layer 1: Gemini is constrained by a JSON schema.** `_RESPONSE_SCHEMA` in
`extractor.py` describes the only shape the reply may have:

```python
{
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
```

It is sent with the request (`response_format` in `gemini.py`). Gemini then uses
constrained decoding: while it writes the reply, it can only choose text that keeps
the reply valid against the schema. So the reply is always parseable JSON, every
required field is present, `page` is a whole number, and `category` can only be one of
the seven allowed values (`experience`, `turnover`, `liquid_assets`,
`similar_contracts`, `required_document`, `tender_security`, `other`). There is no
need to pick JSON out of a chatty answer.

**Layer 2: Pydantic checks it again.** The reply is parsed with
`ExtractionReply.model_validate_json(...)`, using the `ExtractedCondition` model. This
catches what a JSON schema cannot express, or what slips through anyway:

- `text` must not be blank after trimming;
- an empty `clause` or `unit` becomes `None`;
- `numeric_value` becomes a `Decimal`, so money is never a float;
- a reply that still does not fit raises `ValidationError`.

After validating, the extractor applies some rules of its own:

- **One retry.** An invalid reply is retried once before the analysis fails, so one bad
  reply does not fail the whole tender.
- **Page check.** If a condition gives a page that was not in the section the model was
  shown, the page is set to `None`, because a made-up page number must not be shown
  as a citation.
- **All or nothing.** Nothing is saved unless every section succeeds, so a tender
  never ends up with half its conditions.

The matcher uses the same pattern for text conditions. Its schema allows only
`met`, `not_met` or `uncertain` as the verdict, plus a `reason`. `uncertain` is saved
as `needs_review`. If the reply is invalid or leaves a condition out, that condition
becomes `needs_review` too.

The schema is written by hand rather than generated from the Pydantic model, because
Gemini needs every field listed as required and nullable fields written as
`["string", "null"]`.

## 3. How to measure extraction accuracy (precision, recall, F1)

The question is: of the conditions really in a tender, how many does the extractor
find, and how many of the ones it reports are real?

### Step 1: build a hand-labelled test set

Take 10 to 20 real tender documents of different kinds (works, goods, services;
short and long). For each one, a person writes down every bidder condition: its text,
category, page, clause, and number and unit if it has one. This is the **gold
standard**. Ideally two people label each document separately, then compare and
agree on the differences, which also shows how clear-cut the task is.

Keep these tenders apart. Do not use them while adjusting the prompt, or the score
will look better than the extractor really is on new tenders.

### Step 2: run the extractor and pair its output with the gold list

Run the extractor on each test tender. Then pair each extracted condition with at
most one gold condition. A pair counts as a match when the two are on the same page
(or a neighbouring one) and the texts say the same thing, for example a fuzzy text
similarity of at least 0.6. A person should check borderline pairs.

That gives three counts:

- **True positives (TP):** extracted conditions that match a gold condition.
- **False positives (FP):** extracted conditions with no gold match. These were
  invented, duplicated, or are not really conditions.
- **False negatives (FN):** gold conditions that nothing matched. These were missed.

### Step 3: calculate the scores

- **Precision = TP / (TP + FP).** Of what the extractor reported, how much was right?
- **Recall = TP / (TP + FN).** Of the real conditions, how many were found?
- **F1 = 2 × Precision × Recall / (Precision + Recall).** One number that is only high
  when both are high.

A worked example: a tender has 11 real conditions. The extractor returns 10, and 8 of
them match.

- TP = 8, FP = 10 − 8 = 2, FN = 11 − 8 = 3
- Precision = 8 / 10 = 0.80
- Recall = 8 / 11 = 0.73
- F1 = 2 × 0.80 × 0.73 / (0.80 + 0.73) = 0.76

Add up TP, FP and FN over all test tenders before dividing (micro-averaging). That way
a long tender counts for more than a two-condition one. Also work out the scores per
category, which shows weak spots such as "tender security is often missed".

### Step 4: check the fields of the matched pairs

A condition can be found but still have wrong details. For the matched pairs, count
how often each field is right:

- **category** accuracy;
- **page** accuracy;
- **numeric_value and unit** exactly right. This is the most important one, because
  the rules in `matcher.py` trust these numbers completely. A misread "300 lakh" as
  "30 lakh" gives a wrong verdict with a convincing reason.

### What to aim for

For this application **recall matters more than precision**. A missed condition is
dangerous: the report says the firm is eligible, they bid, and they are disqualified
for a requirement the report never showed. An extra or wrong condition is cheaper,
because the user sees it and can ignore it.

So when changing the prompt or the model, check that recall does not drop, even if
precision rises. Gemini's answers vary a little between runs, so run the evaluation
two or three times and report the average.
