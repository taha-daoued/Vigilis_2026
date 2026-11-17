"""Détection de violence en continu : fenêtre glissante + modèle VideoMAE + décision (sans bloquer la caméra).

Principe (simple à expliquer) :
  1. on garde les images des dernières `window_s` secondes (réduites à 224x224, en mémoire seulement) ;
  2. quand le modèle est libre, on lui donne 16 images réparties sur la fenêtre : il rend une probabilité de violence ;
     le modèle prend environ 7 s sur CPU : il tourne dans un fil à part et la vidéo continue pendant ce temps ;
  3. la DÉCISION n'alerte que si `consecutive` fenêtres de suite dépassent le seuil (un pic isolé ne déclenche rien),
     puis attend `cooldown_s` avant une nouvelle alerte.
Le modèle est affiné sur RLVS (jeu facile) : voir docs/EVALUATION_VIOLENCE.md. Rien n'est enregistré ni envoyé ici.
"""
import queue
import threading
from collections import deque
from dataclasses import dataclass

import cv2
import numpy as np

BASE = "MCG-NJU/videomae-base-finetuned-kinetics"
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
N_FRAMES = 16


@dataclass(frozen=True)
class ViolenceParams:
    window_s: float = 5.0       # durée de scène couverte par les 16 images (RLVS : clips de quelques secondes)
    threshold: float = 0.5      # seuil fixé avant l'évaluation (docs/EVALUATION_VIOLENCE.md)
    consecutive: int = 2        # fenêtres consécutives au-dessus du seuil avant l'alerte
    cooldown_s: float = 60.0    # pas de nouvelle alerte avant ce délai


@dataclass(frozen=True)
class ViolenceEvent:
    score: float                # moyenne des probabilités des fenêtres confirmées
    windows_confirmed: int


class ViolenceDecision:
    """Règle de décision pure (sans modèle ni image) : testable seule."""

    def __init__(self, prm: ViolenceParams | None = None):
        self.prm = prm or ViolenceParams()
        self._streak: list[float] = []
        self._last_alert = -1e18

    def update(self, prob: float, now: float) -> ViolenceEvent | None:
        if prob < self.prm.threshold:
            self._streak = []
            return None
        self._streak.append(prob)
        if len(self._streak) < self.prm.consecutive or now - self._last_alert < self.prm.cooldown_s:
            return None
        event = ViolenceEvent(round(float(np.mean(self._streak)), 2), len(self._streak))
        self._last_alert = now
        self._streak = []
        return event


class ViolenceMonitor:
    """Reçoit les images de la caméra, fait tourner le modèle en arrière-plan, renvoie les alertes."""

    def __init__(self, predict, prm: ViolenceParams | None = None):
        """`predict(frames_bgr_224)` -> probabilité de violence (0-1) ; 16 images de 224x224."""
        self.prm = prm or ViolenceParams()
        self.decision = ViolenceDecision(self.prm)
        self._predict = predict
        self._buf: deque = deque()                 # (temps, image 224x224)
        self._last_store = -1e18
        self._jobs: queue.Queue = queue.Queue(maxsize=1)
        self._results: queue.Queue = queue.Queue()
        self._busy = False
        self.last_prob: float | None = None        # dernière probabilité (affichage)
        self.windows_done = 0
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def push(self, frame, now: float) -> None:
        """Garde une image réduite (au plus N_FRAMES par fenêtre) et oublie les plus anciennes."""
        if now - self._last_store >= self.prm.window_s / (N_FRAMES * 1.5):
            self._buf.append((now, cv2.resize(frame, (224, 224))))
            self._last_store = now
        while self._buf and now - self._buf[0][0] > self.prm.window_s:
            self._buf.popleft()

    def poll(self, now: float) -> list[ViolenceEvent]:
        """À appeler à chaque image : lance une fenêtre si le modèle est libre, renvoie les alertes prêtes."""
        events = []
        while True:
            try:
                prob = self._results.get_nowait()
            except queue.Empty:
                break
            self._busy = False
            self.last_prob = prob
            self.windows_done += 1
            ev = self.decision.update(prob, now)
            if ev is not None:
                events.append(ev)
        if not self._busy and len(self._buf) >= N_FRAMES and now - self._buf[0][0] >= 0.8 * self.prm.window_s:
            frames = [self._buf[int(i)][1] for i in np.linspace(0, len(self._buf) - 1, N_FRAMES)]
            self._busy = True
            self._jobs.put_nowait(frames)
        return events

    def _run(self) -> None:
        while True:
            frames = self._jobs.get()
            if frames is None:
                return
            try:
                self._results.put(float(self._predict(frames)))
            except Exception:  # un échec du modèle ne doit jamais arrêter la caméra
                self._results.put(0.0)

    def close(self) -> None:
        try:
            self._jobs.put_nowait(None)
        except queue.Full:
            pass


# --- Modèle (torch/transformers chargés seulement ici : les tests de décision n'en ont pas besoin) ---

def frames_to_tensor(frames_bgr):
    """Liste de 16 images BGR -> tenseur (1, 16, 3, 224, 224), même prétraitement que l'entraînement."""
    import torch
    rgb = [cv2.cvtColor(cv2.resize(f, (224, 224)), cv2.COLOR_BGR2RGB) for f in frames_bgr]
    x = (np.stack(rgb).astype(np.float32) / 255.0 - MEAN) / STD
    return torch.from_numpy(x).permute(0, 3, 1, 2).unsqueeze(0)


def load_model(weights_path: str, device: str = "cpu"):
    import torch
    from transformers import VideoMAEForVideoClassification
    model = VideoMAEForVideoClassification.from_pretrained(
        BASE, num_labels=2, id2label={0: "normal", 1: "violence"},
        label2id={"normal": 0, "violence": 1}, ignore_mismatched_sizes=True,
    )
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    return model.to(device).eval()


def violence_probability(model, x, device: str = "cpu") -> float:
    import torch
    with torch.no_grad():
        logits = model(pixel_values=x.to(device)).logits
    return float(torch.softmax(logits, dim=1)[0, 1])


def make_predictor(weights_path: str, device: str = "cpu"):
    """Fonction `predict(frames)` prête pour ViolenceMonitor."""
    model = load_model(weights_path, device)
    return lambda frames: violence_probability(model, frames_to_tensor(frames), device)
