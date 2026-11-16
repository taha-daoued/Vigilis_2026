"""Horloge des images : le temps d'une VIDÉO vient de la vidéo, celui d'une WEBCAM de l'horloge réelle.

Sans cela, un fichier lu plus lentement que sa cadence (la pose traite ~7 images/s, un téléphone en
filme 30) fausserait toutes les durées : 10 s d'immobilité vues par les règles ne seraient pas 10 s.
"""
import time

import cv2

DEFAULT_FPS = 25.0


class FrameClock:
    def __init__(self, cap, is_file: bool):
        self.cap, self.is_file = cap, is_file
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        self.fps = fps if 1.0 <= fps <= 240.0 else DEFAULT_FPS  # cadence absurde ou absente : valeur par défaut
        self.n = 0
        self.start = time.monotonic()

    def tick(self) -> float:
        """À appeler une fois par image lue. Renvoie son heure en secondes depuis le début."""
        if not self.is_file:
            t = time.monotonic() - self.start
        else:
            t = self.cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0  # horodatage réel de l'image (caméras à cadence variable)
            if self.n > 0 and t <= 0:  # certains formats ne le donnent pas : on retombe sur le numéro d'image
                t = self.n / self.fps
        self.n += 1
        return t
