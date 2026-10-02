from __future__ import annotations

import heapq
from bisect import bisect_left
from dataclasses import dataclass
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status
from pydantic import BaseModel, ConfigDict, Field
from rapidfuzz import fuzz, utils

from . import cases as case_store
from ..models import CaseResponse, CaseStatus

router = APIRouter(prefix="/api/search", tags=["search"])

AgeBand = Literal["", "0-12", "13-17", "18-40", "41-60", "61-70", "71-80", "80+"]

AGE_BAND_LABELS = ("0-12", "13-17", "18-40", "41-60", "61-70", "71-80", "80+")
AGE_BAND_LIMITS = (12, 17, 40, 60, 70, 80)
AGE_BAND_INDEX = {label: index for index, label in enumerate(AGE_BAND_LABELS)}

WEIGHTS = {
    "name": 0.50,
    "phone": 0.25,
    "age": 0.10,
    "gender": 0.08,
    "description": 0.07,
}

NEUTRAL_SCORE = 0.5
ADJACENT_BAND_SCORE = 0.5
PARTIAL_PHONE_SCORE = 0.6
PARTIAL_PHONE_DIGITS = 6
LOCAL_PHONE_LENGTH = 10
COUNTRY_CODE = "91"
DEFAULT_MIN_SCORE = 0.40


class FuzzyQuery(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field("", max_length=120)
    phone: str = Field("", max_length=32)
    gender: str = Field("", max_length=16)
    age_band: AgeBand = ""
    description: str = Field("", max_length=300)


class FuzzyResult(BaseModel):
    case_id: str
    name: str
    gender: str
    age: int
    last_seen: str
    status: str
    score: float


@dataclass(frozen=True, slots=True)
class _Prepared:
    name: str
    phone: str
    gender: str
    age_band: str
    description: str
    weights: dict[str, float]


def _normalize_phone(phone: str | None) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if digits.startswith(COUNTRY_CODE) and len(digits) > LOCAL_PHONE_LENGTH:
        digits = digits[len(COUNTRY_CODE):]
    if digits.startswith("0") and len(digits) == LOCAL_PHONE_LENGTH + 1:
        digits = digits[1:]
    return digits


def _age_band(age: int) -> str:
    return AGE_BAND_LABELS[bisect_left(AGE_BAND_LIMITS, age)]


def _prepare(query: FuzzyQuery) -> _Prepared:
    name = utils.default_process(query.name)
    phone = _normalize_phone(query.phone)
    gender = query.gender.lower()
    description = utils.default_process(query.description)

    present = {
        "name": bool(name),
        "phone": bool(phone),
        "age": bool(query.age_band),
        "gender": bool(gender),
        "description": bool(description),
    }
    total = sum(WEIGHTS[key] for key, used in present.items() if used)
    weights = {key: WEIGHTS[key] / total for key, used in present.items() if used} if total else {}

    return _Prepared(
        name=name,
        phone=phone,
        gender=gender,
        age_band=query.age_band,
        description=description,
        weights=weights,
    )


def _name_score(query: str, candidate: str | None) -> float:
    candidate = utils.default_process(candidate or "")
    if not candidate:
        return NEUTRAL_SCORE
    set_score = fuzz.token_set_ratio(query, candidate)
    sort_score = fuzz.token_sort_ratio(query, candidate)
    return (set_score + sort_score) / 200


def _description_score(query: str, candidate: str | None) -> float:
    candidate = utils.default_process(candidate or "")
    if not candidate:
        return NEUTRAL_SCORE
    return fuzz.token_set_ratio(query, candidate) / 100


def _phone_score(query: str, candidate: str | None) -> float:
    candidate = _normalize_phone(candidate)
    if not candidate:
        return NEUTRAL_SCORE
    if query == candidate:
        return 1.0
    if (
        len(query) >= PARTIAL_PHONE_DIGITS
        and len(candidate) >= PARTIAL_PHONE_DIGITS
        and query[-PARTIAL_PHONE_DIGITS:] == candidate[-PARTIAL_PHONE_DIGITS:]
    ):
        return PARTIAL_PHONE_SCORE
    return 0.0


def _age_score(query_band: str, age: int) -> float:
    gap = abs(AGE_BAND_INDEX[query_band] - AGE_BAND_INDEX[_age_band(age)])
    if gap == 0:
        return 1.0
    if gap == 1:
        return ADJACENT_BAND_SCORE
    return 0.0


def _gender_score(query: str, candidate: str) -> float:
    return 1.0 if query == candidate.lower() else 0.0


def _score(prepared: _Prepared, case: CaseResponse) -> float:
    person = case.report.person
    contact = getattr(case.report, "contact", None)

    scorers = {
        "name": lambda: _name_score(prepared.name, person.name),
        "phone": lambda: _phone_score(prepared.phone, getattr(contact, "phone", None)),
        "age": lambda: _age_score(prepared.age_band, person.age),
        "gender": lambda: _gender_score(prepared.gender, person.gender.value),
        "description": lambda: _description_score(
            prepared.description, person.clothing_description
        ),
    }

    total = sum(weight * scorers[key]() for key, weight in prepared.weights.items())
    return round(total, 4)


def _to_result(case: CaseResponse, score: float) -> FuzzyResult:
    return FuzzyResult(
        case_id=case.case_id,
        name=case.report.person.name,
        gender=case.report.person.gender.value,
        age=case.report.person.age,
        last_seen=case.report.last_seen.landmark or "",
        status=case.status.value,
        score=score,
    )


@router.post("/fuzzy", response_model=list[FuzzyResult])
def fuzzy_search(
    query: FuzzyQuery,
    top_k: int = Query(5, ge=1, le=50),
    min_score: float = Query(DEFAULT_MIN_SCORE, ge=0.0, le=1.0),
    status: CaseStatus | None = Query(None),
) -> list[FuzzyResult]:
    prepared = _prepare(query)
    if not prepared.weights:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one search field.",
        )

    cases = case_store.list_all(status.value if status else None)

    matches: list[FuzzyResult] = []
    for case in cases:
        score = _score(prepared, case)
        if score >= min_score:
            matches.append(_to_result(case, score))

    return heapq.nlargest(top_k, matches, key=lambda result: result.score)