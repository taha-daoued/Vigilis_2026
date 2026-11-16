"""Outils de test : faux vérificateur de jetons (aucun appel réseau, aucun vrai jeton Firebase)."""
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient

from app.auth import CurrentUser, get_verifier, require_admin, require_ai_key
from app.config import Settings, get_settings
from app.main import create_app

TOKENS = {
    "tok-user": {"uid": "u1", "email": "user@test", "role": "user"},
    "tok-admin": {"uid": "a1", "email": "admin@test", "role": "admin"},
    "tok-sans-role": {"uid": "u2", "email": "x@test"},
    "tok-role-bizarre": {"uid": "u3", "role": "superadmin"},
    "tok-sans-uid": {"email": "y@test"},
}


class FakeVerifier:
    def verify(self, token: str) -> dict:
        if token not in TOKENS:
            raise ValueError("jeton invalide")
        return TOKENS[token]


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_verifier] = lambda: FakeVerifier()
    app.dependency_overrides[get_settings] = lambda: Settings(ai_api_key="cle-de-test", allowed_origins="http://localhost:5173")

    @app.get("/test/admin")
    def admin_only(user: CurrentUser = Depends(require_admin)):
        return {"uid": user.uid}

    @app.get("/test/ai", dependencies=[Depends(require_ai_key)])
    def ai_only():
        return {"ok": True}

    return TestClient(app)


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
