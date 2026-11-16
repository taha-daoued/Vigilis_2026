"""Modèles des requêtes. Le client ne peut envoyer QUE ce qui est listé : le reste est refusé."""
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
