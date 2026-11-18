"""Configuration du service IA : ai/.env et variables d'environnement (jamais de secret dans le code)."""
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values

DEFAULT_ENV = Path(__file__).resolve().parent.parent / ".env"  # ai/.env, quel que soit le dossier de lancement


class ConfigError(Exception):
    pass


@dataclass(frozen=True)
class Config:
    api_url: str
    api_key: str
    camera_id: str
    camera_lat: float
    camera_lng: float


def load_config(env_path: Path | None = None, environ: dict | None = None) -> Config:
    """Lit ai/.env puis les variables d'environnement (qui l'emportent). Échoue avec un message clair."""
    values = {**dotenv_values(env_path or DEFAULT_ENV), **(os.environ if environ is None else environ)}
    api_key = (values.get("VIGILIS_API_KEY") or "").strip()
    if not api_key:
        raise ConfigError("VIGILIS_API_KEY manquante : copiez ai/.env.example en ai/.env et renseignez la clé du backend.")
    camera_id = (values.get("CAMERA_ID") or "cam-webcam-1").strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", camera_id):
        raise ConfigError("CAMERA_ID invalide : lettres, chiffres, _ . - seulement (64 caractères maximum).")
    try:
        lat, lng = float(values.get("CAMERA_LAT") or 34.7406), float(values.get("CAMERA_LNG") or 10.7603)
    except ValueError:
        raise ConfigError("CAMERA_LAT et CAMERA_LNG doivent être des nombres.") from None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ConfigError("CAMERA_LAT doit être entre -90 et 90, CAMERA_LNG entre -180 et 180.")
    return Config((values.get("VIGILIS_API_URL") or "http://localhost:8000").rstrip("/"), api_key, camera_id, lat, lng)
