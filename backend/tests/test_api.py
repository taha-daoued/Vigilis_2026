from fastapi.testclient import TestClient

from app.auth import get_verifier, require_ai_key
from app.config import Settings, get_settings
from app.main import create_app
from tests.conftest import bearer


def test_health_is_public(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_me_without_token_is_401(client):
    assert client.get("/me").status_code == 401


def test_me_with_invalid_token_is_401(client):
    assert client.get("/me", headers=bearer("n-importe-quoi")).status_code == 401


def test_me_returns_verified_identity(client):
    r = client.get("/me", headers=bearer("tok-user"))
    assert r.status_code == 200
    assert r.json() == {"uid": "u1", "email": "user@test", "role": "user"}


def test_role_defaults_to_user_when_claim_missing_or_unknown(client):
    assert client.get("/me", headers=bearer("tok-sans-role")).json()["role"] == "user"
    assert client.get("/me", headers=bearer("tok-role-bizarre")).json()["role"] == "user"


def test_token_without_uid_is_rejected(client):
    assert client.get("/me", headers=bearer("tok-sans-uid")).status_code == 401


def test_admin_route_forbids_normal_user(client):
    assert client.get("/test/admin", headers=bearer("tok-user")).status_code == 403


def test_admin_route_requires_a_token(client):
    assert client.get("/test/admin").status_code == 401


def test_admin_route_accepts_admin(client):
    r = client.get("/test/admin", headers=bearer("tok-admin"))
    assert r.status_code == 200 and r.json() == {"uid": "a1"}


def test_ai_route_needs_the_right_api_key(client):
    assert client.get("/test/ai").status_code == 401
    assert client.get("/test/ai", headers={"X-API-Key": "mauvaise"}).status_code == 401
    assert client.get("/test/ai", headers={"X-API-Key": "cle-de-test"}).status_code == 200


def test_ai_route_disabled_when_key_not_configured():
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(ai_api_key="")
    from fastapi import Depends
    app.get("/test/ai", dependencies=[Depends(require_ai_key)])(lambda: {"ok": True})
    r = TestClient(app).get("/test/ai", headers={"X-API-Key": ""})
    assert r.status_code == 503  # jamais ouverte par défaut


def test_cors_allows_only_configured_origin(client):
    ok = client.options("/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    ko = client.options("/health", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in ko.headers
