from __future__ import annotations

import heapq
import json
import math
from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

from .models import (
    NearbyFeature,
    PriorityLevel,
    SearchRecommendation,
    ZonePriority,
)

DATA_DIR = Path(__file__).parent.parent / "data"

EARTH_RADIUS_M = 6_371_000.0
METERS_PER_DEGREE = 111_320.0
GRID_CELL_DEG = 0.01

TIME_BREAKPOINTS = (15, 30, 60, 120)
RADIUS_BY_BAND = (500, 750, 1000, 1500, 2000)
CONFIDENCE_BY_BAND = (
    "High (87%)",
    "High (78%)",
    "Medium (64%)",
    "Medium (52%)",
    "Low (41%)",
)

CCTV_ZONE_RADIUS_M = 300.0
CHOKEPOINT_ZONE_RADIUS_M = 500.0
CCTV_WEIGHT = 20
CHOKEPOINT_WEIGHT = 15
VULNERABILITY_WEIGHT = 50
LATE_DECAY_AFTER_MIN = 60
LATE_DECAY_FACTOR = 0.8
OUT_OF_RANGE_FACTOR = 0.6
ZONE_FALLBACK_RADIUS_M = 1000.0
POLICE_SEARCH_RADIUS_M = 10_000.0
TOP_ZONES = 5
NEARBY_LIMIT = 10

_RESERVED_KEYS = frozenset({"id", "name", "Name"})


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(min(1.0, a)))


def _flatten_points(coords: Any) -> Iterator[tuple[float, float]]:
    if not coords:
        return
    if isinstance(coords[0], (int, float)):
        yield (float(coords[0]), float(coords[1]))
        return
    for part in coords:
        yield from _flatten_points(part)


def _outer_rings(geometry: dict) -> list[list]:
    kind = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords:
        return []
    if kind == "Polygon":
        return [coords[0]]
    if kind == "MultiPolygon":
        return [polygon[0] for polygon in coords if polygon]
    return []


def _centroid(geometry: dict) -> tuple[float, float] | None:
    coords = geometry.get("coordinates")
    if not coords:
        return None
    rings = _outer_rings(geometry)
    source = rings if rings else coords
    points = list(_flatten_points(source))
    if not points:
        return None
    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return (lat, lon)


def _ring_contains(ring: list, lat: float, lon: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            x_cross = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lon < x_cross:
                inside = not inside
        j = i
    return inside


def _polygon_contains(polygon: list, lat: float, lon: float) -> bool:
    if not polygon or not _ring_contains(polygon[0], lat, lon):
        return False
    return not any(_ring_contains(hole, lat, lon) for hole in polygon[1:])


def _geometry_contains(geometry: dict, lat: float, lon: float) -> bool:
    kind = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords:
        return False
    if kind == "Polygon":
        return _polygon_contains(coords, lat, lon)
    if kind == "MultiPolygon":
        return any(_polygon_contains(polygon, lat, lon) for polygon in coords)
    return False


@dataclass(frozen=True, slots=True)
class _Item:
    lat: float
    lon: float
    geometry: dict
    properties: dict


@dataclass(frozen=True, slots=True)
class _Hit:
    item: _Item
    distance_m: float


class GeoLayer:
    def __init__(self, geojson: dict) -> None:
        self.items: list[_Item] = []
        self._grid: dict[tuple[int, int], list[int]] = defaultdict(list)
        for feature in geojson.get("features", []):
            geometry = feature.get("geometry") or {}
            center = _centroid(geometry)
            if center is None:
                continue
            item = _Item(
                lat=center[0],
                lon=center[1],
                geometry=geometry,
                properties=feature.get("properties") or {},
            )
            self._grid[self._cell(item.lat, item.lon)].append(len(self.items))
            self.items.append(item)

    @staticmethod
    def _cell(lat: float, lon: float) -> tuple[int, int]:
        return (math.floor(lat / GRID_CELL_DEG), math.floor(lon / GRID_CELL_DEG))

    def within(
        self, lat: float, lon: float, radius_m: float, limit: int | None = None
    ) -> list[_Hit]:
        d_lat = radius_m / METERS_PER_DEGREE
        d_lon = radius_m / (METERS_PER_DEGREE * max(math.cos(math.radians(lat)), 0.01))
        row_lo, col_lo = self._cell(lat - d_lat, lon - d_lon)
        row_hi, col_hi = self._cell(lat + d_lat, lon + d_lon)

        hits: list[_Hit] = []
        for row in range(row_lo, row_hi + 1):
            for col in range(col_lo, col_hi + 1):
                for index in self._grid.get((row, col), ()):
                    item = self.items[index]
                    dist = haversine_m(lat, lon, item.lat, item.lon)
                    if dist <= radius_m:
                        hits.append(_Hit(item, dist))

        hits.sort(key=lambda h: h.distance_m)
        return hits if limit is None else hits[:limit]

    def count_within(self, lat: float, lon: float, radius_m: float) -> int:
        return len(self.within(lat, lon, radius_m))

    def containing(self, lat: float, lon: float) -> _Item | None:
        for item in self.items:
            if _geometry_contains(item.geometry, lat, lon):
                return item
        return None


@dataclass(frozen=True, slots=True)
class _ZoneProfile:
    zone_id: str
    name: str
    lat: float
    lon: float
    cctv_count: int
    chokepoint_count: int
    has_medical: bool
    properties: dict = field(default_factory=dict)


def _read_geojson(filename: str) -> dict:
    path = DATA_DIR / filename
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {"type": "FeatureCollection", "features": []}
    if not isinstance(data, dict):
        return {"type": "FeatureCollection", "features": []}
    return data


class _Dataset:
    def __init__(self) -> None:
        self.zones = GeoLayer(_read_geojson("zones.geojson"))
        self.cctv = GeoLayer(_read_geojson("cctv.geojson"))
        self.police = GeoLayer(_read_geojson("police_stations.geojson"))
        self.chokepoints = GeoLayer(_read_geojson("chokepoints.geojson"))
        self.profiles = [self._profile(zone) for zone in self.zones.items]

    def _profile(self, zone: _Item) -> _ZoneProfile:
        props = zone.properties
        zone_id = str(props.get("id") or props.get("name") or props.get("Name") or "unknown")
        name = str(props.get("name") or props.get("Name") or zone_id)
        return _ZoneProfile(
            zone_id=zone_id,
            name=name,
            lat=zone.lat,
            lon=zone.lon,
            cctv_count=self.cctv.count_within(zone.lat, zone.lon, CCTV_ZONE_RADIUS_M),
            chokepoint_count=self.chokepoints.count_within(
                zone.lat, zone.lon, CHOKEPOINT_ZONE_RADIUS_M
            ),
            has_medical=bool(props.get("has_medical")),
            properties=props,
        )


def _time_band(minutes_since: int) -> int:
    return bisect_right(TIME_BREAKPOINTS, minutes_since)


def _is_vulnerable(age: int) -> bool:
    return age < 12 or age > 60


def calculate_confidence(minutes_since: int) -> str:
    return CONFIDENCE_BY_BAND[_time_band(minutes_since)]


def calculate_search_radius(minutes_since: int, age: int) -> int:
    base = RADIUS_BY_BAND[_time_band(minutes_since)]
    if age > 70:
        modifier = 0.6
    elif age > 60:
        modifier = 0.75
    elif age < 8:
        modifier = 0.5
    elif age < 15:
        modifier = 0.8
    else:
        modifier = 1.0
    return int(base * modifier)


def determine_priority(age: int, minutes_since: int) -> PriorityLevel:
    vulnerable = _is_vulnerable(age)
    if vulnerable and minutes_since > 30:
        return PriorityLevel.critical
    if vulnerable or minutes_since > 60:
        return PriorityLevel.high
    if minutes_since > 30:
        return PriorityLevel.medium
    return PriorityLevel.low


def _to_nearby(hit: _Hit) -> NearbyFeature:
    props = hit.item.properties
    feature_id = props.get("id") or props.get("name") or "unknown"
    feature_name = props.get("name") or props.get("Name") or props.get("id") or "Unknown"
    return NearbyFeature(
        id=str(feature_id),
        name=str(feature_name),
        distance_m=round(hit.distance_m, 1),
        latitude=hit.item.lat,
        longitude=hit.item.lon,
        properties={k: v for k, v in props.items() if k not in _RESERVED_KEYS},
    )


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}{'' if count == 1 else 's'}"


def _validate(lat: float, lon: float) -> None:
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        raise ValueError("Coordinates out of range")


class RecommendationEngine:
    def __init__(self) -> None:
        self._data = _Dataset()

    def reload_data(self) -> None:
        self._data = _Dataset()

    def get_recommendation(
        self,
        lat: float,
        lon: float,
        age: int = 30,
        gender: str = "male",
        minutes_since: int = 30,
    ) -> dict[str, Any]:
        _validate(lat, lon)
        age = max(0, min(int(age), 120))
        minutes_since = max(0, int(minutes_since))
        data = self._data

        radius = calculate_search_radius(minutes_since, age)

        zone = data.zones.containing(lat, lon)
        if zone is not None:
            current_zone = zone.properties
        else:
            fallback = data.zones.within(lat, lon, ZONE_FALLBACK_RADIUS_M, limit=1)
            current_zone = fallback[0].item.properties if fallback else None

        police_hits = data.police.within(lat, lon, POLICE_SEARCH_RADIUS_M, limit=1)
        if police_hits:
            nearest_police = _to_nearby(police_hits[0])
        else:
            nearest_police = NearbyFeature(
                id="POLICE-DEFAULT",
                name="Nearest Police Station",
                distance_m=0,
                latitude=lat,
                longitude=lon,
                properties={"note": "No police station data available"},
            )

        return {
            "current_zone": current_zone,
            "nearest_police": nearest_police,
            "nearby_cctv": [
                _to_nearby(h) for h in data.cctv.within(lat, lon, radius, NEARBY_LIMIT)
            ],
            "nearby_chokepoints": [
                _to_nearby(h)
                for h in data.chokepoints.within(lat, lon, radius, NEARBY_LIMIT)
            ],
            "priority_zones": self._score_zones(
                data, lat, lon, age, minutes_since, radius
            ),
            "search_radius_m": radius,
            "confidence": calculate_confidence(minutes_since),
            "priority_level": determine_priority(age, minutes_since),
        }

    @staticmethod
    def _score_zones(
        data: _Dataset,
        lat: float,
        lon: float,
        age: int,
        minutes_since: int,
        search_radius: int,
    ) -> list[ZonePriority]:
        vulnerable = _is_vulnerable(age)
        scored: list[ZonePriority] = []

        for zone in data.profiles:
            dist = haversine_m(lat, lon, zone.lat, zone.lon)
            score = 1000.0 / (dist / 100.0 + 1.0)
            score += zone.cctv_count * CCTV_WEIGHT
            score += zone.chokepoint_count * CHOKEPOINT_WEIGHT

            medical_bonus = vulnerable and zone.has_medical
            if medical_bonus:
                score += VULNERABILITY_WEIGHT

            if minutes_since > LATE_DECAY_AFTER_MIN:
                score *= LATE_DECAY_FACTOR
            if dist > search_radius:
                score *= OUT_OF_RANGE_FACTOR

            if dist < 500:
                reasons = ["Immediate vicinity of last sighting"]
            elif dist < 1000:
                reasons = ["Close proximity to last known location"]
            else:
                reasons = [f"{dist:.0f}m from last known location"]
            if zone.cctv_count:
                reasons.append(f"{_plural(zone.cctv_count, 'CCTV camera')} in zone")
            if zone.chokepoint_count:
                reasons.append(f"{_plural(zone.chokepoint_count, 'chokepoint')} nearby")
            if medical_bonus:
                reasons.append("Medical facilities available")

            scored.append(
                ZonePriority(
                    zone_id=zone.zone_id,
                    zone_name=zone.name,
                    score=round(score, 1),
                    reason="; ".join(reasons),
                )
            )

        return heapq.nlargest(TOP_ZONES, scored, key=lambda z: z.score)