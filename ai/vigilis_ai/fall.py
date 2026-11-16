"""Détection de chute par règles temporelles sur les points du corps (aucune image n'est utilisée).

Une chute est déclarée quand, pour une même personne suivie :
  1. DESCENTE RAPIDE : le tronc passe de vertical à horizontal et le centre du corps (hanches)
     descend d'au moins `min_drop_torso` longueurs de tronc en moins de `drop_window_s` secondes ;
  2. IMMOBILITÉ : la personne reste allongée et quasi immobile pendant `confirm_s` secondes.
Se coucher lentement, s'asseoir vite ou se pencher ne déclenche rien (descente trop lente, tronc
resté vertical, hanches qui ne descendent pas).

Toutes les valeurs par défaut sont des POINTS DE DÉPART à régler sur des enregistrements réels
(voir record.py et replay.py) : elles ne sont pas validées. Limites connues :
  - une chute dans l'axe de la caméra raccourcit le tronc sans le coucher à l'écran : non vue ;
  - une personne allongée qui bouge beaucoup (ou une chute sans immobilité) ne déclenche pas ;
  - le score est un indicateur des règles, pas une probabilité.
"""
import math
from collections import deque
from dataclasses import dataclass, field

from vigilis_ai.pose import L_HIP, L_SHOULDER, R_HIP, R_SHOULDER, Person

TORSO_POINTS = (L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)


@dataclass(frozen=True)
class FallParams:
    min_conf: float = 0.5  # confiance minimale des épaules et des hanches pour juger
    edge_margin: float = 0.02  # part de l'image : un point trop près du bord est une estimation, pas une mesure
    min_torso_px: float = 20.0  # tronc trop petit : trop imprécis
    upright_max_deg: float = 35.0  # tronc « debout » : angle avec la verticale
    lying_min_deg: float = 60.0  # tronc « couché »
    still_lying_min_deg: float = 50.0  # pendant l'immobilité, le tronc doit rester presque couché
    drop_window_s: float = 1.5
    min_drop_torso: float = 0.8  # descente des hanches, en longueurs de tronc
    confirm_s: float = 10.0  # immobilité exigée avant l'alerte
    still_range_torso: float = 0.5  # déplacement vertical des hanches toléré pendant l'immobilité
    cooldown_s: float = 30.0  # pas de seconde alerte pour la même personne avant ce délai
    reset_after_s: float = 3.0  # corps non visible depuis ce temps : on oublie la personne
    history_s: float = 5.0


@dataclass
class Sample:
    t: float
    angle: float  # degrés par rapport à la verticale : 0 debout, 90 couché
    cx: float
    cy: float  # centre des hanches (y augmente vers le bas)
    torso: float  # longueur du tronc en pixels


@dataclass
class FallEvent:
    track_id: int
    t: float
    score: float  # 0.7 (règles remplies) + jusqu'à 0.3 selon la force de la descente
    windows_confirmed: int  # secondes d'immobilité confirmées
    immobile_s: float


def extract_sample(p: Person, t: float, size: tuple[int, int], prm: FallParams) -> Sample | None:
    """Mesures du tronc, ou None si le corps n'est pas assez visible pour juger."""
    w, h = size
    for k in TORSO_POINTS:
        x, y = p.keypoints[k]
        if p.conf[k] < prm.min_conf or not (prm.edge_margin * w <= x <= (1 - prm.edge_margin) * w) \
                or not (prm.edge_margin * h <= y <= (1 - prm.edge_margin) * h):
            return None
    sh = (p.keypoints[L_SHOULDER] + p.keypoints[R_SHOULDER]) / 2
    hip = (p.keypoints[L_HIP] + p.keypoints[R_HIP]) / 2
    dx, dy = float(sh[0] - hip[0]), float(sh[1] - hip[1])
    torso = math.hypot(dx, dy)
    if torso < prm.min_torso_px:
        return None
    return Sample(t, math.degrees(math.atan2(abs(dx), abs(dy))), float(hip[0]), float(hip[1]), torso)


@dataclass
class _Track:
    samples: deque = field(default_factory=deque)
    last_valid_t: float = 0.0
    candidate_t: float | None = None  # début de la phase « allongé, immobile ? »
    ref_torso: float = 1.0
    drop: float = 0.0
    cy_min: float = 0.0
    cy_max: float = 0.0
    cooldown_until: float = -1e9


class FallDetector:
    def __init__(self, params: FallParams | None = None):
        self.prm = params or FallParams()
        self.tracks: dict[int, _Track] = {}

    def update(self, persons: list[Person], t: float, size: tuple[int, int]) -> list[FallEvent]:
        """À appeler pour chaque image. `t` en secondes (horloge croissante), `size` = (largeur, hauteur)."""
        events = []
        for p in persons:
            if p.track_id is None:  # sans identifiant de suivi, impossible de suivre l'évolution
                continue
            s = extract_sample(p, t, size, self.prm)
            if s is None:
                continue  # corps pas assez visible : aucun jugement
            tr = self.tracks.setdefault(p.track_id, _Track())
            tr.last_valid_t = t
            tr.samples.append(s)
            while tr.samples and t - tr.samples[0].t > self.prm.history_s:
                tr.samples.popleft()
            ev = self._step(p.track_id, tr, s)
            if ev:
                events.append(ev)
        for tid in [i for i, tr in self.tracks.items() if t - tr.last_valid_t > self.prm.reset_after_s]:
            del self.tracks[tid]
        return events

    def _step(self, tid: int, tr: _Track, s: Sample) -> FallEvent | None:
        prm = self.prm
        if s.t < tr.cooldown_until:
            tr.candidate_t = None
            return None
        if tr.candidate_t is None:
            drop, ref = self._fast_drop(tr, s)
            if drop is not None:
                tr.candidate_t, tr.ref_torso, tr.drop = s.t, ref, drop
                tr.cy_min = tr.cy_max = s.cy
            return None
        # phase d'immobilité : la personne doit rester allongée et presque immobile
        tr.cy_min, tr.cy_max = min(tr.cy_min, s.cy), max(tr.cy_max, s.cy)
        if s.angle < prm.still_lying_min_deg or (tr.cy_max - tr.cy_min) / tr.ref_torso > prm.still_range_torso:
            tr.candidate_t = None  # elle s'est relevée ou bouge beaucoup : fausse piste
            return None
        elapsed = s.t - tr.candidate_t
        if elapsed < prm.confirm_s:
            return None
        tr.candidate_t = None
        tr.cooldown_until = s.t + prm.cooldown_s
        strength = min(1.0, tr.drop / (2 * prm.min_drop_torso))
        return FallEvent(tid, s.t, round(0.7 + 0.3 * strength, 2), max(1, int(elapsed)), elapsed)

    def _fast_drop(self, tr: _Track, s: Sample) -> tuple[float | None, float]:
        """Vrai si le tronc vient de passer de debout à couché en descendant vite."""
        prm = self.prm
        if s.angle < prm.lying_min_deg:
            return None, 1.0
        for old in tr.samples:  # du plus ancien au plus récent
            if s.t - old.t > prm.drop_window_s:
                continue
            if old.angle <= prm.upright_max_deg:
                drop = (s.cy - old.cy) / old.torso
                if drop >= prm.min_drop_torso:
                    return drop, old.torso
        return None, 1.0
