"""Contract tests that ensure fixture responses align with the OpenAPI spec."""
from __future__ import annotations

import copy
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator, RefResolver
from prance import ResolvingParser

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app import app  # noqa: E402
from backend.services import fixtures  # noqa: E402

SPEC_PATH = Path(__file__).resolve().parent.parent / "backend" / "openapi.yaml"


@pytest.fixture(scope="session")
def _loaded_spec():
    parser = ResolvingParser(str(SPEC_PATH))
    return parser.specification


def _convert_nullable(node):
    if isinstance(node, dict):
        converted = {key: _convert_nullable(value) for key, value in node.items() if key != "nullable"}
        if node.get("nullable"):
            type_value = converted.get("type")
            if isinstance(type_value, list):
                if "null" not in type_value:
                    converted["type"] = [*type_value, "null"]
            elif isinstance(type_value, str):
                converted["type"] = [type_value, "null"]
            else:
                converted.setdefault("anyOf", []).append({"type": "null"})
        return converted
    if isinstance(node, list):
        return [_convert_nullable(item) for item in node]
    return node


@pytest.fixture(scope="session")
def _spec_for_validation(_loaded_spec):
    return _convert_nullable(copy.deepcopy(_loaded_spec))


@pytest.fixture(scope="session")
def _schema_resolver(_spec_for_validation):
    return RefResolver.from_schema(_spec_for_validation)


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


def _validate_response(path: str, method: str, status_code: int, payload: dict, spec: dict, resolver: RefResolver) -> None:
    method_key = method.lower()
    schema = spec["paths"][path][method_key]["responses"][str(status_code)]["content"]["application/json"]["schema"]
    Draft7Validator(schema, resolver=resolver).validate(payload)


def test_openapi_document_parses(_loaded_spec):
    assert _loaded_spec["openapi"].startswith("3."), "Unexpected OpenAPI version"


def test_health_contract(client, _spec_for_validation, _schema_resolver):
    response = client.get("/api/health")
    assert response.status_code == 200
    _validate_response("/api/health", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


def test_hello_contract(client, _spec_for_validation, _schema_resolver):
    response = client.get("/api/hello")
    assert response.status_code == 200
    _validate_response("/api/hello", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


def test_dashboard_contract(client, _spec_for_validation, _schema_resolver):
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    _validate_response("/api/dashboard", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


def test_village_list_contract(client, _spec_for_validation, _schema_resolver):
    response = client.get("/api/villages", params={"climateZones": ["Temperate", "Arid"], "minHealth": 0.7})
    assert response.status_code == 200
    _validate_response("/api/villages", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


@pytest.mark.parametrize("village_id", [item["id"] for item in fixtures.VILLAGE_SUMMARIES])
def test_village_detail_contract(client, _spec_for_validation, _schema_resolver, village_id):
    response = client.get(f"/api/villages/{village_id}")
    assert response.status_code == 200
    _validate_response("/api/villages/{villageId}", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


def test_village_plants_contract(client, _spec_for_validation, _schema_resolver):
    sample_village = fixtures.VILLAGE_SUMMARIES[0]["id"]
    response = client.get(f"/api/villages/{sample_village}/plants")
    assert response.status_code == 200
    _validate_response("/api/villages/{villageId}/plants", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


@pytest.mark.parametrize("plant_id", list(fixtures.PLANT_DETAIL_BY_ID.keys())[:3])
def test_plant_detail_contract(client, _spec_for_validation, _schema_resolver, plant_id):
    response = client.get(f"/api/plants/{plant_id}")
    assert response.status_code == 200
    _validate_response("/api/plants/{plantId}", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


def test_today_contract(client, _spec_for_validation, _schema_resolver):
    response = client.get("/api/today")
    assert response.status_code == 200
    _validate_response("/api/today", "get", 200, response.json(), _spec_for_validation, _schema_resolver)


def test_import_contract(client, _spec_for_validation, _schema_resolver):
    payload = {"schemaVersion": 1, "summary": {"villages": 3, "plants": 7}}
    response = client.post("/api/import", json=payload)
    assert response.status_code == 202
    _validate_response("/api/import", "post", 202, response.json(), _spec_for_validation, _schema_resolver)


def test_export_contract(client, _spec_for_validation, _schema_resolver):
    response = client.get("/api/export")
    assert response.status_code == 200
    _validate_response("/api/export", "get", 200, response.json(), _spec_for_validation, _schema_resolver)
