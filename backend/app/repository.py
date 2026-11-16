"""Accès aux alertes. Deux implémentations : Firestore (réel) et mémoire (tests)."""
import uuid
from datetime import datetime
from typing import Protocol


class AlertRepository(Protocol):
    def find_recent_new_sos(self, uid: str, since: datetime) -> dict | None: ...
    def find_recent_detection(self, camera_id: str, alert_type: str, since: datetime) -> dict | None: ...
    def create_alert(self, alert: dict, log: dict) -> str: ...
    def list_alerts(self, uid: str | None, limit: int = 200) -> list[dict]: ...
    def get_alert(self, alert_id: str) -> dict | None: ...
    def update_alert(self, alert_id: str, fields: dict, logs: list[dict]) -> None: ...
    def list_logs(self, limit: int = 500) -> list[dict]: ...


class InMemoryRepository:
    def __init__(self):
        self.alerts: dict[str, dict] = {}
        self.logs: list[dict] = []

    def find_recent_new_sos(self, uid: str, since: datetime) -> dict | None:
        for aid, a in self.alerts.items():
            if a["userId"] == uid and a["type"] == "sos" and a["status"] == "nouveau" and a["receivedAt"] >= since:
                return {"id": aid, **a}
        return None

    def create_alert(self, alert: dict, log: dict) -> str:
        aid = uuid.uuid4().hex
        self.alerts[aid] = alert
        self.logs.append({**log, "incidentId": aid})
        return aid


    def find_recent_detection(self, camera_id: str, alert_type: str, since: datetime) -> dict | None:
        for aid, a in self.alerts.items():
            if a.get("cameraId") == camera_id and a["type"] == alert_type and a["status"] == "nouveau" and a["receivedAt"] >= since:
                return {"id": aid, **a}
        return None

    def list_alerts(self, uid: str | None, limit: int = 200) -> list[dict]:
        rows = [{"id": i, **a} for i, a in self.alerts.items() if uid is None or a.get("userId") == uid]
        return sorted(rows, key=lambda a: a["receivedAt"], reverse=True)[:limit]

    def get_alert(self, alert_id: str) -> dict | None:
        a = self.alerts.get(alert_id)
        return {"id": alert_id, **a} if a else None

    def update_alert(self, alert_id: str, fields: dict, logs: list[dict]) -> None:
        self.alerts[alert_id].update(fields)
        self.logs.extend({**l, "incidentId": alert_id} for l in logs)

    def list_logs(self, limit: int = 500) -> list[dict]:
        return sorted(({"id": str(i), **l} for i, l in enumerate(self.logs)), key=lambda l: l["at"], reverse=True)[:limit]


class FirestoreRepository:
    """Écrit avec firebase-admin : contourne les règles Firestore, d'où la vérification du jeton en amont."""

    def __init__(self, settings):
        self.settings = settings

    def _db(self):
        from firebase_admin import firestore

        from app.firebase_app import init_firebase

        init_firebase(self.settings)
        return firestore.client()

    def find_recent_new_sos(self, uid: str, since: datetime) -> dict | None:
        # Filtres d'égalité seulement : pas d'index composite à créer. L'heure est filtrée ici.
        from google.cloud.firestore_v1.base_query import FieldFilter

        q = self._db().collection("alerts")
        for field, value in (("userId", uid), ("type", "sos"), ("status", "nouveau")):
            q = q.where(filter=FieldFilter(field, "==", value))
        q = q.limit(20)
        for doc in q.stream():
            data = doc.to_dict()
            if data["receivedAt"] >= since:
                return {"id": doc.id, **data}
        return None

    def find_recent_detection(self, camera_id: str, alert_type: str, since: datetime) -> dict | None:
        from google.cloud.firestore_v1.base_query import FieldFilter

        q = self._db().collection("alerts")
        for field, value in (("cameraId", camera_id), ("type", alert_type), ("status", "nouveau")):
            q = q.where(filter=FieldFilter(field, "==", value))
        for doc in q.limit(20).stream():
            data = doc.to_dict()
            if data["receivedAt"] >= since:
                return {"id": doc.id, **data}
        return None

    def create_alert(self, alert: dict, log: dict) -> str:
        db = self._db()
        alert_ref = db.collection("alerts").document()
        batch = db.batch()  # alerte + journal écrits ensemble ou pas du tout
        batch.set(alert_ref, alert)
        batch.set(db.collection("alert_logs").document(), {**log, "incidentId": alert_ref.id})
        batch.commit()
        return alert_ref.id

    def list_alerts(self, uid: str | None, limit: int = 200) -> list[dict]:
        from google.cloud.firestore_v1.base_query import FieldFilter

        col = self._db().collection("alerts")
        if uid is None:  # admin : tout, du plus récent au plus ancien (index simple automatique)
            docs = col.order_by("receivedAt", direction="DESCENDING").limit(limit).stream()
            return [{"id": d.id, **d.to_dict()} for d in docs]
        docs = col.where(filter=FieldFilter("userId", "==", uid)).limit(limit).stream()  # tri en Python : pas d'index composite
        rows = [{"id": d.id, **d.to_dict()} for d in docs]
        return sorted(rows, key=lambda a: a["receivedAt"], reverse=True)

    def get_alert(self, alert_id: str) -> dict | None:
        doc = self._db().collection("alerts").document(alert_id).get()
        return {"id": doc.id, **doc.to_dict()} if doc.exists else None

    def update_alert(self, alert_id: str, fields: dict, logs: list[dict]) -> None:
        db = self._db()
        batch = db.batch()
        batch.update(db.collection("alerts").document(alert_id), fields)
        for l in logs:
            batch.set(db.collection("alert_logs").document(), {**l, "incidentId": alert_id})
        batch.commit()

    def list_logs(self, limit: int = 500) -> list[dict]:
        docs = self._db().collection("alert_logs").order_by("at", direction="DESCENDING").limit(limit).stream()
        return [{"id": d.id, **d.to_dict()} for d in docs]
