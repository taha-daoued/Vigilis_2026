import pytest
from fastapi.testclient import TestClient

from app.auth import get_verifier
from app.config import Settings, get_settings
from app.main import create_app
from app.repository import InMemoryRepository
from app.sos import get_repository
from tests.conftest import FakeVerifier, bearer

POS = {"lat": 6.5244, "lng": 3.3792}


@pytest.fixture
def ctx():
    repo = InMemoryRepository()
    app = create_app()
    app.dependency_overrides[get_verifier] = lambda: FakeVerifier()
    app.dependency_overrides[get_settings] = lambda: Settings(ai_api_key="x")
    app.dependency_overrides[get_repository] = lambda: repo
    return TestClient(app), repo


def test_sos_requires_a_token(ctx):
    client, repo = ctx
    assert client.post("/sos", json={"position": POS}).status_code == 401
    assert repo.alerts == {}


def test_sos_with_position_creates_an_alert_and_a_log(ctx):
    client, repo = ctx
    r = client.post("/sos", json={"position": POS, "positionSource": "GPS"}, headers=bearer("tok-user"))
    assert r.status_code == 201 and r.json()["duplicate"] is False
    alert = repo.alerts[r.json()["id"]]
    assert alert["type"] == "sos" and alert["status"] == "nouveau" and alert["source"] == "app"
    assert alert["userId"] == "u1" and alert["position"] == POS
    assert "score" not in alert  # un SOS ne passe pas par l'IA
    assert repo.logs == [{"kind": "sos", "action": "SOS reçu", "actor": "u1", "at": alert["receivedAt"], "incidentId": r.json()["id"]}]


def test_sos_without_position_is_accepted(ctx):
    client, repo = ctx
    for body in ({"position": None}, {}):
        repo.alerts.clear()
        r = client.post("/sos", json=body, headers=bearer("tok-user"))
        assert r.status_code == 201
        alert = next(iter(repo.alerts.values()))
        assert alert["position"] is None and "sans position" in alert["description"]


def test_client_cannot_choose_user_or_status(ctx):
    client, repo = ctx
    for extra in ({"userId": "a1"}, {"status": "cloture"}, {"createdAt": "2020-01-01T00:00:00Z"}, {"type": "violence"}):
        r = client.post("/sos", json={"position": POS, **extra}, headers=bearer("tok-user"))
        assert r.status_code == 422
    assert repo.alerts == {}


@pytest.mark.parametrize("pos", [
    {"lat": 91, "lng": 0}, {"lat": -91, "lng": 0}, {"lat": 0, "lng": 181}, {"lat": 0, "lng": -181},
    {"lat": "abc", "lng": 0}, {"lat": 1}, {"lat": 1, "lng": 1, "alt": 5},
])
def test_invalid_position_is_rejected(ctx, pos):
    client, repo = ctx
    assert client.post("/sos", json={"position": pos}, headers=bearer("tok-user")).status_code == 422
    assert repo.alerts == {}


def test_position_source_is_limited(ctx):
    client, _ = ctx
    r = client.post("/sos", json={"position": POS, "positionSource": "x" * 41}, headers=bearer("tok-user"))
    assert r.status_code == 422


def test_double_tap_returns_the_same_alert(ctx):
    client, repo = ctx
    first = client.post("/sos", json={"position": POS}, headers=bearer("tok-user"))
    second = client.post("/sos", json={"position": POS}, headers=bearer("tok-user"))
    assert second.status_code == 200 and second.json()["duplicate"] is True
    assert second.json()["id"] == first.json()["id"]
    assert len(repo.alerts) == 1 and len(repo.logs) == 1


def test_two_users_are_not_deduplicated(ctx):
    client, repo = ctx
    client.post("/sos", json={"position": POS}, headers=bearer("tok-user"))
    r = client.post("/sos", json={"position": POS}, headers=bearer("tok-admin"))
    assert r.status_code == 201 and len(repo.alerts) == 2
