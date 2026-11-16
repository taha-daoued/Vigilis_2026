"""Enregistre les POINTS du corps (jamais les images) pour régler les règles de chute.

  python -m vigilis_ai.record --name chute_matelas_1 --seconds 40 --delay 8
Les fichiers vont dans ai/data/pose_records/ (dossier ignoré par Git : ce sont des données personnelles).
Pendant le délai, placez-vous à 2-3 m pour que le corps entier soit visible. Touche q pour arrêter.
Pour simuler une chute, utilisez un matelas ou des coussins ; ne vous mettez jamais en danger.
"""
import argparse
import csv
from pathlib import Path

import cv2

from vigilis_ai.clock import FrameClock
from vigilis_ai.pose import PoseEstimator, draw

HEADER = ["t", "w", "h", "track_id"] + [f"k{i}{c}" for i in range(17) for c in "xyc"] + ["bx1", "by1", "bx2", "by2"]


def point_cells(p) -> list:
    """x, y, confiance de chacun des 17 points, puis le cadre de la personne (x1, y1, x2, y2), arrondis."""
    cells = []
    for k in range(17):
        cells += [round(float(p.keypoints[k][0]), 1), round(float(p.keypoints[k][1]), 1), round(float(p.conf[k]), 3)]
    return cells + [round(float(v), 1) for v in p.box]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0")
    ap.add_argument("--model", default="models/yolo26n-pose.pt")
    ap.add_argument("--name", required=True, help="nom de l'enregistrement, ex. chute_matelas_1")
    ap.add_argument("--seconds", type=float, default=40.0)
    ap.add_argument("--delay", type=float, default=8.0, help="secondes avant le début de l'enregistrement")
    ap.add_argument("--out-dir", default="data/pose_records")
    args = ap.parse_args()

    cap = cv2.VideoCapture(int(args.source) if args.source.isdigit() else args.source)
    if not cap.isOpened():
        raise SystemExit(f"Impossible d'ouvrir la source : {args.source}")
    est = PoseEstimator(args.model)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{args.name}.csv"

    clock = FrameClock(cap, is_file=not args.source.isdigit())  # fichier : temps de la vidéo ; webcam : temps réel
    rows = 0
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(HEADER)
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            now = clock.tick()
            recording = now >= args.delay
            persons = est.infer(frame)
            if recording:
                h, w = frame.shape[:2]
                for p in persons:
                    writer.writerow([round(now - args.delay, 3), w, h, p.track_id if p.track_id is not None else ""] + point_cells(p))
                    rows += 1
            img = draw(frame, persons)
            label = f"REC {now - args.delay:4.1f}/{args.seconds:.0f}s" if recording else f"debut dans {args.delay - now:3.1f}s"
            cv2.putText(img, label, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255) if recording else (0, 200, 255), 2)
            cv2.imshow("Vigilis - enregistrement des points (q = arreter)", img)
            if (cv2.waitKey(1) & 0xFF == ord("q")) or (recording and now - args.delay >= args.seconds):
                break
    cap.release()
    cv2.destroyAllWindows()
    print(f"{rows} lignes de points enregistrées dans {path} (aucune image)")


if __name__ == "__main__":
    main()
