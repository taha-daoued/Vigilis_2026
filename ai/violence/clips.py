"""Choix des 16 images d'un clip vidéo (sans torch, testable partout)."""
import numpy as np


def sample_indices(total: int, n: int = 16, train: bool = False, rng=None):
    """Indices de n images réparties sur la vidéo.

    - évaluation : espacement régulier, toujours les mêmes images (résultat reproductible) ;
    - entraînement : un point aléatoire dans chacun des n segments (légère variation).
    Si la vidéo a moins de n images, on répète les dernières.
    """
    if total <= 0:
        raise ValueError("vidéo vide")
    if total < n:
        return np.minimum(np.arange(n), total - 1)
    edges = np.linspace(0, total, n + 1)
    if not train:
        return ((edges[:-1] + edges[1:]) / 2).astype(int)
    rng = rng or np.random.default_rng()
    return np.minimum(rng.uniform(edges[:-1], edges[1:]).astype(int), total - 1)
