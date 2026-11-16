"""POST /sos : voie directe, sans IA. Le serveur décide de tout sauf de la position."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.auth import CurrentUser, require_user
from app.config import Settings, get_settings
from app.models import SosRequest
from app.repository import AlertRepository, FirestoreRepository

router = APIRouter()
DEDUP_WINDOW = timedelta(seconds=60)  # un double appui n'envoie pas deux alertes


def get_repository(settings: Settings = Depends(get_settings)) -> AlertRepository:
    return FirestoreRepository(settings)


def build_description(body: SosRequest) -> str:
    if body.position is None:
        return "Alerte SOS envoyée sans position (l'utilisateur a désactivé le partage GPS)."
    return f"Alerte SOS envoyée depuis l'application (position : {body.position_source})."


@router.post("/sos")
def send_sos(
    body: SosRequest,
    user: CurrentUser = Depends(require_user),
    repo: AlertRepository = Depends(get_repository),
):
    now = datetime.now(timezone.utc)
    existing = repo.find_recent_new_sos(user.uid, now - DEDUP_WINDOW)
    if existing:  # même SOS déjà en attente : on renvoie le même, on n'en crée pas un autre
        return JSONResponse({"id": existing["id"], "status": "nouveau", "duplicate": True})

    alert = {
        "type": "sos",
        "status": "nouveau",
        "createdAt": now,
        "receivedAt": now,
        "position": body.position.model_dump() if body.position else None,
        "source": "app",
        "userId": user.uid,  # toujours celui du jeton, jamais celui envoyé par le client
        "imageUrl": "svg:sos:0",
        "description": build_description(body),
        "windowsConfirmed": 0,
    }
    log = {"kind": "sos", "action": "SOS reçu", "actor": user.uid, "at": now}
    alert_id = repo.create_alert(alert, log)
    return JSONResponse({"id": alert_id, "status": "nouveau", "duplicate": False}, status_code=status.HTTP_201_CREATED)
