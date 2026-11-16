"""Test du balayage des seuils sur des séquences simulées (mêmes générateurs que test_fall)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from test_fall import SIZE, fall_sequence, person  # noqa: E402

from vigilis_ai.fall import FallParams  # noqa: E402
from vigilis_ai.tune import run_grid  # noqa: E402


def as_frames(seq):
    return [(t, [p]) for t, p in seq]


def test_grid_counts_caught_falls_and_false_alarms_per_setting():
    videos = {
        "chute": (as_frames(fall_sequence(lie_s=14.0)), SIZE),
        "debout": ([(i * 0.2, [person(300, 300, 0)]) for i in range(200)], SIZE),
    }
    expected = {"chute": "alerte", "debout": "aucune"}
    rows = run_grid(videos, expected, FallParams(), {"min_drop_torso": [0.8, 5.0]})
    by_drop = {r["min_drop_torso"]: r for r in rows}
    assert by_drop[0.8]["caught"] == 1 and by_drop[0.8]["false_alarms"] == 0
    assert by_drop[5.0]["caught"] == 0  # une descente de 5 longueurs de tronc n'existe pas : plus rien n'est détecté
    assert all(r["n_pos"] == 1 and r["n_neg"] == 1 for r in rows)


def test_lying_threshold_also_relaxes_the_still_lying_threshold():
    videos = {"chute": (as_frames(fall_sequence(lie_s=14.0)), SIZE)}
    rows = run_grid(videos, {"chute": "alerte"}, FallParams(), {"lying_min_deg": [60.0, 40.0]})
    assert len(rows) == 2 and all(r["caught"] == 1 for r in rows)
