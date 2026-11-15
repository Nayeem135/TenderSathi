"""Checks a tender's conditions against a firm's profile and saves one
EligibilityResult per condition.

    from app.ai.matcher import match_tender

    summary = match_tender(db, tender, profile)   # profile: ProfileData
    summary.met, summary.not_met, summary.needs_review, summary.total

Numeric conditions (turnover, liquid assets, years of experience, number and
value of past contracts) are decided with plain arithmetic and never sent to
the LLM. Everything else goes to Gemini together with the profile; anything
it is unsure about, or cannot be asked about, is marked needs_review.

The matcher works on ProfileData, a plain snapshot of the firm. load_profile()
is the one place that reads the CompanyProfile and PastContract tables.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.ai import gemini
from app.models import Condition, EligibilityResult, Tender

MET = "met"
NOT_MET = "not_met"
NEEDS_REVIEW = "needs_review"

# Text conditions sent to the LLM per request.
LLM_BATCH_SIZE = 20


# --- firm data ----------------------------------------------------------------


@dataclass(frozen=True)
class ContractData:
    title: str
    value: Decimal  # in base currency units, e.g. 15000000 (not "150 lakh")
    completed_on: date | None = None
    description: str = ""


@dataclass(frozen=True)
class ProfileData:
    """What the matcher knows about a firm. Money is in base currency units."""

    annual_turnovers: dict[int, Decimal] = field(default_factory=dict)  # year -> turnover
    liquid_assets: Decimal | None = None
    years_of_experience: int | None = None
    contracts: tuple[ContractData, ...] = ()
    # Free-text facts for the LLM, e.g. {"trade_licence": "valid until 2027-06-30"}.
    details: dict[str, str] = field(default_factory=dict)


def load_profile(db: Session, firm_id: int) -> ProfileData:
    """Build ProfileData from the CompanyProfile and PastContract tables.

    Not connected yet: those models are not in the codebase. Once they are,
    query them here and map their columns onto ProfileData.
    """
    raise NotImplementedError(
        "load_profile() is not connected to the CompanyProfile and PastContract "
        "tables yet; pass a ProfileData to match_tender() instead"
    )


# --- results ------------------------------------------------------------------


@dataclass(frozen=True)
class Outcome:
    status: str
    reason: str


class MatchSummary(BaseModel):
    met: int = 0
    not_met: int = 0
    needs_review: int = 0

    @property
    def total(self) -> int:
        return self.met + self.not_met + self.needs_review


# --- numeric checks (plain Python, no LLM) ------------------------------------

_MULTIPLIERS = {
    "crore": Decimal(10_000_000),
    "lakh": Decimal(100_000),
    "lac": Decimal(100_000),
    "billion": Decimal(1_000_000_000),
    "million": Decimal(1_000_000),
    "thousand": Decimal(1_000),
}
_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}  # fmt: skip
_NUMBER = r"(\d+|" + "|".join(_NUMBER_WORDS) + ")"
_CONTRACT_NOUN = r"(?:works?|contracts?|projects?)"
_CONTRACT_COUNT = re.compile(_NUMBER + r"\s+(?:\w+\s+){0,3}?" + _CONTRACT_NOUN + r"\b")
_LAST_N_YEARS = re.compile(r"(?:last|past|previous|preceding)\s+" + _NUMBER + r"\s+(?:\w+\s+)?years?")


def _to_int(token: str) -> int:
    return int(token) if token.isdigit() else _NUMBER_WORDS[token]


def _multiplier(unit: str | None) -> Decimal:
    unit = (unit or "").lower()
    for word, multiplier in _MULTIPLIERS.items():
        if word in unit:
            return multiplier
    return Decimal(1)


def _is_years(unit: str | None) -> bool:
    return (unit or "").lower().startswith(("year", "yr"))


def _fmt(amount: Decimal, unit: str | None) -> str:
    """An amount in base units, shown in the condition's own unit."""
    number = f"{amount / _multiplier(unit):,.2f}".rstrip("0").rstrip(".")
    return f"{number} {unit}".strip()


def _years_before(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:  # 29 February
        return day.replace(year=day.year - years, day=28)


def _check_turnover(condition: Condition, profile: ProfileData, today: date) -> Outcome:
    required = condition.numeric_value * _multiplier(condition.unit)
    if not profile.annual_turnovers:
        return Outcome(NEEDS_REVIEW, "The profile has no annual turnover figures.")

    window = _LAST_N_YEARS.search(condition.text.lower())
    years_wanted = _to_int(window.group(1)) if window else len(profile.annual_turnovers)
    latest_years = sorted(profile.annual_turnovers, reverse=True)[:years_wanted]
    if len(latest_years) < years_wanted:
        return Outcome(
            NEEDS_REVIEW,
            f"The condition covers {years_wanted} years but the profile has turnover "
            f"for only {len(latest_years)}.",
        )

    average = sum(profile.annual_turnovers[y] for y in latest_years) / len(latest_years)
    span = f"{min(latest_years)}-{max(latest_years)}" if len(latest_years) > 1 else str(latest_years[0])
    met = average >= required
    return Outcome(
        MET if met else NOT_MET,
        f"Average annual turnover for {span} is {_fmt(average, condition.unit)}, "
        f"{'which meets' if met else 'below'} the required {_fmt(required, condition.unit)}.",
    )


def _check_liquid_assets(condition: Condition, profile: ProfileData, today: date) -> Outcome:
    required = condition.numeric_value * _multiplier(condition.unit)
    if profile.liquid_assets is None:
        return Outcome(NEEDS_REVIEW, "The profile has no liquid assets figure.")
    met = profile.liquid_assets >= required
    return Outcome(
        MET if met else NOT_MET,
        f"Liquid assets are {_fmt(profile.liquid_assets, condition.unit)}, "
        f"{'which meets' if met else 'below'} the required {_fmt(required, condition.unit)}.",
    )


def _check_years_of_experience(condition: Condition, profile: ProfileData, today: date) -> Outcome:
    required = condition.numeric_value
    if profile.years_of_experience is None:
        return Outcome(NEEDS_REVIEW, "The profile does not state the years of experience.")
    met = profile.years_of_experience >= required
    return Outcome(
        MET if met else NOT_MET,
        f"The firm has {profile.years_of_experience} years of experience; "
        f"{required.normalize():f} are required.",
    )


def _check_contracts(condition: Condition, profile: ProfileData, today: date) -> Outcome:
    """Count past contracts that are large enough and recent enough.

    Whether a contract is of a "similar nature" is not judged here; every
    past contract in the profile is treated as a candidate.
    """
    text = condition.text.lower()
    count_match = _CONTRACT_COUNT.search(text)
    if _is_money_threshold(condition):
        min_value = condition.numeric_value * _multiplier(condition.unit)
        required_count = _to_int(count_match.group(1)) if count_match else 1
    else:  # the number itself is the count, e.g. 3 "contracts"
        min_value = None
        required_count = int(condition.numeric_value)

    window = _LAST_N_YEARS.search(text)
    cutoff = _years_before(today, _to_int(window.group(1))) if window else None

    big_enough = [c for c in profile.contracts if min_value is None or c.value >= min_value]
    if cutoff is None:
        qualifying, undated = big_enough, []
    else:
        qualifying = [c for c in big_enough if c.completed_on and c.completed_on >= cutoff]
        undated = [c for c in big_enough if c.completed_on is None]

    requirement = f"{required_count} contract{'s' if required_count != 1 else ''}"
    if min_value is not None:
        requirement += f" of at least {_fmt(min_value, condition.unit)} each"
    if cutoff is not None:
        requirement += f" completed since {cutoff.isoformat()}"
    found = f"{len(qualifying)} past contract{'s' if len(qualifying) != 1 else ''} qualify"
    if qualifying:
        found += " (" + ", ".join(c.title for c in qualifying[:5]) + ")"

    if len(qualifying) >= required_count:
        return Outcome(MET, f"Required: {requirement}. {found}.")
    if len(qualifying) + len(undated) >= required_count:
        return Outcome(
            NEEDS_REVIEW,
            f"Required: {requirement}. {found}, and {len(undated)} more are large "
            f"enough but have no completion date.",
        )
    return Outcome(NOT_MET, f"Required: {requirement}. Only {found}.")


def _is_money_threshold(condition: Condition) -> bool:
    unit = (condition.unit or "").lower()
    return not _is_years(unit) and not re.search(_CONTRACT_NOUN, unit)


def _numeric_check(condition: Condition):
    """The arithmetic check for this condition, or None if it needs the LLM."""
    if condition.numeric_value is None:
        return None
    text = condition.text.lower()
    if "turnover" in text and not _is_years(condition.unit):
        return _check_turnover
    if re.search(r"liquid asset|credit facilit|line of credit|working capital", text):
        if not _is_years(condition.unit):
            return _check_liquid_assets
    if re.search(_CONTRACT_NOUN, text) and re.search(r"similar|completed|executed", text):
        if not _is_years(condition.unit):
            return _check_contracts
    if condition.category == "experience" and _is_years(condition.unit):
        return _check_years_of_experience
    return None


# --- text checks (LLM) --------------------------------------------------------

_SYSTEM_INSTRUCTION = """\
You check whether a company meets conditions from a tender, using only the
company profile given in the message.

For each numbered condition return its index, a verdict and a one-sentence
reason that cites the profile data you relied on.
- met: the profile clearly shows the condition is satisfied.
- not_met: the profile clearly shows it is not satisfied.
- uncertain: the profile does not contain enough information, or it is
  ambiguous. Prefer uncertain over guessing.
Never assume facts that are not in the profile.
"""

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["met", "not_met", "uncertain"]},
                    "reason": {"type": "string"},
                },
                "required": ["index", "verdict", "reason"],
            },
        }
    },
    "required": ["results"],
}

_VERDICT_STATUS = {"met": MET, "not_met": NOT_MET, "uncertain": NEEDS_REVIEW}


class _Verdict(BaseModel):
    index: int
    verdict: Literal["met", "not_met", "uncertain"]
    reason: str


class _VerdictReply(BaseModel):
    results: list[_Verdict]


def _profile_for_llm(profile: ProfileData) -> dict:
    return {
        "annual_turnovers": {str(y): str(v) for y, v in sorted(profile.annual_turnovers.items())},
        "liquid_assets": str(profile.liquid_assets) if profile.liquid_assets is not None else None,
        "years_of_experience": profile.years_of_experience,
        "past_contracts": [
            {
                "title": c.title,
                "value": str(c.value),
                "completed_on": c.completed_on.isoformat() if c.completed_on else None,
                "description": c.description,
            }
            for c in profile.contracts
        ],
        "details": profile.details,
    }


def _generate_json(prompt: str) -> str:
    return gemini.generate_json(_SYSTEM_INSTRUCTION, prompt, _RESPONSE_SCHEMA)


def _check_text_batch(conditions: list[Condition], profile: ProfileData) -> list[Outcome]:
    prompt = json.dumps(
        {
            "company_profile": _profile_for_llm(profile),
            "conditions": [
                {"index": i, "category": c.category, "text": c.text}
                for i, c in enumerate(conditions)
            ],
        },
        ensure_ascii=False,
        indent=1,
    )
    try:
        reply = _VerdictReply.model_validate_json(_generate_json(prompt))
    except (gemini.GeminiError, ValidationError):
        return [
            Outcome(NEEDS_REVIEW, "The automatic check failed for this condition; review it manually.")
        ] * len(conditions)

    by_index = {v.index: v for v in reply.results}
    outcomes = []
    for i in range(len(conditions)):
        verdict = by_index.get(i)
        if verdict is None:
            outcomes.append(Outcome(NEEDS_REVIEW, "The automatic check gave no answer for this condition."))
        else:
            reason = verdict.reason.strip() or "No reason given."
            outcomes.append(Outcome(_VERDICT_STATUS[verdict.verdict], reason))
    return outcomes


def _check_text(conditions: list[Condition], profile: ProfileData) -> list[Outcome]:
    if not gemini.is_configured():
        return [
            Outcome(NEEDS_REVIEW, "Not checked automatically (no Gemini API key is set); review it manually.")
        ] * len(conditions)
    outcomes: list[Outcome] = []
    for start in range(0, len(conditions), LLM_BATCH_SIZE):
        outcomes += _check_text_batch(conditions[start : start + LLM_BATCH_SIZE], profile)
    return outcomes


# --- entry point --------------------------------------------------------------


def evaluate(
    conditions: list[Condition], profile: ProfileData, today: date | None = None
) -> list[Outcome]:
    """One Outcome per condition, in the same order. Saves nothing."""
    today = today or date.today()
    outcomes: list[Outcome | None] = []
    text_conditions: list[Condition] = []
    for condition in conditions:
        check = _numeric_check(condition)
        if check is None:
            outcomes.append(None)
            text_conditions.append(condition)
        else:
            outcomes.append(check(condition, profile, today))

    text_outcomes = iter(_check_text(text_conditions, profile) if text_conditions else [])
    return [o if o is not None else next(text_outcomes) for o in outcomes]


def match_tender(
    db: Session,
    tender: Tender,
    profile: ProfileData | None = None,
    today: date | None = None,
) -> MatchSummary:
    """Evaluate every condition of the tender, save one EligibilityResult per
    condition (replacing earlier ones), and return the counts per status."""
    if profile is None:
        profile = load_profile(db, tender.firm_id)

    conditions = list(tender.conditions)
    summary = MatchSummary()
    for condition, outcome in zip(conditions, evaluate(conditions, profile, today)):
        condition.eligibility_results = [
            EligibilityResult(status=outcome.status, reason=outcome.reason)
        ]
        setattr(summary, outcome.status, getattr(summary, outcome.status) + 1)
    db.commit()
    return summary
