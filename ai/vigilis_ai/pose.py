"""Pose humaine (17 points COCO) par image, avec suivi des personnes entre les images.

Modèle : YOLO26-pose (Ultralytics, licence AGPL-3.0). Aucune image n'est enregistrée ni envoyée.
"""
from dataclasses import dataclass

import cv2
import numpy as np

# Numéros des 17 points COCO : 0 nez, 5/6 épaules, 11/12 hanches, 15/16 chevilles...
NOSE, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_ANKLE, R_ANKLE = 0, 5, 6, 11, 12, 15, 16
EDGES = [(5, 6), (5, 7), (7, 9), (6, 8), (8, 10), (5, 11), (6, 12), (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),
         (0, 1), (0, 2), (1, 3), (2, 4)]
MIN_POINT_CONF = 0.3  # en dessous, le point n'est pas fiable (caché, hors image)


@dataclass
class Person:
    track_id: int | None  # identifiant de suivi (None si le suivi n'a pas encore attribué d'identifiant)
    keypoints: np.ndarray  # (17, 2) en pixels
    conf: np.ndarray  # (17,) confiance de chaque point
    box: tuple[float, float, float, float]  # x1, y1, x2, y2


class PoseEstimator:
    def __init__(self, model_path: str, imgsz: int = 640, min_conf: float = 0.3):
        from ultralytics import YOLO  # import tardif : les tests n'ont pas besoin du modèle

        self.model = YOLO(model_path)
        self.imgsz, self.min_conf = imgsz, min_conf

    def infer(self, frame: np.ndarray) -> list[Person]:
        res = self.model.track(frame, persist=True, verbose=False, imgsz=self.imgsz, conf=self.min_conf)[0]
        return persons_from_result(res)


def persons_from_result(res) -> list[Person]:
    """Convertit un résultat Ultralytics en liste de Person (fonction séparée pour être testable)."""
    if res.keypoints is None or res.boxes is None or len(res.boxes) == 0:
        return []
    xy = res.keypoints.xy.cpu().numpy()
    conf = res.keypoints.conf.cpu().numpy() if res.keypoints.conf is not None else np.ones(xy.shape[:2])
    boxes = res.boxes.xyxy.cpu().numpy()
    ids = res.boxes.id.int().cpu().tolist() if res.boxes.id is not None else [None] * len(boxes)
    return [Person(ids[i], xy[i], conf[i], tuple(float(v) for v in boxes[i])) for i in range(len(boxes))]


def draw(frame: np.ndarray, persons: list[Person]) -> np.ndarray:
    """Dessine les squelettes sur une copie de l'image."""
    out = frame.copy()
    for p in persons:
        for a, b in EDGES:
            if p.conf[a] >= MIN_POINT_CONF and p.conf[b] >= MIN_POINT_CONF:
                cv2.line(out, tuple(int(v) for v in p.keypoints[a]), tuple(int(v) for v in p.keypoints[b]), (0, 255, 0), 2)
        for k in range(17):
            if p.conf[k] >= MIN_POINT_CONF:
                cv2.circle(out, tuple(int(v) for v in p.keypoints[k]), 3, (0, 0, 255), -1)
        x1, y1 = int(p.box[0]), int(p.box[1])
        cv2.putText(out, f"id {p.track_id}", (x1, max(15, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
    return out
