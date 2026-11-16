"""Lecture des incidents (admin : tous, utilisateur : les siens) et changement de statut (admin)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth import CurrentUser, require_admin, require_user
from app.models import StatusUpdate
from app.repository import AlertRepository
from app.sos import get_repository

router = APIRouter()
RESOLUTION_LABEL = {"confirme": "Confirmé", "fausse_alerte": "Fausse alerte"}


def serialize(doc: dict) -> dict:
    """Dates en ISO 8601 UTC ; champs vides retirés (sauf position, null = « sans position »)."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            v = v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        if v is None and k != "position":
            continue
        out[k] = v
    return out


def apply_status(alert: dict, status: str, resolution: str | None, actor: str, now: datetime) -> tuple[dict, list[dict]]:
    """Calcule les champs à modifier et les lignes de journal. Mêmes règles que le mode démo."""
    if status == "cloture" and not resolution:
        raise ValueError("Résolution obligatoire à la clôture (confirmé ou fausse alerte).")
    log = lambda kind, action: {"kind": kind, "action": action, "actor": actor, "at": now}  # noqa: E731
    if status == "nouveau":
        fields = {"status": status, "assignedTo": None, "takenAt": None, "closedAt": None, "resolution": None}
        return fields, [log("reouverture", "Rouvert (remis à nouveau)")]
    if status == "en_cours":
        fields = {"status": status, "assignedTo": actor, "takenAt": alert.get("takenAt") or now, "closedAt": None, "resolution": None}
        return fields, [log("prise_en_charge", "Passé en cours (assigné)")]
    fields = {
        "status": status, "assignedTo": alert.get("assignedTo") or actor, "takenAt": alert.get("takenAt") or now,
        "closedAt": now, "resolution": resolution,
    }
    return fields, [log("cloture", "Clôturé"), log("resolution", f"Résolution : {RESOLUTION_LABEL[resolution]}")]


@router.get("/incidents")
def list_incidents(user: CurrentUser = Depends(require_user), repo: AlertRepository = Depends(get_repository)):
    rows = repo.list_alerts(None if user.role == "admin" else user.uid)
    return [serialize(r) for r in rows]


@router.patch("/incidents/{incident_id}")
def update_status(
    incident_id: str,
    body: StatusUpdate,
    admin: CurrentUser = Depends(require_admin),
    repo: AlertRepository = Depends(get_repository),
):
    alert = repo.get_alert(incident_id)
    if alert is None:
        raise HTTPException(404, "Incident introuvable")
    actor = admin.email or admin.uid
    try:
        fields, logs = apply_status(alert, body.status, body.resolution, actor, datetime.now(timezone.utc))
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    repo.update_alert(incident_id, fields, logs)
    return serialize({**alert, **fields})


@router.get("/logs")
def list_logs(_: CurrentUser = Depends(require_admin), repo: AlertRepository = Depends(get_repository)):
    return [serialize(r) for r in repo.list_logs()]
