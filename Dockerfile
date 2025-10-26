# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml README.md ./
COPY backend backend
RUN pip install --prefix=/install .

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLANTIT_DATABASE_URL=sqlite:////app/backend/data/plantit.db \
    PLANTIT_MEDIA_ROOT=/app/backend/data/media
WORKDIR /app
COPY --from=builder /install /usr/local
COPY backend backend
COPY frontend frontend
COPY README.md README.md
COPY package.json package.json
COPY pyproject.toml pyproject.toml
RUN mkdir -p backend/data/media
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/v1/health', timeout=2)"
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8080"]
