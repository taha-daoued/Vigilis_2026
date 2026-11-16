"""Initialisation unique de firebase-admin (vérification des jetons, Firestore, rôles)."""
import firebase_admin
from firebase_admin import credentials

from app.config import Settings


def init_firebase(settings: Settings) -> firebase_admin.App:
    """Crée l'application Firebase une seule fois. Le fichier de clé n'est jamais affiché ni loggé."""
    if firebase_admin._apps:
        return firebase_admin.get_app()
    options = {"projectId": settings.firebase_project_id}
    if settings.google_application_credentials:
        cred = credentials.Certificate(settings.google_application_credentials)
        return firebase_admin.initialize_app(cred, options)
    return firebase_admin.initialize_app(options=options)
