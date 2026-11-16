"""Configuration lue dans l'environnement ou dans backend/.env (jamais de secret dans le code)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # backend/.env, quel que soit le dossier depuis lequel le serveur est lancé
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parent.parent / ".env", extra="ignore")

    firebase_project_id: str = "vigilis-2026"
    # Origines du frontend autorisées par CORS, séparées par des virgules
    allowed_origins: str = "http://localhost:5173"
    # Clé partagée avec le service IA. Vide = les routes du service IA sont désactivées.
    ai_api_key: str = ""
    # Chemin du fichier de compte de service (hors du dépôt). Vide = identifiants par défaut de Google.
    google_application_credentials: str = ""

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
