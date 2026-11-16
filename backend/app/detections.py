"""POST /incidents : réservé au service IA (clé API). Le navigateur n'a pas le droit de créer une détection."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.auth import require_ai_key
from app.models import DetectionRequest
from app.repository import AlertRepository
from app.sos import get_repository

router = APIRouter()
DEDUP_WINDOW = timedelta(seconds=30)  # même caméra, même type : une seule alerte ouverte
MAX_EVENT_AGE = timedelta(minutes=10)  # une heure d'événement plus ancienne est ignorée (horloge fausse ?)
MAX_FUTURE = timedelta(seconds=5)


def event_time(detected_at: datetime | None, now: datetime) -> datetime:
    """Heure de l'événement : celle du service IA si elle est plausible, sinon l'heure du serveur."""
    if detected_at is None:
        return now
    if detected_at.tzinfo is None:
        detected_at = detected_at.replace(tzinfo=timezone.utc)
    if detected_at > now + MAX_FUTURE or detected_at < now - MAX_EVENT_AGE:
        return now
    return min(detected_at, now)


@router.post("/incidents", dependencies=[Depends(require_ai_key)])
def create_detection(body: DetectionRequest, repo: AlertRepository = Depends(get_repository)):
    now = datetime.now(timezone.utc)
    existing = repo.find_recent_detection(body.camera_id, body.type, now - DEDUP_WINDOW)
    if existing:
        return JSONResponse({"id": existing["id"], "status": "nouveau", "duplicate": True})

    alert = {
        "type": body.type,
        "status": "nouveau",
        "score": body.score,
        "createdAt": event_time(body.detected_at, now),
        "receivedAt": now,
        "position": body.position.model_dump(),
        "source": "camera",
        "cameraId": body.camera_id,
        "imageUrl": f"svg:{body.type}:0",  # pas de vraie image tant que le stockage n'est pas décidé
        "description": body.description,
        "windowsConfirmed": body.windows_confirmed,
    }
    if body.type == "vol":
        alert["experimental"] = True  # module facultatif, jamais présenté comme fiable
    log = {"kind": "detection", "action": f"Détection {body.type} (score {body.score:.2f})", "actor": "service-ia", "at": now}
    alert_id = repo.create_alert(alert, log)
    return JSONResponse({"id": alert_id, "status": "nouveau", "duplicate": False}, status_code=status.HTTP_201_CREATED)
