"""Position automatique de la caméra : lecture, repli sur les coordonnées fixes, aucune coordonnée dans les messages."""
import pytest

from vigilis_ai.config import Config, ConfigError, load_config
from vigilis_ai.location import MAX_ACCURACY_M, apply_auto_location, parse_location

FIXED = (34.7406, 10.7603)


def cfg(auto: bool) -> Config:
    return Config("http://api.test", "cle", "cam-1", FIXED[0], FIXED[1], auto)


def test_parse_ok():
    assert parse_location("34.75;10.71;37\n") == (34.75, 10.71, 37.0)


@pytest.mark.parametrize("bad", ["unknown", "", "a;b;c", "1;2", "95;10;5", "10;181;5", "10;10;-1"])
def test_parse_rejects_unknown_or_invalid(bad):
    assert parse_location(bad) is None


def test_fixed_mode_never_calls_the_locator():
    def boom():
        raise AssertionError("ne doit pas être appelé")
    c, note = apply_auto_location(cfg(False), locate=boom)
    assert (c.camera_lat, c.camera_lng) == FIXED and note == ""


def test_auto_uses_the_pc_position_and_hides_coordinates():
    c, note = apply_auto_location(cfg(True), locate=lambda: (36.80, 10.18, 40.0))
    assert (c.camera_lat, c.camera_lng) == (36.80, 10.18)
    assert "36.8" not in note and "10.18" not in note and "40 m" in note


def test_auto_falls_back_when_unavailable():
    c, note = apply_auto_location(cfg(True), locate=lambda: None)
    assert (c.camera_lat, c.camera_lng) == FIXED and "indisponible" in note


def test_auto_falls_back_when_too_imprecise():
    c, note = apply_auto_location(cfg(True), locate=lambda: (10.0, 10.0, MAX_ACCURACY_M + 1))
    assert (c.camera_lat, c.camera_lng) == FIXED and "imprécise" in note


def test_config_reads_camera_location():
    env = {"VIGILIS_API_KEY": "k", "CAMERA_LOCATION": "auto"}
    assert load_config(env_path=None, environ=env).auto_location is True
    assert load_config(env_path=None, environ={"VIGILIS_API_KEY": "k"}).auto_location is False
    with pytest.raises(ConfigError):
        load_config(env_path=None, environ={"VIGILIS_API_KEY": "k", "CAMERA_LOCATION": "gps"})
