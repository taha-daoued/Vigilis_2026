"""Rejoue un enregistrement de points dans le détecteur de chute (sans caméra, sans image).

  python -m vigilis_ai.replay data/pose_records/chute_matelas_1.csv [--confirm-s 5]
Affiche la part d'images où le corps était assez visible, puis les alertes et leur heure.
"""
import argparse
import csv
from collections import defaultdict
from dataclasses import replace

import numpy as np

from vigilis_ai.fall import FallDetector, FallParams, extract_sample
from vigilis_ai.pose import Person


def load(path: str):
    """Renvoie (liste de (t, [Person]) triée, taille de l'image)."""
    by_t, size = defaultdict(list), (640, 480)
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            size = (int(r["w"]), int(r["h"]))
            kp = np.array([[float(r[f"k{i}x"]), float(r[f"k{i}y"])] for i in range(17)])
            conf = np.array([float(r[f"k{i}c"]) for i in range(17)])
            tid = int(r["track_id"]) if r["track_id"] != "" else None
            by_t[float(r["t"])].append(Person(tid, kp, conf, (0, 0, 0, 0)))
    return sorted(by_t.items()), size


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--confirm-s", type=float, default=None, help="immobilité exigée (secondes)")
    ap.add_argument("--min-drop", type=float, default=None, help="descente minimale en longueurs de tronc")
    args = ap.parse_args()

    frames, size = load(args.file)
    if not frames:
        raise SystemExit("Aucune personne dans cet enregistrement.")
    prm = FallParams()
    if args.confirm_s is not None:
        prm = replace(prm, confirm_s=args.confirm_s)
    if args.min_drop is not None:
        prm = replace(prm, min_drop_torso=args.min_drop)
    det = FallDetector(prm)

    valid = total = 0
    events = []
    for t, persons in frames:
        for p in persons:
            total += 1
            valid += extract_sample(p, t, size, prm) is not None
        events += det.update(persons, t, size)
    print(f"{len(frames)} images ({frames[-1][0] - frames[0][0]:.1f} s) | corps assez visible : {valid}/{total} mesures")
    for e in events:
        print(f"CHUTE personne {e.track_id} à t={e.t:.1f}s (score {e.score}, immobile {e.immobile_s:.1f}s)")
    if not events:
        print("aucune chute détectée")


if __name__ == "__main__":
    main()
