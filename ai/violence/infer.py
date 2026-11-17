"""Prédiction de violence sur une vidéo (CPU ou GPU) pour les scripts d'évaluation.

Le modèle et le prétraitement viennent de vigilis_ai/violence.py (une seule source, la même que le service en direct) ;
ils sont identiques à ceux de l'entraînement (train_videomae.py) : 16 images, 224x224, RGB, normalisation ImageNet.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # pour importer vigilis_ai depuis ce dossier
from clips import sample_indices  # noqa: E402
from vigilis_ai.violence import frames_to_tensor, load_model, violence_probability  # noqa: E402,F401


def read_clip(path: str) -> torch.Tensor:
    """Lit 16 images d'une vidéo (mêmes indices que l'évaluation de l'entraînement)."""
    cap = cv2.VideoCapture(path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames = []
    for i in sample_indices(total, 16, False):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, f = cap.read()
        if not ok:
            f = frames[-1] if frames else np.zeros((224, 224, 3), np.uint8)
        frames.append(f)
    cap.release()
    return frames_to_tensor(frames)
