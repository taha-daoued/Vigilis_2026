"""Tests des règles de chute sur des séquences de points simulées (aucune vidéo, aucun modèle)."""
import math

import numpy as np

from vigilis_ai.fall import FallDetector, FallParams, extract_sample
from vigilis_ai.pose import L_HIP, L_SHOULDER, R_HIP, R_SHOULDER, Person

SIZE = (640, 480)
DT = 0.2  # 5 images par seconde


def person(cx, cy, angle_deg, torso=100.0, conf=1.0, tid=1):
    """Personne dont les hanches sont en (cx, cy) et le tronc incliné de `angle_deg` (0 = debout, 90 = couché)."""
    a = math.radians(angle_deg)
    up = np.array([math.sin(a), -math.cos(a)])  # des hanches vers les épaules
    perp = np.array([math.cos(a), math.sin(a)])
    hip = np.array([cx, cy], float)
    sh = hip + torso * up
    kp = np.zeros((17, 2))
    c = np.zeros(17)
    for k, pt in ((L_SHOULDER, sh - 20 * perp), (R_SHOULDER, sh + 20 * perp), (L_HIP, hip - 15 * perp), (R_HIP, hip + 15 * perp)):
        kp[k], c[k] = pt, conf
    return Person(tid, kp, c, (0, 0, 10, 10))


def fall_sequence(stand_s=3.0, fall_s=0.8, lie_s=12.0, floor_y=440.0, noise=1.0, conf=1.0, tid=1):
    """Debout, chute rapide, puis allongé immobile. Rend la liste de (t, personne)."""
    seq, t = [], 0.0
    while t < stand_s:
        seq.append((t, person(300, 300, 0, conf=conf, tid=tid)))
        t += DT
    n = max(1, round(fall_s / DT))
    for i in range(1, n + 1):
        f = i / n
        seq.append((t, person(300, 300 + f * (floor_y - 300), 90 * f, conf=conf, tid=tid)))
        t += DT
    end = t + lie_s
    k = 0
    while t < end:
        seq.append((t, person(300, floor_y + (noise if k % 2 else -noise), 90, conf=conf, tid=tid)))
        t += DT
        k += 1
    return seq


def run(seq, params=None):
    det = FallDetector(params)
    events = []
    for t, p in seq:
        events += det.update([p] if isinstance(p, Person) else p, t, SIZE)
    return events


def test_standing_still_never_triggers():
    seq = [(i * DT, person(300, 300, 3.0 * (i % 2))) for i in range(300)]  # 60 s debout
    assert run(seq) == []


def test_fast_fall_then_immobile_triggers_once_after_confirmation():
    events = run(fall_sequence(lie_s=14.0))
    assert len(events) == 1
    e = events[0]
    assert e.track_id == 1 and 0.7 <= e.score <= 1.0 and e.immobile_s >= 10.0
    assert e.t > 3.0 + 10.0  # pas avant la fin du délai d'immobilité


def test_no_alert_before_the_immobility_delay():
    assert run(fall_sequence(lie_s=8.0)) == []  # moins de 10 s allongé


def test_getting_up_cancels():
    seq = fall_sequence(lie_s=5.0)
    t0 = seq[-1][0] + DT
    seq += [(t0 + i * DT, person(300, 300, 0)) for i in range(60)]  # elle se relève
    assert run(seq) == []


def test_moving_a_lot_on_the_ground_is_not_counted_as_immobile():
    seq = fall_sequence(lie_s=0.0)
    t0 = seq[-1][0] + DT
    seq += [(t0 + i * DT, person(300, 400 + (30 if i % 2 else -30), 90)) for i in range(80)]  # grands mouvements, restent dans l'image
    assert run(seq) == []


def test_slowly_lying_down_is_not_a_fall():
    assert run(fall_sequence(fall_s=8.0, lie_s=15.0)) == []


def test_sitting_down_fast_keeps_the_torso_vertical():
    seq = [(i * DT, person(300, 300, 0)) for i in range(15)]
    seq += [(3 + i * DT, person(300, 400, 5)) for i in range(80)]  # hanches descendent, tronc reste vertical
    assert run(seq) == []


def test_bending_over_keeps_the_hips_in_place():
    seq = [(i * DT, person(300, 300, 0)) for i in range(15)]
    seq += [(3 + i * DT, person(300, 300, 80)) for i in range(80)]  # penché en avant : hanches immobiles
    assert run(seq) == []


def test_body_not_visible_means_no_judgement():
    assert run(fall_sequence(conf=0.2, lie_s=15.0)) == []  # points peu fiables


def test_hips_at_the_edge_of_the_image_are_ignored():
    assert run(fall_sequence(floor_y=476.0, lie_s=15.0)) == []  # hanches collées au bord : estimation, pas mesure


def test_no_second_alert_during_cooldown():
    events = run(fall_sequence(lie_s=60.0))
    assert len(events) == 1


def test_two_people_are_tracked_independently():
    falling = fall_sequence(lie_s=14.0, tid=1)
    seq = [(t, [p, person(500, 300, 0, tid=2)]) for t, p in falling]  # la personne 2 reste debout
    events = run(seq)
    assert [e.track_id for e in events] == [1]


def test_person_without_track_id_is_ignored():
    seq = [(t, Person(None, p.keypoints, p.conf, p.box)) for t, p in fall_sequence(lie_s=14.0)]
    assert run(seq) == []


def test_tracks_are_forgotten_after_a_while_without_visible_body():
    det = FallDetector()
    det.update([person(300, 300, 0)], 0.0, SIZE)
    assert 1 in det.tracks
    det.update([], 10.0, SIZE)
    assert det.tracks == {}


def test_the_speed_rule_is_what_protects_against_slow_lying_down():
    slow = fall_sequence(fall_s=8.0, lie_s=15.0)
    assert run(slow) == []  # réglages par défaut : rien
    lax = FallParams(drop_window_s=100.0, min_drop_torso=0.1)  # sans la règle de vitesse, la même scène déclenche
    assert len(run(slow, lax)) == 1


def test_extract_sample_rejects_small_or_hidden_torso():
    prm = FallParams()
    assert extract_sample(person(300, 300, 0), 0, SIZE, prm).angle < 1.0
    assert extract_sample(person(300, 300, 0, torso=10), 0, SIZE, prm) is None
    assert extract_sample(person(300, 300, 0, conf=0.1), 0, SIZE, prm) is None
    assert round(extract_sample(person(300, 300, 90), 0, SIZE, prm).angle) == 90
