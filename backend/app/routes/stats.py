from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter

from . import cases as case_store
from ..models import CaseStatus, StatsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stats", tags=["stats"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

INFRASTRUCTURE_FILES = {
    "cctv": "cctv.geojson",
    "chokepoints": "chokepoints.geojson",
    "police": "police_stations.geojson",
}

UNKNOWN_ZONE = "Unknown"
RESOLVED_STATUSES = (CaseStatus.found.value, CaseStatus.closed.value)

_feature_counts: dict[str, tuple[tuple[int, int], int]] = {}


def _feature_count(filename: str) -> int:
    path = DATA_DIR / filename

    try:
        stat = path.stat()
    except OSError:
        logger.warning("GeoJSON file unavailable: %s", path)
        return 0

    signature = (stat.st_mtime_ns, stat.st_size)
    cached = _feature_counts.get(filename)
    if cached is not None and cached[0] == signature:
        return cached[1]

    try:
        with path.open("rb") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        logger.warning("Unable to read GeoJSON file: %s", path)
        return 0

    features = data.get("features") if isinstance(data, dict) else None
    count = len(features) if isinstance(features, list) else 0
    _feature_counts[filename] = (signature, count)
    return count


@router.get("/", response_model=StatsResponse)
def get_stats() -> StatsResponse:
    by_status = case_store.count_by_status()
    average = case_store.average_minutes_since(RESOLVED_STATUSES)

    return StatsResponse(
        total_cases=sum(by_status.values()),
        active_cases=by_status.get(CaseStatus.active.value, 0),
        found_cases=by_status.get(CaseStatus.found.value, 0),
        closed_cases=by_status.get(CaseStatus.closed.value, 0),
        cases_by_zone=case_store.count_by_zone(UNKNOWN_ZONE),
        avg_response_time_min=round(average, 1) if average is not None else 0.0,
        cctv_count=_feature_count(INFRASTRUCTURE_FILES["cctv"]),
        chokepoint_count=_feature_count(INFRASTRUCTURE_FILES["chokepoints"]),
        police_count=_feature_count(INFRASTRUCTURE_FILES["police"]),
    )