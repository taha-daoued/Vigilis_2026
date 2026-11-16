"""Point d'entrée FastAPI : liaison entre le service IA, Firestore et le dashboard."""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import CurrentUser, require_user
from app.config import get_settings
from app.sos import router as sos_router


def create_app() -> FastAPI:
    app = FastAPI(title="Vigilis API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().origins,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    )

    @app.get("/health")
    def health():
        # Aucune donnée sensible : sert au tableau de bord « Santé » et aux tests.
        return {"status": "ok"}

    @app.get("/me")
    def me(user: CurrentUser = Depends(require_user)):
        """Renvoie l'identité vérifiée : le frontend s'en sert pour connaître son rôle."""
        return {"uid": user.uid, "email": user.email, "role": user.role}

    app.include_router(sos_router)
    return app


app = create_app()
