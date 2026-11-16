"""Tests du signal « cadre de la personne » (points du corps absents : seul le cadre est exploitable)."""
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from test_fall import DT, SIZE, fall_sequence, person, run  # noqa: E402

from vigilis_ai.fall import FallParams  # noqa: E402
from vigilis_ai.pose import Person  # noqa: E402


def boxed(cx, cy, w, h, tid=1):
    """Personne sans points fiables (confiance nulle) mais avec un cadre centré en (cx, cy)."""
    return Person(tid, np.zeros((17, 2)), np.zeros(17), (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))


def box_fall(stand_s=3.0, fall_s=0.8, lie_s=12.0, standing=(300, 280, 80, 300), lying=(300, 420, 300, 80)):
    seq, t = [], 0.0
    while t < stand_s:
        seq.append((t, boxed(*standing)))
        t += DT
    n = max(1, round(fall_s / DT))
    for i in range(1, n + 1):
        f = i / n
        seq.append((t, boxed(*[a + f * (b - a) for a, b in zip(standing, lying)])))
        t += DT
    end = t + lie_s
    while t < end:
        seq.append((t, boxed(*lying)))
        t += DT
    return seq


def test_fall_seen_only_through_the_box_triggers_once():
    events = run(box_fall(lie_s=14.0))
    assert len(events) == 1 and events[0].via == "cadre" and events[0].immobile_s >= 10.0


def test_box_signal_can_be_disabled():
    assert run(box_fall(lie_s=14.0), replace(FallParams(), use_box=False)) == []


def test_slowly_lying_down_does_not_trigger_the_box_rule():
    assert run(box_fall(fall_s=8.0, lie_s=15.0)) == []


def test_sitting_down_quickly_keeps_the_box_tall_enough():
    assert run(box_fall(lying=(300, 360, 100, 200), lie_s=15.0)) == []  # aspect 0,5 : pas couché


def test_bending_over_does_not_trigger():
    assert run(box_fall(lying=(310, 300, 140, 220), lie_s=15.0)) == []


def test_standing_box_cut_by_the_image_edge_is_not_trusted():
    cut_standing = (300, 330, 80, 300)  # le bas du cadre touche le bas de l'image : hauteur non fiable
    assert run(box_fall(standing=cut_standing, lie_s=15.0)) == []


def test_walking_across_the_image_does_not_trigger():
    seq = [(i * DT, boxed(100 + i * 2, 280, 80, 300)) for i in range(250)]
    assert run(seq) == []


def test_tiny_boxes_are_ignored():
    assert run(box_fall(standing=(300, 280, 20, 30), lying=(300, 290, 30, 10), lie_s=15.0)) == []


def test_getting_up_cancels_the_box_candidate():
    seq = box_fall(lie_s=4.0)
    t0 = seq[-1][0] + DT
    seq += [(t0 + i * DT, boxed(300, 280, 80, 300)) for i in range(60)]
    assert run(seq) == []


def test_torso_and_box_agreeing_give_a_single_alert():
    both = []
    for (t, p), (_, b) in zip(fall_sequence(lie_s=14.0), box_fall(lie_s=14.0)):
        both.append((t, Person(1, p.keypoints, p.conf, b.box)))
    events = run(both)
    assert len(events) == 1 and events[0].via == "tronc"  # un seul événement, le tronc est testé en premier


def test_tuned_preset_overrides_defaults_and_accepts_changes():
    from vigilis_ai.fall import TUNED, tuned_params

    p = tuned_params(confirm_s=2.0)
    assert p.confirm_s == 2.0 and p.min_drop_torso == TUNED["min_drop_torso"] and p.box_drop_min == TUNED["box_drop_min"]
    assert FallParams().min_drop_torso != p.min_drop_torso  # les valeurs par défaut ne changent pas
