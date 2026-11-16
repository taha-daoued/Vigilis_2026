"""Envoi des détections au backend (POST /incidents) sans jamais bloquer la détection.

Un fil d'arrière-plan poste les alertes. En cas d'échec réseau ou d'erreur serveur (5xx), il
réessaie quelques fois ; une erreur du client (401, 422...) n'est pas rejouée. La clé API et la
position ne sont jamais écrites dans les logs.
"""
import logging
import queue
import threading
import time
from datetime import datetime, timedelta, timezone

import httpx

from vigilis_ai.config import Config
from vigilis_ai.fall import FallEvent

log = logging.getLogger("vigilis_ai.client")
RETRY_STATUS = {408, 429}  # en plus des 5xx


def build_fall_body(event: FallEvent, cfg: Config, now: datetime | None = None) -> dict:
    """Corps de POST /incidents pour une chute. L'heure de l'événement est le début de la chute."""
    now = now or datetime.now(timezone.utc)
    fell_at = now - timedelta(seconds=event.immobile_s)
    return {
        "type": "chute",
        "score": event.score,
        "position": {"lat": cfg.camera_lat, "lng": cfg.camera_lng},
        "cameraId": cfg.camera_id,
        "description": f"Chute détectée par les règles de pose : personne allongée et immobile depuis {int(event.immobile_s)} s.",
        "windowsConfirmed": max(1, event.windows_confirmed),
        "detectedAt": fell_at.isoformat().replace("+00:00", "Z"),
    }


class Sender:
    def __init__(self, cfg: Config, transport: httpx.BaseTransport | None = None, retries: int = 3,
                 backoff_s: tuple[float, ...] = (1.0, 2.0, 4.0), sleep=time.sleep, max_queue: int = 50):
        self.cfg, self.retries, self.backoff_s, self._sleep = cfg, retries, backoff_s, sleep
        self._http = httpx.Client(transport=transport, timeout=5.0, headers={"X-API-Key": cfg.api_key})
        self._queue: queue.Queue = queue.Queue(maxsize=max_queue)
        self.sent = 0
        self.failed = 0
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def submit(self, body: dict) -> bool:
        """Met l'alerte en file et rend la main tout de suite. False si la file est pleine."""
        try:
            self._queue.put_nowait(body)
            return True
        except queue.Full:
            self.failed += 1
            log.error("file d'envoi pleine : alerte abandonnée")
            return False

    def _run(self) -> None:
        while True:
            body = self._queue.get()
            if body is None:
                return
            self._post_with_retries(body)

    def _post_with_retries(self, body: dict) -> None:
        for attempt in range(self.retries + 1):
            try:
                r = self._http.post(f"{self.cfg.api_url}/incidents", json=body)
            except httpx.HTTPError:
                r = None  # réseau coupé, délai dépassé...
            if r is not None and r.status_code < 300:
                self.sent += 1
                log.info("alerte envoyée (%s, doublon=%s)", body["type"], r.json().get("duplicate"))
                return
            if r is not None and r.status_code < 500 and r.status_code not in RETRY_STATUS:
                self.failed += 1
                log.error("alerte refusée par le backend (code %s) : pas de nouvel essai", r.status_code)
                return
            if attempt < self.retries:
                self._sleep(self.backoff_s[min(attempt, len(self.backoff_s) - 1)])
        self.failed += 1
        log.error("alerte non envoyée après %s essais", self.retries + 1)

    def close(self, timeout: float = 15.0) -> None:
        """Attend la fin des envois en cours (au plus `timeout` secondes) puis arrête le fil."""
        try:
            self._queue.put(None, timeout=1.0)
        except queue.Full:
            pass  # le fil est déjà occupé : il s'arrêtera avec le programme (fil démon)
        self._thread.join(timeout)
        self._http.close()
