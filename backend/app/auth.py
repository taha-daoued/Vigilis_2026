"""Authentification : ID token Firebase (utilisateurs) et clé API (service IA).

Le navigateur envoie « Authorization: Bearer <ID token> ». Le serveur vérifie la signature
avec Firebase ; le rôle (user / admin) vient du custom claim « role » posé côté serveur.
Les jetons et les clés ne sont jamais écrits dans les logs.
"""
import hmac
from dataclasses import dataclass
from typing import Protocol

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


class TokenVerifier(Protocol):
    def verify(self, token: str) -> dict: ...


class FirebaseVerifier:
    """Vérifie un vrai ID token Firebase (nécessite l'accès réseau aux clés publiques de Google)."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def verify(self, token: str) -> dict:
        from firebase_admin import auth

        from app.firebase_app import init_firebase

        init_firebase(self.settings)  # paresseux : pas de Firebase au démarrage des tests
        return auth.verify_id_token(token)


@dataclass(frozen=True)
class CurrentUser:
    uid: str
    email: str | None
    role: str  # 'user' ou 'admin'


def get_verifier(settings: Settings = Depends(get_settings)) -> TokenVerifier:
    return FirebaseVerifier(settings)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    verifier: TokenVerifier = Depends(get_verifier),
) -> CurrentUser:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton manquant")
    try:
        claims = verifier.verify(creds.credentials)
    except Exception:  # signature invalide, jeton expiré, mauvais projet... : même réponse
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide") from None
    uid = claims.get("uid") or claims.get("user_id") or claims.get("sub")
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide")
    role = "admin" if claims.get("role") == "admin" else "user"  # toute autre valeur = user
    return CurrentUser(uid=uid, email=claims.get("email"), role=role)


def require_user(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    return user


def require_admin(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux administrateurs")
    return user


def require_ai_key(
    x_api_key: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    """Protège les routes appelées par le service IA (POST /incidents)."""
    if not settings.ai_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Clé du service IA non configurée")
    if x_api_key is None or not hmac.compare_digest(x_api_key, settings.ai_api_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Clé API invalide")
