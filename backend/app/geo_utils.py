import heapq
import math
from collections.abc import Iterator, Sequence
from typing import Any

EARTH_RADIUS_M = 6_371_000.0
EDGE_TOLERANCE = 1e-12
COMPASS_POINTS = ("north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west")

Feature = dict[str, Any]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    a = min(1.0, max(0.0, a))
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def compass_direction(bearing: float) -> str:
    return COMPASS_POINTS[int(((bearing % 360) + 22.5) // 45) % 8]


def format_distance(metres: float) -> str:
    if metres < 1000:
        return f"{round(metres)} m"
    return f"{metres / 1000:.1f} km"


def describe_offset(lat: float, lon: float, target_lat: float, target_lon: float) -> str:
    distance = haversine_distance(lat, lon, target_lat, target_lon)
    if distance < 1:
        return "at this location"
    direction = compass_direction(bearing_degrees(lat, lon, target_lat, target_lon))
    return f"{format_distance(distance)} {direction}"


def _extract_point(feature: Feature) -> tuple[float, float] | None:
    geometry = feature.get("geometry") or {}
    if geometry.get("type") != "Point":
        return None
    coords = geometry.get("coordinates")
    if not coords or len(coords) < 2:
        return None
    try:
        lon = float(coords[0])
        lat = float(coords[1])
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def _scored_points(lat: float, lon: float, features: Sequence[Feature]) -> Iterator[tuple[float, Feature, float, float]]:
    for feature in features:
        point = _extract_point(feature)
        if point is None:
            continue
        feat_lat, feat_lon = point
        yield haversine_distance(lat, lon, feat_lat, feat_lon), feature, feat_lat, feat_lon


def _build_entry(feature: Feature, distance: float, feat_lat: float, feat_lon: float) -> dict:
    entry = dict(feature.get("properties") or {})
    entry["distance_m"] = round(distance, 2)
    entry.setdefault("latitude", feat_lat)
    entry.setdefault("longitude", feat_lon)
    return entry


def find_nearest_points(lat: float, lon: float, geojson_features: Sequence[Feature], n: int = 5) -> list[dict]:
    if n <= 0:
        return []
    nearest = heapq.nsmallest(n, _scored_points(lat, lon, geojson_features), key=lambda item: item[0])
    return [_build_entry(feature, dist, flat, flon) for dist, feature, flat, flon in nearest]


def find_nearest_point(lat: float, lon: float, geojson_features: Sequence[Feature]) -> dict | None:
    results = find_nearest_points(lat, lon, geojson_features, n=1)
    return results[0] if results else None


def find_points_in_radius(lat: float, lon: float, geojson_features: Sequence[Feature], radius_m: float) -> list[dict]:
    if radius_m <= 0:
        return []
    inside = [item for item in _scored_points(lat, lon, geojson_features) if item[0] <= radius_m]
    inside.sort(key=lambda item: item[0])
    return [_build_entry(feature, dist, flat, flon) for dist, feature, flat, flon in inside]


def _on_segment(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> bool:
    cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1)
    if abs(cross) > EDGE_TOLERANCE:
        return False
    within_x = min(x1, x2) - EDGE_TOLERANCE <= px <= max(x1, x2) + EDGE_TOLERANCE
    within_y = min(y1, y2) - EDGE_TOLERANCE <= py <= max(y1, y2) + EDGE_TOLERANCE
    return within_x and within_y


def _ring_position(px: float, py: float, ring: Sequence[Sequence[float]]) -> int:
    if len(ring) < 3:
        return 0
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if _on_segment(px, py, xi, yi, xj, yj):
            return 2
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return 1 if inside else 0


def point_in_polygon(lat: float, lon: float, polygon_coords: Sequence) -> bool:
    if not polygon_coords:
        return False
    position = _ring_position(lon, lat, polygon_coords[0])
    if position == 0:
        return False
    if position == 2:
        return True
    for hole in polygon_coords[1:]:
        if _ring_position(lon, lat, hole) == 1:
            return False
    return True


def point_in_multipolygon(lat: float, lon: float, multipolygon_coords: Sequence) -> bool:
    return any(point_in_polygon(lat, lon, polygon) for polygon in multipolygon_coords)


def find_zone(lat: float, lon: float, zones_features: Sequence[Feature]) -> dict | None:
    for feature in zones_features:
        geometry = feature.get("geometry") or {}
        kind = geometry.get("type")
        coords = geometry.get("coordinates")
        if not coords:
            continue
        if kind == "Polygon" and point_in_polygon(lat, lon, coords):
            return dict(feature.get("properties") or {})
        if kind == "MultiPolygon" and point_in_multipolygon(lat, lon, coords):
            return dict(feature.get("properties") or {})
    return None


def get_centroid(polygon_coords: Sequence) -> tuple[float, float]:
    if not polygon_coords or not polygon_coords[0]:
        return (0.0, 0.0)

    ring = [(float(p[0]), float(p[1])) for p in polygon_coords[0]]
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    n = len(ring)

    origin_x, origin_y = ring[0]
    shifted = [(x - origin_x, y - origin_y) for x, y in ring]

    signed_area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x0, y0 = shifted[i]
        x1, y1 = shifted[(i + 1) % n]
        cross = x0 * y1 - x1 * y0
        signed_area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    signed_area *= 0.5

    if abs(signed_area) < 1e-18:
        avg_lon = sum(p[0] for p in ring) / n
        avg_lat = sum(p[1] for p in ring) / n
        return (avg_lat, avg_lon)

    factor = 1.0 / (6.0 * signed_area)
    return (cy * factor + origin_y, cx * factor + origin_x)