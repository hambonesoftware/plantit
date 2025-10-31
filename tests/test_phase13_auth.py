from uuid import uuid4

from fastapi.testclient import TestClient

from backend import app as backend_app


def test_write_paths_require_auth_when_enabled():
    original_auth = backend_app.AUTH_ENABLED
    original_username = backend_app.AUTH_USERNAME
    original_password = backend_app.AUTH_PASSWORD
    backend_app.AUTH_ENABLED = True
    backend_app.AUTH_USERNAME = 'gardener'
    backend_app.AUTH_PASSWORD = 'sprout'
    client = TestClient(backend_app.app)

    village_payload = {
        "name": f"Auth Test Village {uuid4().hex[:6]}",
        "climate": "Temperate",
        "healthScore": 0.5,
        "description": "Auth gated",
        "irrigationType": "drip",
        "establishedAt": "2022-01-01",
    }

    try:
        create_response = client.post("/api/villages", json=village_payload)
        assert create_response.status_code == 401

        bad_login = client.post(
            "/api/auth/login",
            json={"username": "wrong", "password": "creds"},
        )
        assert bad_login.status_code == 401

        login_response = client.post(
            "/api/auth/login",
            json={"username": backend_app.AUTH_USERNAME, "password": backend_app.AUTH_PASSWORD},
        )
        assert login_response.status_code == 200
        payload = login_response.json()
        assert payload["authEnabled"] is True
        assert payload["authenticated"] is True
        set_cookie = login_response.headers.get("set-cookie", "")
        assert backend_app.SESSION_COOKIE_NAME in set_cookie
        assert "samesite=lax" in set_cookie.lower()
        assert "httponly" in set_cookie.lower()

        create_response = client.post("/api/villages", json=village_payload)
        assert create_response.status_code == 201
        created = create_response.json()["village"]
        assert created["name"] == village_payload["name"]
        client.request(
            "DELETE",
            f"/api/villages/{created['id']}",
            json={"updatedAt": created["updatedAt"]},
        )

        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200
        assert logout_response.json()["authenticated"] is False
    finally:
        backend_app.AUTH_ENABLED = original_auth
        backend_app.AUTH_USERNAME = original_username
        backend_app.AUTH_PASSWORD = original_password


def test_security_headers_toggle():
    original_flag = backend_app.SECURITY_HEADERS_ENABLED
    backend_app.SECURITY_HEADERS_ENABLED = True
    try:
        client = TestClient(backend_app.app)
        response = client.get("/api/health")
        assert response.status_code == 200
        csp_header = response.headers.get("content-security-policy")
        assert csp_header is not None
        assert "default-src 'self'" in csp_header
        assert response.headers.get("x-frame-options") == "DENY"
        assert response.headers.get("referrer-policy") == "no-referrer"
    finally:
        backend_app.SECURITY_HEADERS_ENABLED = original_flag
