from __future__ import annotations

import hashlib
import json
import logging
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi import status as http_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/geodata", tags=["geodata"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

LAYERS: dict[str, tuple[str, str]] = {
    "cctv": ("cctv.geojson", "CCTV camera locations"),
    "police": ("police_stations.geojson", "Police station locations"),
    "chokepoints": ("chokepoints.geojson", "Crowd chokepoint locations"),
    "zones": ("zones.geojson", "Zone boundaries"),
}

MEDIA_TYPE = "application/geo+json"
CACHE_CONTROL = "public, max-age=300"


@dataclass(frozen=True, slots=True)
class _Entry:
    signature: tuple[int, int]
    body: bytes
    etag: str


_cache: dict[str, _Entry] = {}
_lock = threading.Lock()


def _error(code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


def _load(filename: str) -> _Entry:
    path = DATA_DIR / filename

    try:
        stat = path.stat()
    except FileNotFoundError:
        logger.error("GeoJSON file missing: %s", path)
        raise _error(http_status.HTTP_404_NOT_FOUND, f"GeoJSON layer '{filename}' not found.")
    except OSError:
        logger.exception("Unable to stat GeoJSON file: %s", path)
        raise _error(http_status.HTTP_500_INTERNAL_SERVER_ERROR, f"Error reading '{filename}'.")

    signature = (stat.st_mtime_ns, stat.st_size)
    cached = _cache.get(filename)
    if cached is not None and cached.signature == signature:
        return cached

    with _lock:
        cached = _cache.get(filename)
        if cached is not None and cached.signature == signature:
            return cached

        try:
            with path.open("rb") as handle:
                data = json.load(handle)
        except json.JSONDecodeError:
            logger.exception("Invalid JSON in %s", path)
            raise _error(http_status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to parse '{filename}'.")
        except OSError:
            logger.exception("Unable to read %s", path)
            raise _error(http_status.HTTP_500_INTERNAL_SERVER_ERROR, f"Error reading '{filename}'.")

        if not isinstance(data, dict):
            logger.error("Unexpected GeoJSON root type in %s", path)
            raise _error(http_status.HTTP_500_INTERNAL_SERVER_ERROR, f"Invalid GeoJSON in '{filename}'.")

        body = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        entry = _Entry(
            signature=signature,
            body=body,
            etag=f'"{hashlib.sha1(body).hexdigest()[:16]}"',
        )
        _cache[filename] = entry
        return entry


def _etag_matches(header: str | None, etag: str) -> bool:
    if not header:
        return False
    candidates = {tag.strip().removeprefix("W/") for tag in header.split(",")}
    return "*" in candidates or etag in candidates


def _make_handler(filename: str) -> Callable[[Request], Response]:
    def handler(request: Request) -> Response:
        entry = _load(filename)
        headers = {"ETag": entry.etag, "Cache-Control": CACHE_CONTROL}
        if _etag_matches(request.headers.get("if-none-match"), entry.etag):
            return Response(status_code=http_status.HTTP_304_NOT_MODIFIED, headers=headers)
        return Response(content=entry.body, media_type=MEDIA_TYPE, headers=headers)

    return handler


for _name, (_filename, _summary) in LAYERS.items():
    router.add_api_route(
        f"/{_name}",
        _make_handler(_filename),
        methods=["GET"],
        name=f"get_{_name}",
        summary=_summary,
        response_class=Response,
    )