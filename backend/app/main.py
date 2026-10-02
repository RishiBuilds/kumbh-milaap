import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .routes import cases, recommend, geodata, stats, search

APP_NAME = "Kumbh Milaap API"
APP_VERSION = os.getenv("KUMBH_API_VERSION", "1.0.0")

DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]


def load_origins() -> list[str]:
    raw = os.getenv("KUMBH_CORS_ORIGINS", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    return list(dict.fromkeys(DEFAULT_ORIGINS + extra))


logging.basicConfig(
    level=os.getenv("KUMBH_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("kumbh_milaap")

STARTED_AT = time.monotonic()

TAGS_METADATA = [
    {"name": "cases", "description": "Create, search and update missing person cases."},
    {"name": "recommend", "description": "Search recommendations ranked by proximity, camera coverage and chokepoints."},
    {"name": "geodata", "description": "GeoJSON layers for zones, cameras, police stations and chokepoints."},
    {"name": "stats", "description": "Live aggregate figures for the admin dashboard."},
    {"name": "search", "description": "Look up cases by name or case ID."},
    {"name": "root", "description": "API information and health checks."},
]

DESCRIPTION = """
Kumbh Milaap helps families find each other during Nashik Simhastha Kumbh Mela 2027.

It turns a missing person report into an immediate, data-driven search plan and shows it on a live map of the Mela grounds.

## What it does

- **Case management:** create, track and update missing person cases.
- **Recommendation engine:** ranks zones by distance, camera coverage and chokepoint density.
- **GeoJSON data:** serves map layers for zones, cameras, police stations and chokepoints.
- **Dashboard stats:** live counts of active, found and closed cases.
- **Search:** find a case by name or case ID.
- **QR codes:** track a case with a scannable code.

## Privacy

Only clothing and appearance metadata is analysed. No biometric face data is stored.
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("%s v%s starting", APP_NAME, APP_VERSION)
    logger.info("Allowed origins: %s", ", ".join(load_origins()))
    yield
    logger.info("%s shutting down", APP_NAME)


app = FastAPI(
    title=APP_NAME,
    description=DESCRIPTION,
    version=APP_VERSION,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=load_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time-Ms"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.1f}"
    if request.url.path not in ("/health", "/ready"):
        logger.info(
            "%s %s %s %.1fms id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )
    return response


def error_body(request: Request, code: str, message: str, details=None) -> dict:
    body = {
        "error": {
            "code": code,
            "message": message,
            "request_id": getattr(request.state, "request_id", None),
        }
    }
    if details is not None:
        body["error"]["details"] = details
    return body


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(request, f"http_{exc.status_code}", str(exc.detail)),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    details = [
        {
            "field": ".".join(str(part) for part in err["loc"] if part != "body"),
            "message": err["msg"],
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content=error_body(request, "validation_error", "Some fields are missing or invalid.", details),
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error id=%s", getattr(request.state, "request_id", None))
    return JSONResponse(
        status_code=500,
        content=error_body(request, "internal_error", "Something went wrong on our side. Please try again."),
    )


app.include_router(cases.router)
app.include_router(recommend.router)
app.include_router(geodata.router)
app.include_router(stats.router)
app.include_router(search.router)


@app.get("/", tags=["root"], summary="API information")
async def root() -> dict:
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "operational",
        "description": "Missing person search and recommendation system for Nashik Simhastha Kumbh Mela 2027.",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["root"], summary="Liveness check")
async def health() -> dict:
    return {
        "status": "healthy",
        "version": APP_VERSION,
        "uptime_seconds": round(time.monotonic() - STARTED_AT),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready", tags=["root"], summary="Readiness check")
async def ready() -> dict:
    return {"status": "ready", "version": APP_VERSION}