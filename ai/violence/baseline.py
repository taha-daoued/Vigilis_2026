"""Baseline de violence SANS apprentissage profond : statistiques de mouvement (flux optique) + classifieur simple.

Sert de point de comparaison à VideoMAE (jalon J11). Même découpage train/val/test que VideoMAE (split.csv).
Procédure (même discipline que pour VideoMAE) :
  1. `features` : extrait 18 nombres par vidéo (mouvement moyen, maximal, local...), mis en cache.
  2. `fit`      : entraîne 3 classifieurs sur train, les compare sur VAL, garde le meilleur (seuil 0.5).
  3. `test`     : mesure le meilleur UNE SEULE FOIS sur le test (fichier-témoin).

Usage : python violence/baseline.py features data/rlvs/real-life-violence-situations-dataset.zip
        python violence/baseline.py fit
        python violence/baseline.py test
"""
import csv
import json
import os
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np

from clips import sample_indices

HERE = Path(__file__).parent
DATA = HERE.parent / "data" / "rlvs"
MARK = "Real Life Violence Dataset/"
POSITIONS = 8          # nombre d'endroits de la vidéo où l'on mesure le mouvement
SIZE = (160, 120)      # image réduite pour le flux optique
VIDEO_EXT = (".mp4", ".avi", ".mov", ".mkv")
FEATURES = DATA / "baseline_features.npz"
MODEL = DATA / "baseline_model.json"
DONE = DATA / "baseline_test_done.json"
NAMES = [f"{s}_{a}" for s in ("moy", "std", "p95", "rapide", "diff", "local") for a in ("mean", "max", "std")]


def motion_features(path: str) -> np.ndarray:
    """18 nombres décrivant le mouvement d'une vidéo (échantillon de 8 paires d'images consécutives)."""
    cap = cv2.VideoCapture(path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    per_pos = []
    for i in sample_indices(max(total - 1, 1), POSITIONS, False):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok1, f1 = cap.read()
        ok2, f2 = cap.read()
        if not (ok1 and ok2):
            continue
        g1, g2 = (cv2.cvtColor(cv2.resize(f, SIZE), cv2.COLOR_BGR2GRAY) for f in (f1, f2))
        flow = cv2.calcOpticalFlowFarneback(g1, g2, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        mag = np.linalg.norm(flow, axis=2)
        local = np.linalg.norm(flow - np.median(flow.reshape(-1, 2), axis=0), axis=2)  # sans le mouvement de caméra
        per_pos.append([mag.mean(), mag.std(), np.percentile(mag, 95), (mag > 2.0).mean(),
                        np.abs(g1.astype(np.float32) - g2).mean(), local.mean()])
    cap.release()
    if not per_pos:
        return np.zeros(18, np.float32)
    a = np.array(per_pos, dtype=np.float32)
    return np.concatenate([a.mean(0), a.max(0), a.std(0)]).reshape(3, 6).T.reshape(-1)


def _job(args):
    zip_path, member, target = args
    t = Path(target)
    if not t.exists():
        t.write_bytes(zipfile.ZipFile(zip_path).read(member))
    return motion_features(str(t))


def cmd_features(zip_path: str):
    rows = list(csv.DictReader(open(HERE / "split.csv", encoding="utf-8")))
    names = {n[n.index(MARK) + len(MARK):]: n for n in zipfile.ZipFile(zip_path).namelist()
             if MARK in n and n.lower().endswith(VIDEO_EXT)}
    jobs = []
    for r in rows:
        rel = r["path"][r["path"].index(MARK) + len(MARK):]
        d = DATA / f"clips_{r['split']}"
        d.mkdir(exist_ok=True)
        jobs.append((zip_path, names[rel], str(d / rel.replace("/", "_"))))
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as ex:
        feats = []
        for k, f in enumerate(ex.map(_job, jobs, chunksize=4), 1):
            feats.append(f)
            if k % 200 == 0:
                print(f"{k}/{len(jobs)}", flush=True)
    np.savez(FEATURES, X=np.array(feats), y=np.array([int(r["label"]) for r in rows]),
             split=np.array([r["split"] for r in rows]))
    print("enregistré :", FEATURES)


def metrics(y, pred):
    tp, fp = int(((pred == 1) & (y == 1)).sum()), int(((pred == 1) & (y == 0)).sum())
    fn, tn = int(((pred == 0) & (y == 1)).sum()), int(((pred == 0) & (y == 0)).sum())
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn, "accuracy": round((tp + tn) / len(y), 4),
            "precision": round(p, 4), "recall": round(r, 4), "f1": round(2 * p * r / (p + r) if p + r else 0.0, 4)}


def candidates():
    from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    return {"regression_logistique": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
            "foret_aleatoire": RandomForestClassifier(300, random_state=2026),
            "gradient_boosting": HistGradientBoostingClassifier(random_state=2026)}


def load():
    z = np.load(FEATURES)
    return z["X"], z["y"], z["split"]


def cmd_fit():
    X, y, s = load()
    tr, va = s == "train", s == "val"
    best = (-1.0, None)
    for name, model in candidates().items():
        model.fit(X[tr], y[tr])
        m = metrics(y[va], model.predict(X[va]))
        print(name, "VAL", m)
        if m["f1"] > best[0]:
            best = (m["f1"], name)
    MODEL.write_text(json.dumps({"choisi": best[1], "f1_val": best[0]}), encoding="utf-8")
    print("choisi sur la validation :", best[1])


def cmd_test():
    if DONE.exists():
        sys.exit(f"Le test de la baseline a déjà été mesuré ({DONE}).")
    name = json.loads(MODEL.read_text(encoding="utf-8"))["choisi"]
    X, y, s = load()
    tr, te = s == "train", s == "test"
    model = candidates()[name].fit(X[tr], y[tr])
    m = {"modele": name, "n": int(te.sum()), **metrics(y[te], model.predict(X[te]))}
    print(json.dumps(m, indent=2, ensure_ascii=False))
    DONE.write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    {"features": lambda: cmd_features(sys.argv[2]), "fit": cmd_fit, "test": cmd_test}[sys.argv[1]]()
