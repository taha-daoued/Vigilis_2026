from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth import get_verifier
from app.config import Settings, get_settings
from app.detections import event_time
from app.main import create_app
from app.repository import InMemoryRepository
from app.sos import get_repository
from tests.conftest import FakeVerifier, bearer

KEY = {"X-API-Key": "cle-de-test"}
BODY = {"type": "violence", "score": 0.91, "position": {"lat": 6.52, "lng": 3.37}, "cameraId": "cam-1",
        "description": "Mouvements brusques détectés", "windowsConfirmed": 3}


def make_client(api_key="cle-de-test"):
    repo = InMemoryRepository()
    app = create_app()
    app.dependency_overrides[get_verifier] = lambda: FakeVerifier()
    app.dependency_overrides[get_settings] = lambda: Settings(ai_api_key=api_key)
    app.dependency_overrides[get_repository] = lambda: repo
    return TestClient(app), repo


@pytest.fixture
def ctx():
    return make_client()


def test_key_is_required_and_must_match(ctx):
    client, repo = ctx
    assert client.post("/incidents", json=BODY).status_code == 401
    assert client.post("/incidents", json=BODY, headers={"X-API-Key": "mauvaise"}).status_code == 401
    assert repo.alerts == {}


def test_a_logged_in_admin_cannot_create_a_detection(ctx):
    client, repo = ctx
    assert client.post("/incidents", json=BODY, headers=bearer("tok-admin")).status_code == 401
    assert repo.alerts == {}


def test_disabled_when_no_key_is_configured():
    client, repo = make_client(api_key="")
    assert client.post("/incidents", json=BODY, headers={"X-API-Key": ""}).status_code == 503
    assert repo.alerts == {}


def test_valid_detection_creates_alert_and_log(ctx):
    client, repo = ctx
    r = client.post("/incidents", json=BODY, headers=KEY)
    assert r.status_code == 201 and r.json()["duplicate"] is False
    a = repo.alerts[r.json()["id"]]
    assert a["type"] == "violence" and a["source"] == "camera" and a["status"] == "nouveau"
    assert a["score"] == 0.91 and a["cameraId"] == "cam-1" and a["windowsConfirmed"] == 3
    assert a["position"] == {"lat": 6.52, "lng": 3.37} and "userId" not in a and "experimental" not in a
    assert repo.logs[0]["kind"] == "detection" and repo.logs[0]["actor"] == "service-ia"


def test_theft_is_flagged_experimental(ctx):
    client, repo = ctx
    r = client.post("/incidents", json={**BODY, "type": "vol", "score": 0.6}, headers=KEY)
    assert repo.alerts[r.json()["id"]]["experimental"] is True


@pytest.mark.parametrize("change", [
    {"type": "sos"}, {"type": "autre"}, {"score": 1.5}, {"score": -0.1}, {"windowsConfirmed": 0},
    {"cameraId": "cam 1"}, {"cameraId": "../x"}, {"cameraId": ""}, {"description": ""}, {"description": "x" * 301},
    {"position": {"lat": 120, "lng": 0}}, {"status": "cloture"}, {"userId": "u1"}, {"assignedTo": "a"},
])
def test_invalid_or_forbidden_fields_are_rejected(ctx, change):
    client, repo = ctx
    assert client.post("/incidents", json={**BODY, **change}, headers=KEY).status_code == 422
    assert repo.alerts == {}


def test_position_is_required(ctx):
    client, _ = ctx
    body = {k: v for k, v in BODY.items() if k != "position"}
    assert client.post("/incidents", json=body, headers=KEY).status_code == 422


def test_same_camera_and_type_is_deduplicated(ctx):
    client, repo = ctx
    first = client.post("/incidents", json=BODY, headers=KEY)
    second = client.post("/incidents", json=BODY, headers=KEY)
    assert second.status_code == 200 and second.json() == {"id": first.json()["id"], "status": "nouveau", "duplicate": True}
    assert len(repo.alerts) == 1 and len(repo.logs) == 1


def test_other_camera_or_other_type_creates_a_new_alert(ctx):
    client, repo = ctx
    client.post("/incidents", json=BODY, headers=KEY)
    assert client.post("/incidents", json={**BODY, "cameraId": "cam-2"}, headers=KEY).status_code == 201
    assert client.post("/incidents", json={**BODY, "type": "chute"}, headers=KEY).status_code == 201
    assert len(repo.alerts) == 3


def test_admin_sees_the_detection_in_the_list(ctx):
    client, _ = ctx
    client.post("/incidents", json=BODY, headers=KEY)
    item = client.get("/incidents", headers=bearer("tok-admin")).json()[0]
    assert item["type"] == "violence" and item["score"] == 0.91 and item["cameraId"] == "cam-1"
    assert client.get("/incidents", headers=bearer("tok-user")).json() == []  # un utilisateur ne voit pas les caméras


NOW = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)


def test_event_time_keeps_plausible_values_and_corrects_the_rest():
    ok = NOW - timedelta(seconds=2)
    assert event_time(ok, NOW) == ok
    assert event_time(None, NOW) == NOW
    assert event_time(NOW + timedelta(minutes=5), NOW) == NOW  # futur : horloge fausse
    assert event_time(NOW - timedelta(hours=3), NOW) == NOW  # trop ancien
    assert event_time(datetime(2026, 11, 16, 11, 59, 58), NOW) == ok  # sans fuseau : lu comme UTC
