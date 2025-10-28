# syntax=docker/dockerfile:1
FROM python:3.12-slim AS backend-builder
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv
RUN python -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
WORKDIR /app
COPY pyproject.toml ./
COPY backend ./backend
RUN pip install --upgrade pip \
    && pip install --no-cache-dir .

FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY frontend ./frontend
# Frontend is plain static assets; copy to staging directory for clarity
RUN mkdir -p /opt/frontend && cp -r frontend/. /opt/frontend/

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PLANTIT_DATA_DIR=/app/backend/data \
    PLANTIT_DB_FILENAME=plantit.db
RUN python -m venv "$VIRTUAL_ENV" && apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
WORKDIR /app
COPY --from=backend-builder $VIRTUAL_ENV $VIRTUAL_ENV
COPY backend ./backend
COPY --from=frontend-builder /opt/frontend ./frontend
RUN mkdir -p backend/data/media
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:8080/api/v1/health || exit 1
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8080"]
