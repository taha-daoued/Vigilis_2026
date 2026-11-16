"""Affiche (ou mesure) la pose sur une webcam ou un fichier vidéo.

Exemples (depuis le dossier ai/) :
  python -m vigilis_ai.view --source 0                    # webcam, touche q pour quitter
  python -m vigilis_ai.view --source video.mp4 --no-window --max-frames 60   # mesure sans fenêtre
Rien n'est enregistré ni envoyé : les images restent en mémoire.
"""
import argparse
import time

import cv2

from vigilis_ai.pose import PoseEstimator, draw


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="numéro de webcam (0) ou chemin d'un fichier vidéo")
    ap.add_argument("--model", default="models/yolo26n-pose.pt")
    ap.add_argument("--max-frames", type=int, default=0, help="0 = jusqu'à la fin ou à 'q'")
    ap.add_argument("--no-window", action="store_true", help="pas de fenêtre : affiche seulement les mesures")
    args = ap.parse_args()

    cap = cv2.VideoCapture(int(args.source) if args.source.isdigit() else args.source)
    if not cap.isOpened():
        raise SystemExit(f"Impossible d'ouvrir la source : {args.source}")
    est = PoseEstimator(args.model)

    times, counts, n = [], [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t0 = time.perf_counter()
        persons = est.infer(frame)
        times.append((time.perf_counter() - t0) * 1000)
        counts.append(len(persons))
        n += 1
        if not args.no_window:
            cv2.imshow("Vigilis - pose (q pour quitter)", draw(frame, persons))
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
        if args.max_frames and n >= args.max_frames:
            break
    cap.release()
    cv2.destroyAllWindows()
    if times:
        steady = times[1:] or times  # la 1re image inclut le chargement du modèle
        print(f"{n} images | pose : {sum(steady) / len(steady):.0f} ms/image en moyenne "
              f"(max {max(steady):.0f}) | personnes par image : min {min(counts)}, max {max(counts)}")


if __name__ == "__main__":
    main()
