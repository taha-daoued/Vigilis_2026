"""Tests de la configuration et de l'envoi, avec un faux serveur (aucun réseau, aucune clé réelle)."""
import json
import logging
from datetime import datetime, timezone

import httpx
import pytest

from vigilis_ai.client import Sender, build_fall_body
from vigilis_ai.config import Config, ConfigError, load_config
from vigilis_ai.fall import FallEvent

CFG = Config("http://api.test", "cle-secrete-de-test", "cam-1", 6.5244, 3.3792)
EVENT = FallEvent(track_id=1, t=100.0, score=0.9, windows_confirmed=10, immobile_s=10.0)
NOW = datetime(2026, 11, 16, 12, 0, 0, tzinfo=timezone.utc)
ALLOWED = {"type", "score", "position", "cameraId", "description", "windowsConfirmed", "detectedAt"}  # contrat du backend


def sender(handler, **kw):
    return Sender(CFG, transport=httpx.MockTransport(handler), sleep=lambda s: None, **kw)


def test_body_matches_the_backend_contract():
    b = build_fall_body(EVENT, CFG, NOW)
    assert set(b) == ALLOWED and b["type"] == "chute" and b["cameraId"] == "cam-1"
    assert b["position"] == {"lat": 6.5244, "lng": 3.3792} and 0 <= b["score"] <= 1 and b["windowsConfirmed"] == 10
    assert b["detectedAt"] == "2026-11-16T11:59:50Z"  # début de la chute = maintenant - immobilité
    assert 1 <= len(b["description"]) <= 300


def test_successful_send_uses_the_api_key_and_the_right_route():
    seen = []

    def handler(req: httpx.Request):
        seen.append(req)
        return httpx.Response(201, json={"id": "x", "duplicate": False})

    s = sender(handler)
    s.submit(build_fall_body(EVENT, CFG, NOW))
    s.close()
    assert s.sent == 1 and s.failed == 0 and len(seen) == 1
    assert seen[0].method == "POST" and str(seen[0].url) == "http://api.test/incidents"
    assert seen[0].headers["x-api-key"] == "cle-secrete-de-test"
    assert json.loads(seen[0].content)["type"] == "chute"


def test_server_errors_are_retried_then_succeed():
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(503) if len(calls) < 3 else httpx.Response(201, json={"duplicate": False})

    s = sender(handler)
    s.submit(build_fall_body(EVENT, CFG, NOW))
    s.close()
    assert len(calls) == 3 and s.sent == 1 and s.failed == 0


def test_network_errors_are_retried_then_given_up():
    calls = []

    def handler(req):
        calls.append(1)
        raise httpx.ConnectError("coupé")

    s = sender(handler, retries=2)
    s.submit(build_fall_body(EVENT, CFG, NOW))
    s.close()
    assert len(calls) == 3 and s.sent == 0 and s.failed == 1


@pytest.mark.parametrize("code", [401, 403, 422])  # clé fausse, interdit, corps refusé : réessayer ne servirait à rien
def test_client_errors_are_not_retried(code):
    calls = []

    def handler(req):
        calls.append(1)
        return httpx.Response(code, json={"detail": "non"})

    s = sender(handler)
    s.submit(build_fall_body(EVENT, CFG, NOW))
    s.close()
    assert len(calls) == 1 and s.failed == 1


def test_duplicate_answer_counts_as_success():
    s = sender(lambda req: httpx.Response(200, json={"id": "x", "duplicate": True}))
    s.submit(build_fall_body(EVENT, CFG, NOW))
    s.close()
    assert s.sent == 1


def test_submit_does_not_block_and_a_full_queue_drops_the_alert():
    import threading

    gate = threading.Event()

    def handler(req):
        gate.wait(5)  # le serveur « traîne » : l'envoi ne doit pas bloquer l'appelant
        return httpx.Response(201, json={"duplicate": False})

    s = sender(handler, max_queue=1)
    results = [s.submit(build_fall_body(EVENT, CFG, NOW)) for _ in range(4)]  # rend la main tout de suite
    assert results.count(False) >= 1 and s.failed >= 1
    gate.set()
    s.close()


def test_secrets_and_position_never_reach_the_logs(caplog):
    caplog.set_level(logging.DEBUG)
    for handler in (lambda r: httpx.Response(401), lambda r: httpx.Response(201, json={"duplicate": False})):
        s = sender(handler)
        s.submit(build_fall_body(EVENT, CFG, NOW))
        s.close()
    text = caplog.text
    assert "cle-secrete-de-test" not in text and "6.5244" not in text and "3.3792" not in text


def test_config_requires_an_api_key(tmp_path):
    with pytest.raises(ConfigError):
        load_config(tmp_path / "absent.env", environ={})


def test_config_reads_file_and_environment_wins(tmp_path):
    env = tmp_path / ".env"
    env.write_text("VIGILIS_API_KEY=depuis-fichier\nCAMERA_ID=cam-9\nVIGILIS_API_URL=http://x:1/\n", encoding="utf-8")
    cfg = load_config(env, environ={})
    assert (cfg.api_key, cfg.camera_id, cfg.api_url) == ("depuis-fichier", "cam-9", "http://x:1")
    assert load_config(env, environ={"VIGILIS_API_KEY": "depuis-env"}).api_key == "depuis-env"


@pytest.mark.parametrize("bad", [{"CAMERA_ID": "cam 1"}, {"CAMERA_ID": "../x"}, {"CAMERA_LAT": "abc"}, {"CAMERA_LAT": "95"}, {"CAMERA_LNG": "-181"}])
def test_config_rejects_invalid_values(tmp_path, bad):
    with pytest.raises(ConfigError):
        load_config(tmp_path / "absent.env", environ={"VIGILIS_API_KEY": "k", **bad})
