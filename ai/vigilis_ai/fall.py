"""Détection de chute par règles temporelles (aucune image n'est utilisée). Deux signaux indépendants :

  TRONC  : l'angle du tronc (épaules -> hanches) et la descente des hanches (points du corps) ;
  CADRE  : la forme du cadre englobant de la personne (largeur / hauteur) et sa descente. Plus robuste que
           le tronc quand les points sont mal placés ou que la caméra voit la chute de côté.

Pour chaque signal, une chute est déclarée quand, pour une même personne suivie :
  1. DESCENTE RAPIDE : la personne passe de debout à couchée en moins de `drop_window_s` secondes ;
  2. IMMOBILITÉ : elle reste couchée et quasi immobile pendant `confirm_s` secondes.
Se coucher lentement, s'asseoir vite ou se pencher ne déclenche rien (descente trop lente, forme qui ne
devient pas horizontale). Une seule alerte par chute (délai de repos).

Toutes les valeurs par défaut sont des POINTS DE DÉPART à régler sur des enregistrements réels
(voir record.py, evaluate.py et tune.py) : elles ne sont pas validées. Limites connues :
  - le tronc ne se couche pas à l'écran si la chute se fait dans l'axe de la caméra ;
  - une chute sans immobilité (la personne se débat) ne déclenche pas ;
  - le score est un indicateur des règles, pas une probabilité.
"""
import math
from collections import deque
from dataclasses import dataclass, field

from vigilis_ai.pose import L_HIP, L_SHOULDER, R_HIP, R_SHOULDER, Person

TORSO_POINTS = (L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)


@dataclass(frozen=True)
class FallParams:
    # --- signal du tronc ---
    min_conf: float = 0.5  # confiance minimale des épaules et des hanches pour juger
    edge_margin: float = 0.02  # part de l'image : un point trop près du bord est une estimation, pas une mesure
    min_torso_px: float = 20.0  # tronc trop petit : trop imprécis
    upright_max_deg: float = 35.0  # tronc « debout » : angle avec la verticale
    lying_min_deg: float = 60.0  # tronc « couché »
    still_lying_min_deg: float = 50.0  # pendant l'immobilité, le tronc doit rester presque couché
    min_drop_torso: float = 0.8  # descente des hanches, en longueurs de tronc
    still_range_torso: float = 0.5  # déplacement vertical des hanches toléré pendant l'immobilité
    # --- signal du cadre de la personne ---
    use_box: bool = True
    box_min_height_px: float = 40.0
    box_upright_max_aspect: float = 0.8  # largeur / hauteur d'une personne debout (ou presque)
    box_lying_min_aspect: float = 1.2  # largeur / hauteur d'une personne couchée
    box_height_ratio_max: float = 0.7  # la hauteur du cadre doit avoir fondu à ce rapport au moins
    box_drop_min: float = 0.2  # descente du centre du cadre, en hauteurs de personne debout
    box_still_min_aspect: float = 0.9  # pendant l'immobilité, le cadre reste plutôt horizontal
    box_still_range: float = 0.6  # déplacement du centre toléré pendant l'immobilité (hauteurs debout)
    # --- commun ---
    drop_window_s: float = 1.5
    confirm_s: float = 10.0  # immobilité exigée avant l'alerte
    cooldown_s: float = 30.0  # pas de seconde alerte pour la même personne avant ce délai
    reset_after_s: float = 3.0  # personne non visible depuis ce temps : on l'oublie
    history_s: float = 5.0
    # --- suivi de secours : une personne couchée perd souvent son identifiant (id None) ou en change ---
    link_ids: bool = True
    link_max_dist: float = 1.0  # distance max entre deux cadres, en tailles de personne, pour dire « c'est la même »


# Réglages choisis sur le jeu de RÉGLAGE de GMDCSA24 (sujets 1 à 3), puis figés. Ils lèvent un peu le plafond des
# valeurs par défaut sans fausse alerte sur ce jeu ; ils n'ont PAS été validés sur vos propres vidéos.
TUNED = {
    "min_drop_torso": 0.6, "lying_min_deg": 50.0, "still_lying_min_deg": 40.0, "still_range_torso": 1.0,
    "box_upright_max_aspect": 0.8, "box_lying_min_aspect": 1.0, "box_height_ratio_max": 0.8, "box_drop_min": 0.3,
}


def tuned_params(**overrides) -> "FallParams":
    """Réglages figés (TUNED), éventuellement surchargés : tuned_params(confirm_s=5.0)."""
    return FallParams(**{**TUNED, **overrides})


@dataclass
class Sample:
    t: float
    angle: float  # degrés par rapport à la verticale : 0 debout, 90 couché
    cx: float
    cy: float  # centre des hanches (y augmente vers le bas)
    torso: float  # longueur du tronc en pixels


@dataclass
class BoxSample:
    t: float
    aspect: float  # largeur / hauteur du cadre
    cx: float
    cy: float  # centre du cadre
    height: float
    cut: bool  # cadre coupé en haut ou en bas de l'image : la hauteur n'est pas fiable


@dataclass
class FallEvent:
    track_id: int
    t: float
    score: float  # 0.7 (règles remplies) + jusqu'à 0.3 selon la force de la descente
    windows_confirmed: int  # secondes d'immobilité confirmées
    immobile_s: float
    via: str = "tronc"  # signal qui a déclenché : « tronc » ou « cadre »


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


def extract_box(p: Person, t: float, size: tuple[int, int], prm: FallParams) -> BoxSample | None:
    """Forme du cadre de la personne, ou None s'il est absent ou trop petit."""
    x1, y1, x2, y2 = p.box
    w, h = x2 - x1, y2 - y1
    if w <= 0 or h < prm.box_min_height_px:
        return None
    cut = y1 <= prm.edge_margin * size[1] or y2 >= (1 - prm.edge_margin) * size[1]
    return BoxSample(t, w / h, (x1 + x2) / 2, (y1 + y2) / 2, h, cut)


@dataclass
class _Track:
    samples: deque = field(default_factory=deque)
    boxes: deque = field(default_factory=deque)
    last_valid_t: float = 0.0
    cooldown_until: float = -1e9
    # signal du tronc
    candidate_t: float | None = None  # début de la phase « couchée, immobile ? »
    ref_torso: float = 1.0
    drop: float = 0.0
    cy_min: float = 0.0
    cy_max: float = 0.0
    # signal du cadre
    box_candidate_t: float | None = None
    box_ref_h: float = 1.0
    box_drop: float = 0.0
    bcx_min: float = 0.0
    bcx_max: float = 0.0
    bcy_min: float = 0.0
    bcy_max: float = 0.0


class _Anchor:
    """Dernière position connue d'une personne, pour la reconnaître quand le suivi la perd."""
    def __init__(self, pid: int, box, t: float):
        self.pid, self.box, self.t = pid, tuple(float(v) for v in box), t


class FallDetector:
    def __init__(self, params: FallParams | None = None):
        self.prm = params or FallParams()
        self.tracks: dict[int, _Track] = {}
        self._anchors: list[_Anchor] = []
        self._real_to_pid: dict[int, int] = {}
        self._next_pid = 1

    def _identify(self, persons: list[Person], t: float) -> list[int | None]:
        """Identifiant stable de chaque personne de l'image.

        Le suivi du détecteur (id) est fiable debout, mais une personne qui passe à l'horizontale perd souvent son id
        (None) ou en reçoit un nouveau : sans histoire « debout » on ne peut plus voir la chute. On la reconnaît donc
        aussi par sa position : le cadre le plus proche de sa dernière position connue (à moins d'une taille de
        personne, vue il y a moins de reset_after_s) est la même personne.
        """
        prm = self.prm
        if not prm.link_ids:
            return [p.track_id for p in persons]
        self._anchors = [a for a in self._anchors if t - a.t <= prm.reset_after_s]
        used: set[int] = set()
        ids: list[int | None] = [None] * len(persons)
        for k, p in enumerate(persons):  # 1) identifiant du suivi déjà connu
            pid = self._real_to_pid.get(p.track_id) if p.track_id is not None else None
            if pid is not None and pid not in used and any(a.pid == pid for a in self._anchors):
                ids[k] = pid
                used.add(pid)
        for k, p in enumerate(persons):  # 2) sinon : la dernière position connue la plus proche
            if ids[k] is not None:
                continue
            x1, y1, x2, y2 = p.box
            best, best_d = None, prm.link_max_dist
            for a in self._anchors:
                if a.pid in used:
                    continue
                ax1, ay1, ax2, ay2 = a.box
                size = max(y2 - y1, x2 - x1, ay2 - ay1, ax2 - ax1, 1.0)
                d = math.hypot((x1 + x2 - ax1 - ax2) / 2, (y1 + y2 - ay1 - ay2) / 2) / size
                if d <= best_d:
                    best, best_d = a, d
            if best is not None:
                ids[k] = best.pid
            else:  # 3) personne nouvelle
                ids[k] = self._next_pid
                self._next_pid += 1
            used.add(ids[k])
        for k, p in enumerate(persons):
            if p.track_id is not None:
                self._real_to_pid[p.track_id] = ids[k]
            existing = next((a for a in self._anchors if a.pid == ids[k]), None)
            if existing is None:
                self._anchors.append(_Anchor(ids[k], p.box, t))
            else:
                existing.box, existing.t = tuple(float(v) for v in p.box), t
        return ids

    def update(self, persons: list[Person], t: float, size: tuple[int, int]) -> list[FallEvent]:
        """À appeler pour chaque image. `t` en secondes (horloge croissante), `size` = (largeur, hauteur)."""
        events = []
        pids = self._identify(persons, t)
        for p, pid in zip(persons, pids):
            if pid is None:  # suivi de secours désactivé et pas d'identifiant : on ne peut pas suivre
                continue
            s = extract_sample(p, t, size, self.prm)
            bs = extract_box(p, t, size, self.prm) if self.prm.use_box else None
            if s is None and bs is None:
                continue  # ni corps ni cadre exploitables : aucun jugement
            tr = self.tracks.setdefault(pid, _Track())
            tr.last_valid_t = t
            if s is not None:
                tr.samples.append(s)
            if bs is not None:
                tr.boxes.append(bs)
            for q in (tr.samples, tr.boxes):
                while q and t - q[0].t > self.prm.history_s:
                    q.popleft()
            ev = self._step_torso(pid, tr, s) if s is not None else None
            if ev is None and bs is not None:
                ev = self._step_box(pid, tr, bs)
            if ev:
                tr.candidate_t = tr.box_candidate_t = None
                events.append(ev)
        for tid in [i for i, tr in self.tracks.items() if t - tr.last_valid_t > self.prm.reset_after_s]:
            del self.tracks[tid]
        return events

    # ---------- signal du tronc ----------
    def _step_torso(self, tid: int, tr: _Track, s: Sample) -> FallEvent | None:
        prm = self.prm
        if s.t < tr.cooldown_until:
            tr.candidate_t = None
            return None
        if tr.candidate_t is None:
            drop, ref = self._torso_drop(tr, s)
            if drop is not None:
                tr.candidate_t, tr.ref_torso, tr.drop = s.t, ref, drop
                tr.cy_min = tr.cy_max = s.cy
            return None
        # phase d'immobilité : la personne doit rester couchée et presque immobile
        tr.cy_min, tr.cy_max = min(tr.cy_min, s.cy), max(tr.cy_max, s.cy)
        if s.angle < prm.still_lying_min_deg or (tr.cy_max - tr.cy_min) / tr.ref_torso > prm.still_range_torso:
            tr.candidate_t = None  # elle s'est relevée ou bouge beaucoup : fausse piste
            return None
        elapsed = s.t - tr.candidate_t
        if elapsed < prm.confirm_s:
            return None
        tr.cooldown_until = s.t + prm.cooldown_s
        strength = min(1.0, tr.drop / (2 * prm.min_drop_torso))
        return FallEvent(tid, s.t, round(0.7 + 0.3 * strength, 2), max(1, int(elapsed)), elapsed, "tronc")

    def _torso_drop(self, tr: _Track, s: Sample) -> tuple[float | None, float]:
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

    # ---------- signal du cadre ----------
    def _step_box(self, tid: int, tr: _Track, b: BoxSample) -> FallEvent | None:
        prm = self.prm
        if b.t < tr.cooldown_until:
            tr.box_candidate_t = None
            return None
        if tr.box_candidate_t is None:
            drop, ref = self._box_drop(tr, b)
            if drop is not None:
                tr.box_candidate_t, tr.box_ref_h, tr.box_drop = b.t, ref, drop
                tr.bcx_min = tr.bcx_max = b.cx
                tr.bcy_min = tr.bcy_max = b.cy
            return None
        tr.bcx_min, tr.bcx_max = min(tr.bcx_min, b.cx), max(tr.bcx_max, b.cx)
        tr.bcy_min, tr.bcy_max = min(tr.bcy_min, b.cy), max(tr.bcy_max, b.cy)
        moved = max(tr.bcx_max - tr.bcx_min, tr.bcy_max - tr.bcy_min) / tr.box_ref_h
        if b.aspect < prm.box_still_min_aspect or moved > prm.box_still_range:
            tr.box_candidate_t = None  # elle s'est relevée ou bouge beaucoup
            return None
        elapsed = b.t - tr.box_candidate_t
        if elapsed < prm.confirm_s:
            return None
        tr.cooldown_until = b.t + prm.cooldown_s
        strength = min(1.0, tr.box_drop / (2 * prm.box_drop_min))
        return FallEvent(tid, b.t, round(0.7 + 0.3 * strength, 2), max(1, int(elapsed)), elapsed, "cadre")

    def _box_drop(self, tr: _Track, b: BoxSample) -> tuple[float | None, float]:
        """Vrai si le cadre vient de passer de « haut » à « large » en descendant vite."""
        prm = self.prm
        if b.aspect < prm.box_lying_min_aspect:
            return None, 1.0
        for old in tr.boxes:
            if b.t - old.t > prm.drop_window_s or old.cut or old.aspect > prm.box_upright_max_aspect:
                continue
            if b.height / old.height <= prm.box_height_ratio_max and (b.cy - old.cy) / old.height >= prm.box_drop_min:
                return (b.cy - old.cy) / old.height, old.height
        return None, 1.0
