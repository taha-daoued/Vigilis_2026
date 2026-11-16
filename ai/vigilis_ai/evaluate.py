"""Évalue les règles de chute sur un dossier de vidéos et compare au résultat attendu.

  python -m vigilis_ai.evaluate data/videos [--confirm-s 10] [--min-drop 0.8] [--force]

Résultat attendu de chaque vidéo :
  - fichier labels.csv (colonnes : file,expected) dans le dossier, expected = alerte | aucune ;
  - sinon, par convention : « alerte » si le nom commence par `chute_immobile` ou `alerte`,
    « aucune » pour tout le reste (chute_se_releve, couche_lent, assis_vite, ramasse_objet, marche...).

La pose de chaque vidéo est calculée UNE fois puis gardée dans <dossier>/pose_cache/ (points du corps, jamais
d'images) : changer un seuil et relancer prend ensuite quelques secondes. Attention : régler les seuils
sur les mêmes vidéos que celles qu'on présente donne un résultat flatteur ; gardez des vidéos à part.
"""
import argparse
import csv
from collections import Counter
from dataclasses import replace
from pathlib import Path

import cv2

from vigilis_ai.clock import FrameClock
from vigilis_ai.fall import FallDetector, FallParams, extract_sample, tuned_params
from vigilis_ai.record import HEADER, point_cells
from vigilis_ai.replay import load

VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".m4v"}
POSITIVE_PREFIXES = ("chute_immobile", "alerte")


def expected_for(stem: str, manifest: dict[str, str] | None = None) -> str:
    """'alerte' ou 'aucune' : le manifeste l'emporte, sinon la convention de nom."""
    if manifest and stem in manifest:
        return manifest[stem]
    return "alerte" if stem.lower().startswith(POSITIVE_PREFIXES) else "aucune"


def load_manifest(folder: Path) -> dict[str, str]:
    path = folder / "labels.csv"
    if not path.exists():
        return {}
    with open(path, newline="", encoding="utf-8") as fh:
        rows = {Path(r["file"]).stem: r["expected"].strip().lower() for r in csv.DictReader(fh)}
    bad = {k: v for k, v in rows.items() if v not in ("alerte", "aucune")}
    if bad:
        raise SystemExit(f"labels.csv : valeur attendue invalide (alerte ou aucune) : {bad}")
    return rows


def judge(expected: str, n_alerts: int) -> str:
    if expected == "alerte":
        return "OK" if n_alerts >= 1 else "CHUTE MANQUEE"
    return "OK" if n_alerts == 0 else "FAUSSE ALERTE"


def _has_box(cache: Path) -> bool:
    """Les anciens caches (sans cadre de la personne) sont recalculés."""
    with open(cache, encoding="utf-8") as fh:
        return "bx1" in fh.readline()


def extract(video: Path, make_estimator, cache_dir: Path, max_fps: float = 10.0, force: bool = False):
    """Points du corps de la vidéo (calculés une fois, puis lus dans le cache). Renvoie (images, taille)."""
    cache = cache_dir / f"{video.stem}.csv"
    if cache.exists() and not force and cache.stat().st_mtime >= video.stat().st_mtime and _has_box(cache):
        return load(str(cache))
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise SystemExit(f"Impossible d'ouvrir la vidéo : {video}")
    estimator = make_estimator()  # un nouvel estimateur par vidéo : le suivi ne doit pas passer d'une vidéo à l'autre
    clock = FrameClock(cap, is_file=True)
    cache_dir.mkdir(parents=True, exist_ok=True)
    next_t = 0.0
    with open(cache, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(HEADER)
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            t = clock.tick()
            if t < next_t:
                continue  # inutile de passer 30 images/s dans la pose : ~10/s suffisent aux règles
            next_t = t + 1.0 / max_fps
            h, w = frame.shape[:2]
            for p in estimator.infer(frame):
                writer.writerow([round(t, 3), w, h, p.track_id if p.track_id is not None else ""] + point_cells(p))
    cap.release()
    return load(str(cache))


def detect(frames, size, params: FallParams):
    det = FallDetector(params)
    events, valid, total = [], 0, 0
    for t, persons in frames:
        for p in persons:
            total += 1
            valid += extract_sample(p, t, size, params) is not None
        events += det.update(persons, t, size)
    return events, valid, total


def summarize(rows: list[dict]) -> list[str]:
    pos = [r for r in rows if r["expected"] == "alerte"]
    neg = [r for r in rows if r["expected"] == "aucune"]
    caught = sum(r["verdict"] == "OK" for r in pos)
    false_alarms = sum(r["verdict"] == "FAUSSE ALERTE" for r in neg)
    lines = [f"Chutes détectées : {caught} sur {len(pos)} vidéos de chute.",
             f"Fausses alertes : {false_alarms} sur {len(neg)} vidéos sans chute."]
    if len(rows) < 20:
        lines.append(f"Échantillon de {len(rows)} vidéos : ces comptes ne sont pas des pourcentages fiables.")
    return lines


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", help="dossier de vidéos (mp4, mov, avi...)")
    ap.add_argument("--model", default="models/yolo26n-pose.pt")
    ap.add_argument("--confirm-s", type=float, default=None)
    ap.add_argument("--min-drop", type=float, default=None)
    ap.add_argument("--tuned", action="store_true", help="réglages figés sur GMDCSA24 (fall.TUNED) au lieu des valeurs par défaut")
    ap.add_argument("--force", action="store_true", help="recalcule la pose même si le cache existe")
    ap.add_argument("--csv-out", default=None, help="écrit aussi les résultats dans ce fichier CSV")
    args = ap.parse_args()

    folder = Path(args.folder)
    videos = sorted(p for p in folder.iterdir() if p.suffix.lower() in VIDEO_EXT)
    if not videos:
        raise SystemExit(f"Aucune vidéo dans {folder}")
    manifest = load_manifest(folder)
    prm = tuned_params() if args.tuned else FallParams()
    if args.confirm_s is not None:
        prm = replace(prm, confirm_s=args.confirm_s)
    if args.min_drop is not None:
        prm = replace(prm, min_drop_torso=args.min_drop)

    def make_estimator():
        from vigilis_ai.pose import PoseEstimator
        return PoseEstimator(args.model)

    rows = []
    for v in videos:
        frames, size = extract(v, make_estimator, folder / "pose_cache", force=args.force)
        events, valid, total = detect(frames, size, prm)
        exp = expected_for(v.stem, manifest)
        rows.append({"file": v.name, "expected": exp, "alerts": len(events), "first_s": round(events[0].t, 1) if events else "",
                     "visible": f"{valid}/{total}", "verdict": judge(exp, len(events))})

    print(f"\n{'vidéo':34} {'attendu':8} {'alertes':8} {'1re à (s)':10} {'corps visible':14} verdict")
    for r in rows:
        print(f"{r['file'][:34]:34} {r['expected']:8} {r['alerts']:<8} {str(r['first_s']):10} {r['visible']:14} {r['verdict']}")
    print()
    print(f"Réglages : immobilité {prm.confirm_s:.0f} s, descente minimale {prm.min_drop_torso} longueur de tronc.")
    for line in summarize(rows):
        print(line)
    print("Verdicts :", dict(Counter(r["verdict"] for r in rows)))
    if args.csv_out:
        with open(args.csv_out, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"Résultats écrits dans {args.csv_out}")


if __name__ == "__main__":
    main()
