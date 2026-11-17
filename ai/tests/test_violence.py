"""Décision de violence (fenêtres consécutives, cooldown) et moniteur à fenêtre glissante, avec un faux modèle."""
import time

import numpy as np

from vigilis_ai.client import build_violence_body
from vigilis_ai.config import Config
from vigilis_ai.violence import N_FRAMES, ViolenceDecision, ViolenceMonitor, ViolenceParams


def test_un_pic_isole_ne_declenche_pas():
    d = ViolenceDecision(ViolenceParams(consecutive=2))
    assert d.update(0.95, 0) is None
    assert d.update(0.10, 5) is None          # la série est coupée
    assert d.update(0.95, 10) is None         # repart de zéro


def test_deux_fenetres_de_suite_declenchent_avec_le_score_moyen():
    d = ViolenceDecision(ViolenceParams(consecutive=2))
    assert d.update(0.8, 0) is None
    ev = d.update(0.6, 5)
    assert ev is not None and ev.score == 0.7 and ev.windows_confirmed == 2


def test_seuil_exact_compte_comme_violence():
    d = ViolenceDecision(ViolenceParams(threshold=0.5, consecutive=1))
    assert d.update(0.5, 0) is not None


def test_cooldown_bloque_la_seconde_alerte_puis_la_libere():
    d = ViolenceDecision(ViolenceParams(consecutive=1, cooldown_s=60))
    assert d.update(0.9, 0) is not None
    assert d.update(0.9, 10) is None           # dans le délai
    assert d.update(0.9, 61) is not None       # après le délai


def _feed(mon, seconds, prob_holder, fps=10):
    """Envoie des images noires sur `seconds` secondes simulées ; renvoie les alertes."""
    events, t = [], 0.0
    frame = np.zeros((120, 160, 3), np.uint8)
    for _ in range(int(seconds * fps)):
        t += 1 / fps
        mon.push(frame, t)
        events += mon.poll(t)
        time.sleep(0.002)                      # laisse le fil du modèle travailler
    return events


def test_moniteur_envoie_16_images_et_alerte_apres_deux_fenetres():
    seen = []

    def fake(frames):
        seen.append(len(frames))
        assert frames[0].shape == (224, 224, 3)
        return 0.9

    mon = ViolenceMonitor(fake, ViolenceParams(window_s=2.0, consecutive=2, cooldown_s=1000))
    events = _feed(mon, 12, None)
    mon.close()
    assert seen and all(n == N_FRAMES for n in seen)
    assert len(events) == 1 and events[0].windows_confirmed == 2 and mon.last_prob == 0.9


def test_moniteur_sans_violence_ne_declenche_rien():
    mon = ViolenceMonitor(lambda frames: 0.05, ViolenceParams(window_s=2.0))
    assert _feed(mon, 8, None) == []
    mon.close()
    assert mon.windows_done >= 1


def test_un_echec_du_modele_ne_plante_pas_la_camera():
    def boom(frames):
        raise RuntimeError("modèle indisponible")

    mon = ViolenceMonitor(boom, ViolenceParams(window_s=2.0))
    assert _feed(mon, 6, None) == []
    mon.close()


def test_corps_de_la_requete_respecte_le_contrat_backend():
    cfg = Config(api_url="http://x", api_key="k", camera_id="cam-1", camera_lat=6.5, camera_lng=3.4)
    from vigilis_ai.violence import ViolenceEvent
    body = build_violence_body(ViolenceEvent(0.83, 2), cfg)
    assert body["type"] == "violence" and body["score"] == 0.83 and body["windowsConfirmed"] == 2
    assert body["cameraId"] == "cam-1" and set(body) <= {"type", "score", "position", "cameraId", "description",
                                                           "windowsConfirmed", "detectedAt"}
    assert len(body["description"]) <= 300
