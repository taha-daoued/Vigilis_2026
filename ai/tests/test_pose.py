"""Tests de pose.py avec de faux résultats Ultralytics (aucun modèle chargé)."""
import numpy as np

from vigilis_ai.pose import EDGES, Person, draw, persons_from_result


class T:  # imite un tenseur torch : .cpu().numpy() / .int().cpu().tolist()
    def __init__(self, a):
        self.a = np.asarray(a)

    def cpu(self):
        return self

    def numpy(self):
        return self.a

    def int(self):
        return T(self.a.astype(int))

    def tolist(self):
        return self.a.tolist()


class FakeResult:
    def __init__(self, n=2, with_ids=True, with_conf=True):
        self.keypoints = type("K", (), {"xy": T(np.zeros((n, 17, 2))), "conf": T(np.ones((n, 17))) if with_conf else None})()
        self.boxes = type("B", (), {"xyxy": T(np.tile([10, 20, 110, 220], (n, 1))), "id": T([7, 8][:n]) if with_ids else None, "__len__": lambda s: n})()


def test_no_detection_gives_empty_list():
    assert persons_from_result(type("R", (), {"keypoints": None, "boxes": None})()) == []
    r = FakeResult(0)
    r.boxes = type("B", (), {"__len__": lambda s: 0})()
    assert persons_from_result(r) == []


def test_persons_are_built_with_ids_points_and_box():
    ps = persons_from_result(FakeResult(2))
    assert [p.track_id for p in ps] == [7, 8]
    assert ps[0].keypoints.shape == (17, 2) and ps[0].conf.shape == (17,) and ps[0].box == (10.0, 20.0, 110.0, 220.0)


def test_missing_track_ids_and_confidence_are_tolerated():
    ps = persons_from_result(FakeResult(1, with_ids=False, with_conf=False))
    assert ps[0].track_id is None and float(ps[0].conf.min()) == 1.0


def test_draw_returns_a_copy_and_marks_the_image():
    frame = np.zeros((240, 320, 3), np.uint8)
    kp = np.tile([100.0, 100.0], (17, 1)) + np.arange(17)[:, None] * 5
    out = draw(frame, [Person(1, kp, np.ones(17), (90, 90, 200, 200))])
    assert out is not frame and out.sum() > 0 and frame.sum() == 0  # l'original n'est pas modifié


def test_unreliable_points_are_not_drawn():
    frame = np.zeros((240, 320, 3), np.uint8)
    kp = np.tile([100.0, 100.0], (17, 1))
    out = draw(frame, [Person(None, kp, np.zeros(17), (10, 10, 20, 20))])
    assert out[:, :, 2].sum() == 0  # aucun point rouge (confiance nulle)


def test_skeleton_edges_use_valid_keypoints():
    assert all(0 <= a < 17 and 0 <= b < 17 for a, b in EDGES)
