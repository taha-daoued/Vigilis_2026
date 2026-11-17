"""Évaluation de VideoMAE sur le jeu de TEST verrouillé de RLVS (300 vidéos). À lancer UNE SEULE FOIS.

Le seuil (0.5) est fixé ici, avant de voir le résultat : on ne le règle pas sur le test.
Un fichier-témoin (data/rlvs/test_done.json) empêche de relancer par erreur ; --force pour contourner
(à ne faire que pour un bug technique, et à dire dans le rapport).
`--split val` sert à vérifier que le script marche (la validation a déjà servi à choisir le modèle).

Usage : python violence/eval_violence_testset.py models/videomae_best.pt data/rlvs/real-life-violence-situations-dataset.zip
"""
import argparse
import csv
import json
import statistics
import sys
import time
import zipfile
from pathlib import Path

import cv2
import numpy as np

from infer import load_model, read_clip, violence_probability

THRESHOLD = 0.5
MARK = "Real Life Violence Dataset/"
HERE = Path(__file__).parent

p = argparse.ArgumentParser()
p.add_argument("weights")
p.add_argument("zip_path")
p.add_argument("--split", default="test", choices=["test", "val"])
p.add_argument("--limit", type=int, default=0, help="n'évaluer que n vidéos (vérification technique)")
p.add_argument("--force", action="store_true")
args = p.parse_args()

done = Path(args.zip_path).parent / "test_done.json"
if args.split == "test" and not args.limit and done.exists() and not args.force:
    sys.exit(f"Le test a déjà été évalué ({done}). Refus de recommencer sans --force.")

rows = [r for r in csv.DictReader(open(HERE / "split.csv", encoding="utf-8")) if r["split"] == args.split]
if args.limit:
    rows = rows[: args.limit]
zf = zipfile.ZipFile(args.zip_path)
names = {n[n.index(MARK) + len(MARK):]: n for n in zf.namelist() if MARK in n and n.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))}
out_dir = Path(args.zip_path).parent / f"clips_{args.split}"
out_dir.mkdir(exist_ok=True)

model = load_model(args.weights)
results, times = [], []
for k, r in enumerate(rows, 1):
    rel = r["path"][r["path"].index(MARK) + len(MARK):]
    target = out_dir / rel.replace("/", "_")
    if not target.exists():
        target.write_bytes(zf.read(names[rel]))
    t = time.perf_counter()
    prob = violence_probability(model, read_clip(str(target)))
    times.append(time.perf_counter() - t)
    results.append({"video": rel, "label": int(r["label"]), "prob": round(prob, 4)})
    if k % 20 == 0:
        print(f"{k}/{len(rows)}  ({statistics.mean(times):.1f} s par clip)", flush=True)

y = np.array([r["label"] for r in results])
pred = np.array([int(r["prob"] >= THRESHOLD) for r in results])
tp, fp = int(((pred == 1) & (y == 1)).sum()), int(((pred == 1) & (y == 0)).sum())
fn, tn = int(((pred == 0) & (y == 1)).sum()), int(((pred == 0) & (y == 0)).sum())
prec = tp / (tp + fp) if tp + fp else 0.0
rec = tp / (tp + fn) if tp + fn else 0.0
f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
summary = {"split": args.split, "n": len(results), "seuil": THRESHOLD, "tp": tp, "fp": fp, "fn": fn, "tn": tn,
           "accuracy": round((tp + tn) / len(results), 4), "precision": round(prec, 4),
           "recall": round(rec, 4), "f1": round(f1, 4), "temps_par_clip_s": round(statistics.mean(times), 2)}
print(json.dumps(summary, indent=2, ensure_ascii=False))

out_csv = HERE.parent / "data" / f"violence_{args.split}_resultats.csv"
with open(out_csv, "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=["video", "label", "prob"])
    w.writeheader()
    w.writerows(results)
print("détail :", out_csv)
if args.split == "test" and not args.limit:
    done.write_text(json.dumps(summary, ensure_ascii=False), encoding="utf-8")
    print("fichier-témoin écrit :", done)
