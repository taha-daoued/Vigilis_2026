"""Chargement du modèle VideoMAE affiné et prédiction sur un clip (CPU ou GPU).

Le prétraitement est le MÊME que pendant l'entraînement (train_videomae.py) : 16 images
régulièrement espacées, 224x224, RGB, normalisation ImageNet.
"""
import cv2
import numpy as np
import torch
from transformers import VideoMAEForVideoClassification

from clips import sample_indices

BASE = "MCG-NJU/videomae-base-finetuned-kinetics"
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def load_model(weights_path: str, device: str = "cpu"):
    model = VideoMAEForVideoClassification.from_pretrained(
        BASE, num_labels=2, id2label={0: "normal", 1: "violence"},
        label2id={"normal": 0, "violence": 1}, ignore_mismatched_sizes=True,
    )
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    return model.to(device).eval()


def frames_to_tensor(frames_bgr) -> torch.Tensor:
    """Liste de 16 images BGR -> tenseur (1, 16, 3, 224, 224)."""
    rgb = [cv2.cvtColor(cv2.resize(f, (224, 224)), cv2.COLOR_BGR2RGB) for f in frames_bgr]
    x = (np.stack(rgb).astype(np.float32) / 255.0 - MEAN) / STD
    return torch.from_numpy(x).permute(0, 3, 1, 2).unsqueeze(0)


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


@torch.no_grad()
def violence_probability(model, x: torch.Tensor, device: str = "cpu") -> float:
    logits = model(pixel_values=x.to(device)).logits
    return float(torch.softmax(logits, dim=1)[0, 1])
