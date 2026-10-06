from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status

from ..models import SearchRecommendation
from ..recommendation import RecommendationEngine
from ..ai_summary import generate_ai_summary

DEFAULT_SUBJECT_NAME = "Unknown Subject"
DEFAULT_CLOTHING = "not specified"

router = APIRouter(prefix="/api/recommend", tags=["recommend"])
engine = RecommendationEngine()


def _zone_name(zone: dict[str, Any] | None) -> str | None:
    if not zone:
        return None
    return zone.get("name") or zone.get("Name")


def build_recommendation(
    *,
    lat: float,
    lon: float,
    age: int,
    gender: str,
    minutes_since: int,
    person_name: str = DEFAULT_SUBJECT_NAME,
    clothing: str = DEFAULT_CLOTHING,
) -> SearchRecommendation:
    try:
        data = engine.get_recommendation(
            lat=lat,
            lon=lon,
            age=age,
            gender=gender,
            minutes_since=minutes_since,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    police = data["nearest_police"]
    summary = generate_ai_summary(
        person_name=person_name,
        age=age,
        gender=gender,
        clothing=clothing,
        zone_name=_zone_name(data["current_zone"]),
        nearest_police=police.name,
        police_distance_m=police.distance_m,
        nearby_cctv_count=len(data["nearby_cctv"]),
        nearby_chokepoint_count=len(data["nearby_chokepoints"]),
        priority_zones=[
            {"zone_name": z.zone_name, "score": z.score, "reason": z.reason}
            for z in data["priority_zones"]
        ],
        search_radius_m=data["search_radius_m"],
        confidence=data["confidence"],
        minutes_since=minutes_since,
    )

    return SearchRecommendation(**data, ai_summary=summary)