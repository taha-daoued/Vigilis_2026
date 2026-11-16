from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth import get_verifier
from app.config import Settings, get_settings
from app.incidents import apply_status
from app.main import create_app
from app.repository import InMemoryRepository
from app.sos import get_repository
from tests.conftest import FakeVerifier, bearer

T0 = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)


def alert(uid, minutes=0, **extra):
    t = T0 + timedelta(minutes=minutes)
    return {"type": "sos", "status": "nouveau", "createdAt": t, "receivedAt": t, "position": None,
            "source": "app", "userId": uid, "imageUrl": "svg:sos:0", "description": "x", "windowsConfirmed": 0, **extra}


@pytest.fixture
def ctx():
    repo = InMemoryRepository()
    repo.alerts.update({"a-u1": alert("u1", 1), "a-u2": alert("u2", 2), "a-cam": alert(None, 3, type="violence", source="camera", score=0.8)})
    app = create_app()
    app.dependency_overrides[get_verifier] = lambda: FakeVerifier()
    app.dependency_overrides[get_settings] = lambda: Settings(ai_api_key="x")
    app.dependency_overrides[get_repository] = lambda: repo
    return TestClient(app), repo


def test_list_requires_a_token(ctx):
    assert ctx[0].get("/incidents").status_code == 401


def test_admin_sees_everything_most_recent_first(ctx):
    r = ctx[0].get("/incidents", headers=bearer("tok-admin"))
    assert [i["id"] for i in r.json()] == ["a-cam", "a-u2", "a-u1"]


def test_user_sees_only_own_incidents(ctx):
    r = ctx[0].get("/incidents", headers=bearer("tok-user"))
    assert [i["id"] for i in r.json()] == ["a-u1"]


def test_dates_are_iso_and_empty_fields_dropped_but_position_kept(ctx):
    item = ctx[0].get("/incidents", headers=bearer("tok-user")).json()[0]
    assert item["receivedAt"] == "2026-11-16T12:01:00Z"
    assert item["position"] is None and "assignedTo" not in item and "score" not in item


def test_user_cannot_change_status(ctx):
    r = ctx[0].patch("/incidents/a-u1", json={"status": "en_cours"}, headers=bearer("tok-user"))
    assert r.status_code == 403


def test_admin_takes_then_closes_with_audit_trail(ctx):
    client, repo = ctx
    r = client.patch("/incidents/a-u1", json={"status": "en_cours"}, headers=bearer("tok-admin"))
    assert r.status_code == 200 and r.json()["status"] == "en_cours" and r.json()["assignedTo"] == "admin@test"
    r = client.patch("/incidents/a-u1", json={"status": "cloture", "resolution": "fausse_alerte"}, headers=bearer("tok-admin"))
    assert r.json()["status"] == "cloture" and r.json()["resolution"] == "fausse_alerte" and "closedAt" in r.json()
    assert [l["kind"] for l in repo.logs] == ["prise_en_charge", "cloture", "resolution"]
    assert all(l["incidentId"] == "a-u1" and l["actor"] == "admin@test" for l in repo.logs)


def test_closing_requires_a_resolution(ctx):
    client, repo = ctx
    r = client.patch("/incidents/a-u1", json={"status": "cloture"}, headers=bearer("tok-admin"))
    assert r.status_code == 422 and repo.alerts["a-u1"]["status"] == "nouveau" and repo.logs == []


def test_unknown_incident_and_invalid_payload(ctx):
    client, _ = ctx
    assert client.patch("/incidents/inconnu", json={"status": "en_cours"}, headers=bearer("tok-admin")).status_code == 404
    assert client.patch("/incidents/a-u1", json={"status": "n-importe-quoi"}, headers=bearer("tok-admin")).status_code == 422
    assert client.patch("/incidents/a-u1", json={"status": "en_cours", "userId": "x"}, headers=bearer("tok-admin")).status_code == 422


def test_reopening_clears_assignment_and_resolution():
    a = alert("u1", assignedTo="adm", takenAt=T0, closedAt=T0, resolution="confirme", status="cloture")
    fields, logs = apply_status(a, "nouveau", None, "adm", T0)
    assert fields["assignedTo"] is None and fields["resolution"] is None and logs[0]["kind"] == "reouverture"


def test_logs_are_admin_only(ctx):
    client, _ = ctx
    assert client.get("/logs", headers=bearer("tok-user")).status_code == 403
    client.patch("/incidents/a-u1", json={"status": "en_cours"}, headers=bearer("tok-admin"))
    r = client.get("/logs", headers=bearer("tok-admin"))
    assert r.status_code == 200 and r.json()[0]["kind"] == "prise_en_charge" and r.json()[0]["at"].endswith("Z")
