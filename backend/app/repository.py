"""Accès aux alertes. Deux implémentations : Firestore (réel) et mémoire (tests)."""
import uuid
from datetime import datetime
from typing import Protocol


class AlertRepository(Protocol):
    def find_recent_new_sos(self, uid: str, since: datetime) -> dict | None: ...
    def create_alert(self, alert: dict, log: dict) -> str: ...


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

    def create_alert(self, alert: dict, log: dict) -> str:
        db = self._db()
        alert_ref = db.collection("alerts").document()
        batch = db.batch()  # alerte + journal écrits ensemble ou pas du tout
        batch.set(alert_ref, alert)
        batch.set(db.collection("alert_logs").document(), {**log, "incidentId": alert_ref.id})
        batch.commit()
        return alert_ref.id
