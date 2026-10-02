from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status

from .. import db as case_store
from ..ai_summary import generate_ai_summary
from ..models import (
    CaseResponse,
    CaseStatus,
    CaseStatusUpdate,
    MissingPersonReport,
    SearchRecommendation,
)
from ..qr_generator import generate_case_id, generate_qr_code
from ..recommendation import RecommendationEngine

# Re-export database helper functions for backwards compatibility
count_by_status = case_store.count_by_status
count_by_zone = case_store.count_by_zone
average_minutes_since = case_store.average_minutes_since

router = APIRouter(prefix="/api/cases", tags=["cases"])
engine = RecommendationEngine()


def _not_found(case_id: str) -> HTTPException:
    return HTTPException(
        status_code=http_status.HTTP_404_NOT_FOUND,
        detail=f"Case '{case_id}' not found.",
    )


def _zone_name(zone: dict[str, Any] | None) -> str | None:
    if not zone:
        return None
    return zone.get("name") or zone.get("Name")


def _build_recommendation(report: MissingPersonReport) -> SearchRecommendation:
    person = report.person
    last_seen = report.last_seen

    try:
        data = engine.get_recommendation(
            lat=last_seen.latitude,
            lon=last_seen.longitude,
            age=person.age,
            gender=person.gender.value,
            minutes_since=last_seen.minutes_since,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    summary = generate_ai_summary(
        person_name=person.name,
        age=person.age,
        gender=person.gender.value,
        clothing=person.clothing_description,
        zone_name=_zone_name(data["current_zone"]),
        nearest_police=data["nearest_police"].name,
        police_distance_m=data["nearest_police"].distance_m,
        nearby_cctv_count=len(data["nearby_cctv"]),
        nearby_chokepoint_count=len(data["nearby_chokepoints"]),
        priority_zones=[
            {"zone_name": z.zone_name, "score": z.score, "reason": z.reason}
            for z in data["priority_zones"]
        ],
        search_radius_m=data["search_radius_m"],
        confidence=data["confidence"],
        minutes_since=last_seen.minutes_since,
    )

    return SearchRecommendation(**data, ai_summary=summary)


@router.post("/", response_model=CaseResponse, status_code=http_status.HTTP_201_CREATED)
def create_case(report: MissingPersonReport) -> CaseResponse:
    case_id = generate_case_id(exists=case_store.exists)
    recommendation = _build_recommendation(report)

    case = CaseResponse(
        case_id=case_id,
        created_at=datetime.now(timezone.utc),
        report=report,
        recommendation=recommendation,
        qr_code_base64=generate_qr_code(case_id),
        status=CaseStatus.active,
    )
    case_store.save(case)
    return case


@router.get("/", response_model=list[CaseResponse])
def list_cases(status: CaseStatus | None = None) -> list[CaseResponse]:
    return case_store.list_all(status.value if status else None)


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(case_id: str) -> CaseResponse:
    case = case_store.get(case_id)
    if case is None:
        raise _not_found(case_id)
    return case


@router.patch("/{case_id}/status", response_model=CaseResponse)
def update_case_status(case_id: str, update: CaseStatusUpdate) -> CaseResponse:
    case = case_store.get(case_id)
    if case is None:
        raise _not_found(case_id)

    if case.status == update.status:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Case is already '{case.status.value}'.",
        )
    if case.status == CaseStatus.closed:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Cannot reopen a closed case.",
        )

    updated = case_store.update_status(case_id, update.status.value)
    if updated is None:
        raise _not_found(case_id)
    return updated