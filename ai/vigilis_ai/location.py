"""Position de la caméra lue sur le service de localisation de Windows (option CAMERA_LOCATION=auto).

Le PC n'a pas de GPS : Windows estime la position avec les réseaux Wi-Fi proches (précision typique : 20 m à quelques
centaines de mètres). Rien n'est envoyé par ce code à un autre service que le backend Vigilis (la position est jointe
aux alertes). Les coordonnées ne sont jamais écrites dans les logs. Si la localisation est désactivée, trop imprécise ou
indisponible, on garde les coordonnées fixes de ai/.env.
Une caméra fixe a normalement une position fixe : « auto » sert aux essais avec le PC portable.
"""
import dataclasses
import subprocess
import sys
from typing import Callable

from vigilis_ai.config import Config

MAX_ACCURACY_M = 2000.0  # au-delà, l'estimation (souvent par adresse IP) est trop grossière pour un incident

_SCRIPT = (
    "Add-Type -AssemblyName System.Device;"
    "$w = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::High);"
    "[void]$w.TryStart($false, [TimeSpan]::FromSeconds(5)); $t = 0;"
    "while ($w.Position.Location.IsUnknown -and $t -lt 25) { Start-Sleep 1; $t++ };"
    "$c = $w.Position.Location;"
    "if ($c.IsUnknown) { 'unknown' } else { [string]::Format([Globalization.CultureInfo]::InvariantCulture,"
    " '{0};{1};{2}', $c.Latitude, $c.Longitude, $c.HorizontalAccuracy) };"
    "$w.Stop()"
)


def parse_location(text: str) -> tuple[float, float, float] | None:
    """« lat;lng;précision » -> (lat, lng, précision en m), ou None si inconnu ou invalide."""
    parts = text.strip().split(";")
    if len(parts) != 3:
        return None
    try:
        lat, lng, acc = (float(p) for p in parts)
    except ValueError:
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180) or acc < 0:
        return None
    return lat, lng, acc


def locate_windows(timeout_s: float = 40.0) -> tuple[float, float, float] | None:
    """Interroge le service de localisation de Windows ; None si ce n'est pas Windows ou en cas d'échec."""
    if sys.platform != "win32":
        return None
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", _SCRIPT],
                             capture_output=True, text=True, timeout=timeout_s)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return parse_location(out.stdout) if out.returncode == 0 else None


def apply_auto_location(cfg: Config, locate: Callable[[], tuple[float, float, float] | None] = locate_windows) -> tuple[Config, str]:
    """Config avec la position lue sur le PC si possible, et un message pour la console (sans coordonnées)."""
    if not cfg.auto_location:
        return cfg, ""
    found = locate()
    if found is None:
        return cfg, "Localisation automatique indisponible (service désactivé ?) : coordonnées de ai/.env conservées."
    lat, lng, acc = found
    if acc > MAX_ACCURACY_M:
        return cfg, f"Localisation automatique trop imprécise ({acc:.0f} m) : coordonnées de ai/.env conservées."
    return dataclasses.replace(cfg, camera_lat=lat, camera_lng=lng), f"Position de la caméra lue sur ce PC (précision {acc:.0f} m)."
