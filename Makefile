.PHONY: install lint format test backend-test frontend-lint seed run-backend

install:
pip install -e .[dev]
npm install

lint: backend-lint frontend-lint

backend-lint:
ruff check backend
black --check backend

frontend-lint:
npm run lint

format:
black backend
ruff check backend --select I --fix

backend-test:
pytest

test: backend-test

seed:
python -m backend.seeds.seed_data

run-backend:
uvicorn backend.app:app --reload --port 8000
