"""FastAPI application entrypoint for Plantit."""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import HTTPException as FastAPIHTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend import __version__
from backend.api import register_routers
from backend.db import init_db


def create_app() -> FastAPI:
    app = FastAPI(title="Plantit", version=__version__)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"]
    )

    register_routers(app)

    @app.exception_handler(FastAPIHTTPException)
    async def http_exception_handler(request: Request, exc: FastAPIHTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and "error" in detail:
            return JSONResponse(status_code=exc.status_code, content=detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": "HTTP_ERROR", "message": str(detail), "field": None}},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        field = None
        message = "Validation error"
        if errors:
            first = errors[0]
            loc = first.get("loc", [])
            if loc:
                field = loc[-1]
            message = first.get("msg", message)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": {"code": "VALIDATION_ERROR", "message": message, "field": field}},
        )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    return app


app = create_app()
