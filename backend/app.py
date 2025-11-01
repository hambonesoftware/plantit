"""FastAPI application entry point for Plantit backend."""
from __future__ import annotations

import logging
import os
from contextvars import ContextVar
from datetime import date, datetime, timedelta, timezone
from threading import Lock
from typing import Any, Dict, List, Sequence
from uuid import uuid4

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from pydantic import BaseModel, Field, validator

from backend.data import seed_content
from backend.db import models
from backend.db.migrate import ensure_migrations, get_migration_state
from backend.db.seed import seed_demo_data
from backend.db.session import engine, get_session, session_scope
from plantit import __version__

LOGGER = logging.getLogger("plantit.backend")

_CORRELATION_ID: ContextVar[str | None] = ContextVar("correlation_id", default=None)


class _CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:  # pragma: no cover - logging glue
        record.correlation_id = _CORRELATION_ID.get()
        return True


LOGGER.addFilter(_CorrelationIdFilter())


def _env_flag(name: str, default: bool = False) -> bool:
    """Return a boolean flag from environment variables."""

    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"", "0", "false", "no", "off"}


def _env_text(name: str, default: str) -> str:
    """Return a sanitized string value from environment variables."""

    value = os.getenv(name)
    if value is None:
        return default
    cleaned = value.strip()
    return cleaned or default


def _env_int(name: str, default: int) -> int:
    """Return an integer configuration value with fallback to default."""

    value = os.getenv(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed >= 0 else default


def _env_list(name: str, default: Sequence[str]) -> list[str]:
    """Return a list parsed from a comma-separated environment variable."""

    value = os.getenv(name)
    if value is None:
        return list(default)

    items = [item.strip() for item in value.split(",")]
    cleaned = [item for item in items if item]
    if not cleaned:
        return list(default)
    return cleaned


APP_VERSION = os.getenv("PLANTIT_APP_VERSION", __version__)
BUILD_HASH = os.getenv("PLANTIT_BUILD_HASH", "unknown")

AUTH_ENABLED = _env_flag("PLANTIT_AUTH_ENABLED")
AUTH_USERNAME = _env_text("PLANTIT_AUTH_USERNAME", "gardener")
AUTH_PASSWORD = _env_text("PLANTIT_AUTH_PASSWORD", "sprout")
SESSION_COOKIE_NAME = _env_text("PLANTIT_SESSION_COOKIE", "plantit_session")
SESSION_COOKIE_MAX_AGE = _env_int("PLANTIT_SESSION_MAX_AGE", 60 * 60 * 24)
SESSION_COOKIE_SECURE = _env_flag("PLANTIT_SESSION_COOKIE_SECURE")
SECURITY_HEADERS_ENABLED = _env_flag("PLANTIT_ENABLE_CSP")
DEFAULT_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5580",
    "http://localhost:5580",
]
ALLOWED_ORIGINS = _env_list("PLANTIT_CORS_ALLOW_ORIGINS", DEFAULT_ALLOWED_ORIGINS)

_DASHBOARD_ALERTS_LOCK = Lock()
_DASHBOARD_ALERTS: list[Dict[str, Any]] = []

_WATERING_DISMISSALS_LOCK = Lock()
_WATERING_DISMISSALS: dict[str, date] = {}


def _reset_dashboard_alerts() -> None:
    """Restore dashboard alerts to their seeded defaults."""

    with _DASHBOARD_ALERTS_LOCK:
        _DASHBOARD_ALERTS.clear()
        _DASHBOARD_ALERTS.extend(dict(alert) for alert in seed_content.DASHBOARD_ALERTS)


_reset_dashboard_alerts()

_SECURITY_HEADERS = {
    "Content-Security-Policy": "".join(
        [
            "default-src 'self'; ",
            "script-src 'self'; ",
            "style-src 'self'; ",
            "img-src 'self' data:; ",
            "connect-src 'self'; ",
            "font-src 'self'; ",
            "object-src 'none'; ",
            "base-uri 'self'; ",
            "form-action 'self'; ",
            "frame-ancestors 'none'",
        ]
    ),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def _set_security_headers(response: Response) -> None:
    """Apply security headers when the CSP toggle is enabled."""

    if not SECURITY_HEADERS_ENABLED:
        return
    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)

app = FastAPI(title="Plantit Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_BOOTSTRAPPED = False


def _bootstrap_once() -> None:
    global _BOOTSTRAPPED
    if _BOOTSTRAPPED:
        return
    applied = ensure_migrations(engine)
    if applied:
        LOGGER.info("migrations-applied", extra={"versions": applied})
    with session_scope() as session:
        seed_demo_data(session)
    _BOOTSTRAPPED = True


_bootstrap_once()


def _is_request_authenticated(request: Request) -> bool:
    """Determine whether the incoming request holds a valid auth session."""

    if not AUTH_ENABLED:
        return True
    cookie_value = request.cookies.get(SESSION_COOKIE_NAME)
    return bool(cookie_value) and cookie_value == AUTH_USERNAME


def require_authentication(request: Request) -> None:
    """Dependency that enforces authentication for write paths."""

    if not AUTH_ENABLED:
        return
    if not _is_request_authenticated(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )


def _auth_status_payload(
    request: Request, *, authenticated: bool | None = None, username: str | None = None
) -> Dict[str, Any]:
    """Return the canonical authentication status payload."""

    if not AUTH_ENABLED:
        return {"authEnabled": False, "authenticated": True, "username": None}

    if authenticated is None:
        authenticated = _is_request_authenticated(request)
        username = request.cookies.get(SESSION_COOKIE_NAME) if authenticated else None
    elif authenticated:
        username = username or request.cookies.get(SESSION_COOKIE_NAME)
    else:
        username = None

    return {
        "authEnabled": True,
        "authenticated": authenticated,
        "username": username,
    }


def _set_session_cookie(response: JSONResponse, username: str) -> None:
    """Issue the dummy auth session cookie with secure defaults."""

    if not AUTH_ENABLED:
        return

    cookie_value = username.strip()
    if not cookie_value:
        cookie_value = AUTH_USERNAME

    cookie_options: Dict[str, Any] = {
        "key": SESSION_COOKIE_NAME,
        "value": cookie_value,
        "max_age": SESSION_COOKIE_MAX_AGE or None,
        "httponly": True,
        "samesite": "lax",
        "path": "/",
    }
    if SESSION_COOKIE_SECURE:
        cookie_options["secure"] = True
    response.set_cookie(**cookie_options)


def _clear_session_cookie(response: JSONResponse) -> None:
    """Expire the dummy auth session cookie."""

    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        samesite="lax",
        secure=SESSION_COOKIE_SECURE,
        httponly=True,
    )


@app.middleware("http")
async def _inject_correlation_id(request: Request, call_next):
    incoming = request.headers.get("X-Correlation-ID")
    correlation_id = incoming if incoming else str(uuid4())
    request.state.correlation_id = correlation_id
    token = _CORRELATION_ID.set(correlation_id)
    LOGGER.info(
        "request-start",
        extra={"path": request.url.path, "method": request.method},
    )
    try:
        response = await call_next(request)
    except Exception:
        raise
    else:
        response.headers["X-Correlation-ID"] = correlation_id
        LOGGER.info(
            "request-complete",
            extra={
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
            },
        )
        return response
    finally:
        _CORRELATION_ID.reset(token)


@app.middleware("http")
async def _apply_security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    _set_security_headers(response)
    return response


@app.on_event("startup")
def _startup_event() -> None:
    LOGGER.info("backend-startup")
    _bootstrap_once()


@app.exception_handler(HTTPException)
async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", None) or str(uuid4())
    request.state.correlation_id = correlation_id
    token = _CORRELATION_ID.set(correlation_id)
    log_level = logging.WARNING if exc.status_code < 500 else logging.ERROR
    LOGGER.log(
        log_level,
        "request-failed",
        extra={
            "path": request.url.path,
            "method": request.method,
            "status_code": exc.status_code,
        },
    )
    try:
        response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers or None,
        )
    finally:
        _CORRELATION_ID.reset(token)
    response.headers["X-Correlation-ID"] = correlation_id
    _set_security_headers(response)
    return response


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", None) or str(uuid4())
    request.state.correlation_id = correlation_id
    token = _CORRELATION_ID.set(correlation_id)
    LOGGER.exception(
        "request-error",
        extra={"path": request.url.path, "method": request.method},
    )
    try:
        response = JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
    finally:
        _CORRELATION_ID.reset(token)
    response.headers["X-Correlation-ID"] = correlation_id
    _set_security_headers(response)
    return response


def _serialize_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _serialize_date(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()


def _compute_days_since_watered(plant: models.Plant) -> int | None:
    target: date | None
    if plant.last_watered is not None:
        target = plant.last_watered
    elif plant.last_watered_at is not None:
        target = plant.last_watered_at.date()
    else:
        target = None
    if target is None:
        return None
    delta = _today_utc_date() - target
    if delta.days < 0:
        return 0
    return delta.days


def _serialize_activity_log(plant: models.Plant) -> list[Dict[str, Any]]:
    entries = plant.activity_log or []
    if not isinstance(entries, Sequence):
        return []
    serialized: list[Dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        date_value = entry.get("date")
        date_iso: str | None
        if isinstance(date_value, date):
            date_iso = date_value.isoformat()
        elif isinstance(date_value, datetime):
            date_iso = date_value.date().isoformat()
        elif isinstance(date_value, str):
            try:
                parsed = date.fromisoformat(date_value)
            except ValueError:
                date_iso = None
            else:
                date_iso = parsed.isoformat()
        else:
            date_iso = None
        serialized_entry: Dict[str, Any] = {
            "date": date_iso,
            "type": str(entry.get("type") or "note"),
            "note": str(entry.get("note") or ""),
        }
        if entry.get("amount"):
            serialized_entry["amount"] = str(entry["amount"])
        if entry.get("method"):
            serialized_entry["method"] = str(entry["method"])
        serialized.append(serialized_entry)
    return serialized


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _today_utc_date() -> date:
    return _now_utc().date()


def _touch_village(village: models.Village | None) -> None:
    if village is not None:
        village.updated_at = _now_utc()


def _touch_plant(plant: models.Plant | None) -> None:
    if plant is not None:
        plant.updated_at = _now_utc()


def _serialize_village_summary(village: models.Village) -> Dict[str, Any]:
    banner_sources = [
        plant.image_url
        for plant in sorted(
            (candidate for candidate in village.plants if candidate.image_url),
            key=lambda candidate: candidate.updated_at,
            reverse=True,
        )[:6]
    ]
    return {
        "id": village.id,
        "name": village.name,
        "climate": village.climate,
        "plantCount": len(village.plants),
        "healthScore": village.health_score,
        "updatedAt": _serialize_timestamp(village.updated_at),
        "bannerImageUrls": banner_sources,
    }


def _serialize_village_detail(village: models.Village) -> Dict[str, Any]:
    summary = _serialize_village_summary(village)
    return {
        **summary,
        "description": village.description,
        "establishedAt": village.established_at.isoformat()
        if village.established_at
        else None,
        "irrigationType": village.irrigation_type,
    }


def _serialize_plant_summary(plant: models.Plant) -> Dict[str, Any]:
    return {
        "id": plant.id,
        "displayName": plant.display_name,
        "species": plant.species,
        "stage": plant.stage,
        "lastWateredAt": _serialize_timestamp(plant.last_watered_at),
        "healthScore": plant.health_score,
        "updatedAt": _serialize_timestamp(plant.updated_at),
        "notes": plant.notes,
        "imageUrl": plant.image_url,
        "family": plant.family,
        "plantOrigin": plant.plant_origin,
        "naturalHabitat": plant.natural_habitat,
        "room": plant.room,
        "sunlight": plant.sunlight,
        "potSize": plant.pot_size,
        "purchasedOn": _serialize_date(plant.purchased_on),
        "lastWatered": _serialize_date(plant.last_watered),
        "lastRepotted": _serialize_date(plant.last_repotted),
        "dormancy": plant.dormancy,
        "waterAverage": plant.water_average,
        "amount": plant.amount,
        "activityLog": _serialize_activity_log(plant),
        "daysSinceWatered": _compute_days_since_watered(plant),
    }


def _serialize_plant_detail(plant: models.Plant) -> Dict[str, Any]:
    summary = _serialize_plant_summary(plant)
    return {
        **summary,
        "notes": plant.notes,
        "villageId": plant.village_id,
        "villageName": plant.village.name if plant.village else None,
        "watering": _serialize_watering_detail(plant),
    }


def _serialize_watering_detail(plant: models.Plant) -> Dict[str, Any]:
    history_dates = [
        watering.watered_at
        for watering in sorted(plant.waterings, key=lambda record: record.watered_at)
        if watering.watered_at is not None
    ]
    history_strings = [value.isoformat() for value in history_dates]
    next_date = _predict_next_watering_date(history_dates)
    today = _today_utc_date().isoformat()
    return {
        "history": history_strings,
        "nextWateringDate": next_date.isoformat() if next_date else None,
        "hasWateringToday": today in history_strings,
    }


def _predict_next_watering_date(history: Sequence[date]) -> date | None:
    unique_sorted = sorted({value for value in history if isinstance(value, date)})
    count = len(unique_sorted)
    if count < 2:
        return None

    indices = list(range(count))
    ordinals = [value.toordinal() for value in unique_sorted]
    mean_index = sum(indices) / count
    mean_ordinal = sum(ordinals) / count
    denominator = sum((index - mean_index) ** 2 for index in indices)

    if denominator == 0:
        interval = max(1, ordinals[-1] - ordinals[-2])
        return unique_sorted[-1] + timedelta(days=interval)

    numerator = sum(
        (index - mean_index) * (ordinal - mean_ordinal)
        for index, ordinal in zip(indices, ordinals)
    )
    slope = numerator / denominator
    intercept = mean_ordinal - slope * mean_index
    predicted_ordinal = slope * count + intercept
    rounded = round(predicted_ordinal)
    minimum_next = ordinals[-1] + 1
    target = max(minimum_next, rounded)
    return date.fromordinal(target)


def _normalize_image_url(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        lowered = trimmed.lower()
        if lowered.startswith("data:image/") or lowered.startswith("http://") or lowered.startswith(
            "https://"
        ):
            return trimmed
    raise ValueError("imageUrl must be a data URL or http(s) URL")


def _active_watering_dismissals(today: date) -> set[str]:
    with _WATERING_DISMISSALS_LOCK:
        expired = [
            plant_id
            for plant_id, dismissed_on in _WATERING_DISMISSALS.items()
            if dismissed_on < today
        ]
        for plant_id in expired:
            _WATERING_DISMISSALS.pop(plant_id, None)
        return {
            plant_id
            for plant_id, dismissed_on in _WATERING_DISMISSALS.items()
            if dismissed_on == today
        }


def _dismiss_watering_for_today(plant_id: str, today: date) -> None:
    with _WATERING_DISMISSALS_LOCK:
        _WATERING_DISMISSALS[plant_id] = today


def _assert_village_version(village: models.Village, expected: datetime) -> None:
    if _serialize_timestamp(village.updated_at) != _serialize_timestamp(expected):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Village has been modified. Refresh and retry.",
        )


def _assert_plant_version(plant: models.Plant, expected: datetime) -> None:
    if _serialize_timestamp(plant.updated_at) != _serialize_timestamp(expected):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plant has been modified. Refresh and retry.",
        )


class AuthStatusResponse(BaseModel):
    """Shape for authentication status responses returned to the SPA."""

    authEnabled: bool = Field(..., description="Whether authentication is enforced")
    authenticated: bool = Field(..., description="True when the active session is authenticated")
    username: str | None = Field(
        default=None,
        description="Identifier for the authenticated user when available",
    )


class LoginRequest(BaseModel):
    """Credential payload for the dummy login flow."""

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class VillageBaseModel(BaseModel):
    name: str = Field(..., min_length=1)
    climate: str = Field(..., min_length=1)
    description: str | None = Field(default=None)
    established_at: date | None = Field(default=None, alias="establishedAt")
    irrigation_type: str | None = Field(default=None, alias="irrigationType")
    health_score: float = Field(..., ge=0.0, le=1.0, alias="healthScore")

    class Config:
        allow_population_by_field_name = True

    @validator("name", "climate")
    def _validate_required(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be empty")
        return normalized

    @validator("description", "irrigation_type", pre=True)
    def _normalize_optional(cls, value: Any) -> Any:  # noqa: N805 - pydantic signature
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class VillageCreateRequest(VillageBaseModel):
    pass


class VillageUpdateRequest(VillageBaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")


class VillageDeleteRequest(BaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")


_VALID_STAGES = {"seedling", "vegetative", "flowering", "mature"}


class PlantBaseModel(BaseModel):
    display_name: str = Field(..., alias="displayName", min_length=1)
    species: str = Field(..., min_length=1)
    stage: str = Field(..., min_length=1)
    last_watered_at: datetime | None = Field(default=None, alias="lastWateredAt")
    health_score: float = Field(..., ge=0.0, le=1.0, alias="healthScore")
    notes: str | None = Field(default=None)
    image_url: str | None = Field(default=None, alias="imageUrl")
    family: str | None = Field(default=None)
    plant_origin: str | None = Field(default=None, alias="plantOrigin")
    natural_habitat: str | None = Field(default=None, alias="naturalHabitat")
    room: str | None = Field(default=None)
    sunlight: str | None = Field(default=None)
    pot_size: str | None = Field(default=None, alias="potSize")
    purchased_on: date | None = Field(default=None, alias="purchasedOn")
    last_watered: date | None = Field(default=None, alias="lastWatered")
    last_repotted: date | None = Field(default=None, alias="lastRepotted")
    dormancy: str | None = Field(default=None)
    water_average: str | None = Field(default=None, alias="waterAverage")
    amount: str | None = Field(default=None)
    activity_log: List[Dict[str, Any]] | None = Field(default=None, alias="activityLog")

    class Config:
        allow_population_by_field_name = True

    @validator("display_name", "species")
    def _require_text(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be empty")
        return normalized

    @validator("stage")
    def _validate_stage(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip().lower()
        if normalized not in _VALID_STAGES:
            raise ValueError(f"stage must be one of {sorted(_VALID_STAGES)}")
        return normalized

    @validator("notes", pre=True)
    def _normalize_notes(cls, value: Any) -> Any:  # noqa: N805 - pydantic signature
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value

    @validator("image_url", pre=True)
    def _validate_image(cls, value: Any) -> Any:  # noqa: N805 - pydantic signature
        return _normalize_image_url(value)

    @validator(
        "family",
        "plant_origin",
        "natural_habitat",
        "room",
        "sunlight",
        "pot_size",
        "dormancy",
        "water_average",
        "amount",
        pre=True,
    )
    def _trim_optional_text(cls, value: Any) -> Any:  # noqa: N805 - pydantic signature
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value

    @validator("activity_log", pre=True)
    def _normalize_activity_log_validator(  # noqa: N805 - pydantic signature
        cls, value: Any
    ) -> List[Dict[str, Any]] | None:
        if value is None:
            return None
        if not isinstance(value, list):
            raise ValueError("activityLog must be a list")
        normalized: List[Dict[str, Any]] = []
        for entry in value:
            if not isinstance(entry, dict):
                continue
            record: Dict[str, Any] = {}
            date_value = entry.get("date")
            parsed: date | None = None
            if isinstance(date_value, date):
                parsed = date_value
            elif isinstance(date_value, str):
                try:
                    parsed = date.fromisoformat(date_value)
                except ValueError:
                    parsed = None
            record["date"] = parsed.isoformat() if parsed else None
            record["type"] = str(entry.get("type") or "note")
            record["note"] = str(entry.get("note") or "")
            if entry.get("amount"):
                record["amount"] = str(entry["amount"])
            if entry.get("method"):
                record["method"] = str(entry["method"])
            normalized.append(record)
        return normalized


class PlantCreateRequest(PlantBaseModel):
    village_id: str = Field(..., alias="villageId", min_length=1)

    @validator("village_id")
    def _normalize_village(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip()
        if not normalized:
            raise ValueError("villageId must not be empty")
        return normalized


class PlantUpdateRequest(PlantBaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")


class PlantDeleteRequest(BaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")


class PlantWateringRequest(BaseModel):
    watered_at: date | None = Field(default=None, alias="wateredAt")

    class Config:
        allow_population_by_field_name = True

    @validator("watered_at")
    def _validate_watering_date(
        cls, value: date | None
    ) -> date | None:  # noqa: N805 - pydantic signature
        if value is None:
            return None
        if value > _today_utc_date():
            raise ValueError("wateredAt cannot be in the future")
        return value
@app.get("/api/health", tags=["Health"])
def get_health() -> Dict[str, Any]:
    """Return service readiness information."""

    try:
        with engine.connect() as connection:
            connection.execute(select(1))
        db_status = "ok"
    except Exception as exc:  # pragma: no cover - defensive logging path
        LOGGER.exception("db-health-check-failed")
        db_status = f"error: {exc.__class__.__name__}"

    migration_state = get_migration_state(engine)
    migration_status = "ok" if not migration_state["pending"] else "pending: " + ", ".join(
        migration_state["pending"]
    )
    overall_status = "ok" if db_status == "ok" and not migration_state["pending"] else "degraded"
    return {
        "status": overall_status,
        "checks": {"db": db_status, "migrations": migration_status},
        "version": APP_VERSION,
        "build": BUILD_HASH,
    }


@app.get("/api/hello", tags=["Greetings"])
def get_hello() -> Dict[str, str]:
    """Return a friendly greeting used for smoke tests."""

    return {"message": "Hello, Plantit"}


@app.get("/api/auth/status", tags=["Auth"], response_model=AuthStatusResponse)
async def get_auth_status(request: Request) -> AuthStatusResponse:
    """Expose the current authentication status to the SPA."""

    payload = _auth_status_payload(request)
    return AuthStatusResponse(**payload)


@app.post("/api/auth/login", tags=["Auth"], response_model=AuthStatusResponse)
async def login(request: Request, credentials: LoginRequest) -> JSONResponse:
    """Authenticate the dummy user and issue the session cookie."""

    if not AUTH_ENABLED:
        response = JSONResponse(content=_auth_status_payload(request, authenticated=True))
        _set_security_headers(response)
        return response

    username = credentials.username.strip()
    password = credentials.password

    if username != AUTH_USERNAME or password != AUTH_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    payload = _auth_status_payload(request, authenticated=True, username=username)
    response = JSONResponse(content=payload)
    _set_session_cookie(response, username)
    _set_security_headers(response)
    # TODO: Add CSRF protection when multi-user support is introduced.
    return response


@app.post("/api/auth/logout", tags=["Auth"], response_model=AuthStatusResponse)
async def logout(request: Request) -> JSONResponse:
    """Clear the dummy auth session and return the updated status."""

    if not AUTH_ENABLED:
        response = JSONResponse(content=_auth_status_payload(request, authenticated=True))
        _set_security_headers(response)
        return response

    payload = _auth_status_payload(request, authenticated=False)
    response = JSONResponse(content=payload)
    _clear_session_cookie(response)
    _set_security_headers(response)
    return response


@app.get("/api/dashboard", tags=["Dashboard"])
def get_dashboard(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return summary metrics and alerts for the dashboard cards."""

    total_plants = session.execute(select(func.count(models.Plant.id))).scalar_one()
    active_villages = session.execute(select(func.count(models.Village.id))).scalar_one()
    success_rate = session.execute(select(func.avg(models.Plant.health_score))).scalar_one()
    upcoming_tasks = session.execute(select(func.count(models.Task.id))).scalar_one()

    with _DASHBOARD_ALERTS_LOCK:
        alerts = [dict(alert) for alert in _DASHBOARD_ALERTS]

    summary = {
        "totalPlants": total_plants,
        "activeVillages": active_villages,
        "successRate": round(success_rate or 0.0, 2),
        "upcomingTasks": upcoming_tasks,
    }
    return {
        "summary": summary,
        "alerts": alerts,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


@app.delete("/api/dashboard/alerts/{alert_id}", tags=["Dashboard"])
def dismiss_dashboard_alert(alert_id: str) -> Dict[str, Any]:
    """Dismiss a dashboard alert."""

    with _DASHBOARD_ALERTS_LOCK:
        for index, alert in enumerate(_DASHBOARD_ALERTS):
            if alert.get("id") != alert_id:
                continue
            _DASHBOARD_ALERTS.pop(index)
            return {
                "status": "dismissed",
                "alertId": alert_id,
                "dismissedAt": datetime.now(timezone.utc).isoformat(),
            }

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")


@app.get("/api/villages", tags=["Villages"])
def list_villages(
    search_term: str = Query("", alias="searchTerm"),
    climate_zones: Sequence[str] = Query(default=(), alias="climateZones"),
    min_health: float | None = Query(default=None, alias="minHealth"),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Return the available village summaries and the applied filters."""

    query = (
        session.query(models.Village)
        .options(selectinload(models.Village.plants))
        .order_by(models.Village.name)
    )

    if search_term:
        term = f"%{search_term.lower()}%"
        query = query.filter(func.lower(models.Village.name).like(term))
    if climate_zones:
        query = query.filter(models.Village.climate.in_(climate_zones))
    if min_health is not None:
        query = query.filter(models.Village.health_score >= min_health)

    villages = [_serialize_village_summary(village) for village in query.all()]

    applied_filters = {
        "searchTerm": search_term,
        "climateZones": list(climate_zones),
        "minHealth": min_health,
    }

    return {"villages": villages, "appliedFilters": applied_filters}


@app.get("/api/villages/{village_id}", tags=["Villages"])
def get_village(village_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return additional information for a specific village."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    return {"village": _serialize_village_detail(village)}


@app.get("/api/villages/{village_id}/plants", tags=["Plants"])
def list_village_plants(village_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return plants that belong to the requested village."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    village_summary = _serialize_village_summary(village)

    plants = [_serialize_plant_summary(plant) for plant in village.plants]

    return {"village": village_summary, "plants": plants}


@app.get("/api/watering/due", tags=["Plants"])
def list_due_watering_plants(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return plants that require watering today or are overdue."""

    today = _today_utc_date()
    dismissed_today = _active_watering_dismissals(today)

    query = (
        session.query(models.Plant)
        .options(
            selectinload(models.Plant.village),
            selectinload(models.Plant.waterings),
        )
        .order_by(models.Plant.display_name)
    )

    due_plants: list[Dict[str, Any]] = []
    for plant in query.all():
        watering = _serialize_watering_detail(plant)
        next_watering = watering.get("nextWateringDate")
        if not next_watering or watering.get("hasWateringToday"):
            continue
        try:
            next_date = date.fromisoformat(next_watering)
        except ValueError:
            continue
        if next_date > today or plant.id in dismissed_today:
            continue
        due_plants.append(
            {
                "id": plant.id,
                "displayName": plant.display_name,
                "villageId": plant.village_id,
                "villageName": plant.village.name if plant.village else None,
                "nextWateringDate": next_watering,
                "lastWateredAt": _serialize_timestamp(plant.last_watered_at),
            }
        )

    due_plants.sort(key=lambda item: (item["nextWateringDate"] or "", item["displayName"]))

    return {
        "plants": due_plants,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/watering/due/{plant_id}/dismiss", tags=["Plants"])
def dismiss_due_watering_plant(
    plant_id: str, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Dismiss a plant from today's watering queue."""

    plant = session.get(
        models.Plant,
        plant_id,
        options=(selectinload(models.Plant.waterings),),
    )
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    today = _today_utc_date()
    watering = _serialize_watering_detail(plant)
    next_watering = watering.get("nextWateringDate")
    if not next_watering or watering.get("hasWateringToday"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plant does not require watering today",
        )

    try:
        next_date = date.fromisoformat(next_watering)
    except ValueError as error:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plant does not require watering today",
        ) from error

    if next_date > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plant does not require watering today",
        )

    _dismiss_watering_for_today(plant_id, today)
    return {
        "status": "dismissed",
        "plantId": plant_id,
        "dismissedUntil": today.isoformat(),
    }


@app.post("/api/villages", tags=["Villages"], status_code=status.HTTP_201_CREATED)
def create_village(
    payload: VillageCreateRequest,
    _: None = Depends(require_authentication),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Create a new village record."""

    village = models.Village(
        id=str(uuid4()),
        name=payload.name,
        climate=payload.climate,
        description=payload.description,
        established_at=payload.established_at,
        irrigation_type=payload.irrigation_type,
        health_score=payload.health_score,
    )
    session.add(village)
    session.commit()
    session.refresh(village)

    return {"village": _serialize_village_detail(village)}


@app.put("/api/villages/{village_id}", tags=["Villages"])
def update_village(
    village_id: str,
    payload: VillageUpdateRequest,
    _: None = Depends(require_authentication),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Update an existing village with optimistic concurrency checking."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    _assert_village_version(village, payload.updated_at)

    village.name = payload.name
    village.climate = payload.climate
    village.description = payload.description
    village.established_at = payload.established_at
    village.irrigation_type = payload.irrigation_type
    village.health_score = payload.health_score
    _touch_village(village)
    session.commit()
    session.refresh(village)

    return {"village": _serialize_village_detail(village)}


@app.delete("/api/villages/{village_id}", tags=["Villages"])
def delete_village(
    village_id: str,
    payload: VillageDeleteRequest = Body(...),
    _: None = Depends(require_authentication),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Delete a village when the client holds the latest version token."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    _assert_village_version(village, payload.updated_at)

    session.delete(village)
    session.commit()

    return {
        "status": "deleted",
        "villageId": village_id,
        "updatedAt": _serialize_timestamp(payload.updated_at),
    }


@app.get("/api/plants/{plant_id}", tags=["Plants"])
def get_plant(plant_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return the plant detail payload and recent timeline events."""

    plant = session.execute(
        select(models.Plant)
        .options(
            selectinload(models.Plant.village),
            selectinload(models.Plant.waterings),
        )
        .where(models.Plant.id == plant_id)
    ).scalar_one_or_none()
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    plant_payload = _serialize_plant_detail(plant)
    timeline = seed_content.PLANT_TIMELINE.get(plant.id, [])
    return {"plant": plant_payload, "timeline": timeline}


@app.post(
    "/api/plants/{plant_id}/waterings",
    tags=["Plants"],
    status_code=status.HTTP_201_CREATED,
)
def record_plant_watering(
    plant_id: str,
    payload: PlantWateringRequest,
    _: None = Depends(require_authentication),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Record a watering for the given plant, defaulting to the current day."""

    plant = session.execute(
        select(models.Plant)
        .options(
            selectinload(models.Plant.village),
            selectinload(models.Plant.waterings),
        )
        .where(models.Plant.id == plant_id)
    ).scalar_one_or_none()
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    watered_at = payload.watered_at or _today_utc_date()
    existing = next(
        (event for event in plant.waterings if event.watered_at == watered_at), None
    )
    if existing is None:
        session.add(
            models.PlantWateringEvent(
                id=str(uuid4()),
                plant=plant,
                watered_at=watered_at,
            )
        )

    plant.last_watered_at = _now_utc()
    _touch_plant(plant)
    session.commit()

    refreshed = session.execute(
        select(models.Plant)
        .options(
            selectinload(models.Plant.village),
            selectinload(models.Plant.waterings),
        )
        .where(models.Plant.id == plant_id)
    ).scalar_one()

    plant_payload = _serialize_plant_detail(refreshed)
    timeline = seed_content.PLANT_TIMELINE.get(refreshed.id, [])
    return {"plant": plant_payload, "timeline": timeline}


@app.post("/api/plants", tags=["Plants"], status_code=status.HTTP_201_CREATED)
def create_plant(
    payload: PlantCreateRequest,
    _: None = Depends(require_authentication),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Create a plant within the specified village."""

    village = session.get(
        models.Village,
        payload.village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    plant = models.Plant(
        id=str(uuid4()),
        village=village,
        display_name=payload.display_name,
        species=payload.species,
        stage=payload.stage,
        last_watered_at=payload.last_watered_at,
        health_score=payload.health_score,
        notes=payload.notes,
        image_url=payload.image_url,
        family=payload.family,
        plant_origin=payload.plant_origin,
        natural_habitat=payload.natural_habitat,
        room=payload.room,
        sunlight=payload.sunlight,
        pot_size=payload.pot_size,
        purchased_on=payload.purchased_on,
        last_watered=payload.last_watered,
        last_repotted=payload.last_repotted,
        dormancy=payload.dormancy,
        water_average=payload.water_average,
        amount=payload.amount,
        activity_log=payload.activity_log or [],
    )
    session.add(plant)
    _touch_village(village)
    session.commit()
    session.refresh(plant)
    updated_village = session.get(
        models.Village,
        plant.village_id,
        options=(selectinload(models.Village.plants),),
    )

    response: Dict[str, Any] = {"plant": _serialize_plant_detail(plant)}
    if updated_village is not None:
        response["village"] = _serialize_village_summary(updated_village)
    return response


@app.put("/api/plants/{plant_id}", tags=["Plants"])
def update_plant(
    plant_id: str,
    payload: PlantUpdateRequest,
    _: None = Depends(require_authentication),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Update an existing plant with optimistic concurrency."""

    plant = session.get(
        models.Plant,
        plant_id,
        options=(
            selectinload(models.Plant.village),
            selectinload(models.Plant.waterings),
        ),
    )
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    _assert_plant_version(plant, payload.updated_at)

    plant.display_name = payload.display_name
    plant.species = payload.species
    plant.stage = payload.stage
    plant.last_watered_at = payload.last_watered_at
    plant.health_score = payload.health_score
    plant.notes = payload.notes
    plant.image_url = payload.image_url
    plant.family = payload.family
    plant.plant_origin = payload.plant_origin
    plant.natural_habitat = payload.natural_habitat
    plant.room = payload.room
    plant.sunlight = payload.sunlight
    plant.pot_size = payload.pot_size
    plant.purchased_on = payload.purchased_on
    plant.last_watered = payload.last_watered
    plant.last_repotted = payload.last_repotted
    plant.dormancy = payload.dormancy
    plant.water_average = payload.water_average
    plant.amount = payload.amount
    if payload.activity_log is not None:
        plant.activity_log = payload.activity_log or []
    _touch_plant(plant)
    _touch_village(plant.village)
    session.commit()
    session.refresh(plant)

    updated_village = None
    if plant.village_id is not None:
        updated_village = session.get(
            models.Village,
            plant.village_id,
            options=(selectinload(models.Village.plants),),
        )

    response: Dict[str, Any] = {"plant": _serialize_plant_detail(plant)}
    if updated_village is not None:
        response["village"] = _serialize_village_summary(updated_village)
    return response


@app.delete("/api/plants/{plant_id}", tags=["Plants"])
def delete_plant(
    plant_id: str,
    payload: PlantDeleteRequest = Body(...),
    _: None = Depends(require_authentication),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Remove a plant, returning the updated village summary."""

    plant = session.get(
        models.Plant,
        plant_id,
        options=(selectinload(models.Plant.village),),
    )
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    _assert_plant_version(plant, payload.updated_at)

    owning_village = plant.village
    _touch_village(owning_village)
    village_id = plant.village_id
    session.delete(plant)
    session.commit()

    updated_village = None
    if village_id is not None:
        updated_village = session.get(
            models.Village,
            village_id,
            options=(selectinload(models.Village.plants),),
        )

    response: Dict[str, Any] = {
        "status": "deleted",
        "plantId": plant_id,
        "updatedAt": _serialize_timestamp(payload.updated_at),
    }
    if updated_village is not None:
        response["village"] = _serialize_village_summary(updated_village)
    return response


@app.get("/api/today", tags=["Today"])
def get_today_tasks(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return the list of scheduled tasks for the current day."""

    tasks = session.query(models.Task).order_by(models.Task.due_at).all()
    return {
        "tasks": [
            {
                "id": task.id,
                "type": task.task_type,
                "plantId": task.plant_id,
                "plantName": task.plant_name,
                "villageName": task.village_name,
                "dueAt": task.due_at.isoformat(),
                "priority": task.priority,
            }
            for task in tasks
        ],
        "emptyStateMessage": None,
    }


@app.post("/api/import", tags=["Import/Export"], status_code=status.HTTP_202_ACCEPTED)
def post_import_bundle(
    bundle: Dict[str, Any], _: None = Depends(require_authentication)
) -> Dict[str, Any]:
    """Accept an import preview payload for future processing."""

    schema_version = bundle.get("schemaVersion")
    summary = bundle.get("summary", {})

    LOGGER.info(
        "import-preview",
        extra={"schema_version": schema_version, "summary": summary},
    )

    return {
        "status": "accepted",
        "schemaVersion": schema_version,
        "summary": summary,
        "message": "Import preview accepted. Server-side import not yet implemented.",
    }


@app.get("/api/export", tags=["Import/Export"])
def get_export_bundle(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return a stub export bundle."""

    villages = (
        session.query(models.Village)
        .options(selectinload(models.Village.plants))
        .order_by(models.Village.name)
        .all()
    )
    payload_villages = [
        {
            **_serialize_village_summary(village),
            "establishedAt": village.established_at.isoformat()
            if village.established_at
            else None,
        }
        for village in villages
    ]
    payload_plants = [
        {
            **_serialize_plant_summary(plant),
            "villageId": plant.village_id,
        }
        for village in villages
        for plant in village.plants
    ]

    return {
        "schemaVersion": seed_content.EXPORT_METADATA["schemaVersion"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metadata": seed_content.EXPORT_METADATA["metadata"],
        "payload": {"villages": payload_villages, "plants": payload_plants},
    }
