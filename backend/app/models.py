"""Modèles des requêtes. Le client ne peut envoyer QUE ce qui est listé : le reste est refusé."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LatLng(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)


class SosRequest(BaseModel):
    # extra=forbid : impossible d'imposer userId, status, createdAt... depuis le navigateur
    model_config = ConfigDict(extra="forbid")
    position: LatLng | None = None  # None = l'utilisateur a révoqué son GPS (« sans position »)
    position_source: str = Field(default="GPS", alias="positionSource", min_length=1, max_length=40)


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["nouveau", "en_cours", "cloture"]
    resolution: Literal["confirme", "fausse_alerte"] | None = None


class DetectionRequest(BaseModel):
    """Corps envoyé par le service IA (jamais par un navigateur) : seulement ce que la caméra sait."""
    model_config = ConfigDict(extra="forbid")
    type: Literal["violence", "chute", "vol"]  # le SOS ne passe pas par ici
    score: float = Field(ge=0, le=1, allow_inf_nan=False)
    position: LatLng  # position de la caméra
    camera_id: str = Field(alias="cameraId", min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    description: str = Field(min_length=1, max_length=300)
    windows_confirmed: int = Field(alias="windowsConfirmed", ge=1, le=1000)
    detected_at: datetime | None = Field(default=None, alias="detectedAt")  # heure de l'événement filmé
