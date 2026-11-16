"""Tests de l'évaluation : fausse vidéo noire et faux estimateur (aucun modèle, aucune vraie vidéo)."""
import sys
from dataclasses import replace
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_fall import person  # noqa: E402

from vigilis_ai.evaluate import detect, expected_for, extract, judge, load_manifest, summarize  # noqa: E402
from vigilis_ai.fall import FallParams  # noqa: E402

FPS = 10


def make_video(path: Path, seconds: float):
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (640, 480))
    for _ in range(int(seconds * FPS)):
        w.write(np.zeros((480, 640, 3), np.uint8))
    w.release()


class FakeEstimator:
    """Debout pendant 3 s, chute rapide en 0,8 s, puis allongé : une chute filmée à FPS images/s."""

    def __init__(self, falls=True):
        self.i, self.falls = 0, falls

    def infer(self, frame):
        t = self.i / FPS
        self.i += 1
        if not self.falls or t < 3.0:
            return [person(300, 300, 0)]
        f = min(1.0, (t - 3.0) / 0.8)
        return [person(300, 300 + f * 140, 90 * f)]


def test_expected_label_by_convention_and_manifest():
    assert expected_for("chute_immobile_1") == "alerte" and expected_for("alerte_x") == "alerte"
    for name in ("chute_se_releve_1", "couche_lent", "assis_vite", "ramasse_objet", "marche"):
        assert expected_for(name) == "aucune"
    assert expected_for("marche", {"marche": "alerte"}) == "alerte"  # le manifeste l'emporte


def test_manifest_is_read_and_validated(tmp_path):
    (tmp_path / "labels.csv").write_text("file,expected\nv1.mp4,alerte\nv2.mov,aucune\n", encoding="utf-8")
    assert load_manifest(tmp_path) == {"v1": "alerte", "v2": "aucune"}
    (tmp_path / "labels.csv").write_text("file,expected\nv1.mp4,peut-etre\n", encoding="utf-8")
    with pytest.raises(SystemExit):
        load_manifest(tmp_path)
    assert load_manifest(tmp_path / "vide") == {}


def test_verdicts():
    assert judge("alerte", 1) == "OK" and judge("alerte", 0) == "CHUTE MANQUEE"
    assert judge("aucune", 0) == "OK" and judge("aucune", 2) == "FAUSSE ALERTE"


def test_summary_counts_and_small_sample_warning():
    rows = [{"expected": "alerte", "verdict": "OK"}, {"expected": "alerte", "verdict": "CHUTE MANQUEE"},
            {"expected": "aucune", "verdict": "FAUSSE ALERTE"}, {"expected": "aucune", "verdict": "OK"}]
    lines = summarize(rows)
    assert lines[0].startswith("Chutes détectées : 1 sur 2") and lines[1].startswith("Fausses alertes : 1 sur 2")
    assert "pas des pourcentages fiables" in lines[2]
    assert len(summarize(rows * 5)) == 2  # 20 vidéos : plus d'avertissement


def test_a_fall_video_is_detected_and_uses_video_time(tmp_path):
    video = tmp_path / "chute_immobile_1.avi"
    make_video(video, 16.0)  # chute à 3 s, puis 13 s allongé
    frames, size = extract(video, lambda: FakeEstimator(), tmp_path / "pose_cache", max_fps=FPS)
    events, valid, total = detect(frames, size, FallParams())
    assert len(events) == 1 and valid == total > 100
    assert 13.0 <= events[0].t <= 15.0  # 3 s debout + 0,8 s de chute + 10 s d'immobilité, en temps VIDÉO


def test_a_video_without_fall_gives_no_alert(tmp_path):
    video = tmp_path / "marche.avi"
    make_video(video, 16.0)
    frames, size = extract(video, lambda: FakeEstimator(falls=False), tmp_path / "pose_cache", max_fps=FPS)
    assert detect(frames, size, FallParams())[0] == []


def test_pose_is_cached_and_thresholds_can_change_without_recomputing(tmp_path):
    video = tmp_path / "chute_immobile_1.avi"
    make_video(video, 16.0)
    cache = tmp_path / "pose_cache"
    frames, size = extract(video, lambda: FakeEstimator(), cache, max_fps=FPS)

    def must_not_be_called():
        raise AssertionError("la pose ne doit pas être recalculée")

    frames2, _ = extract(video, must_not_be_called, cache, max_fps=FPS)  # lu dans le cache
    assert len(frames2) == len(frames)
    strict = replace(FallParams(), confirm_s=20.0)
    assert detect(frames2, size, strict)[0] == []  # 20 s exigées : la chute de 13 s n'alerte plus
    assert len(detect(frames2, size, FallParams())[0]) == 1


def test_frames_are_subsampled_to_max_fps(tmp_path):
    video = tmp_path / "v.avi"
    make_video(video, 10.0)  # 100 images à 10 images/s
    frames, _ = extract(video, lambda: FakeEstimator(falls=False), tmp_path / "c", max_fps=5.0)
    assert 45 <= len(frames) <= 55  # environ 5 par seconde


def test_each_video_gets_a_fresh_estimator(tmp_path):
    made = []

    def factory():
        made.append(1)
        return FakeEstimator(falls=False)

    for name in ("a.avi", "b.avi"):
        make_video(tmp_path / name, 2.0)
        extract(tmp_path / name, factory, tmp_path / "c", max_fps=FPS)
    assert len(made) == 2  # le suivi ne passe pas d'une vidéo à l'autre
