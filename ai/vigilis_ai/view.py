"""Affiche (ou mesure) la pose sur une webcam ou un fichier vidéo, avec les règles de chute en option.

Exemples (depuis le dossier ai/) :
  python -m vigilis_ai.view --source 0                    # webcam, touche q pour quitter
  python -m vigilis_ai.view --source 0 --fall --confirm-s 5   # avec détection de chute (alerte après 5 s d'immobilité)
  python -m vigilis_ai.view --source video.mp4 --no-window --max-frames 60   # mesure sans fenêtre
Rien n'est enregistré ni envoyé : les images restent en mémoire.
"""
import argparse
import time

import cv2

from vigilis_ai.fall import FallDetector, FallParams, extract_sample
from vigilis_ai.pose import PoseEstimator, draw


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="numéro de webcam (0) ou chemin d'un fichier vidéo")
    ap.add_argument("--model", default="models/yolo26n-pose.pt")
    ap.add_argument("--max-frames", type=int, default=0, help="0 = jusqu'à la fin ou à 'q'")
    ap.add_argument("--no-window", action="store_true", help="pas de fenêtre : affiche seulement les mesures")
    ap.add_argument("--fall", action="store_true", help="active les règles de chute (affiche CHUTE et l'état du corps)")
    ap.add_argument("--confirm-s", type=float, default=10.0, help="immobilité exigée avant l'alerte (secondes)")
    args = ap.parse_args()

    cap = cv2.VideoCapture(int(args.source) if args.source.isdigit() else args.source)
    if not cap.isOpened():
        raise SystemExit(f"Impossible d'ouvrir la source : {args.source}")
    est = PoseEstimator(args.model)
    detector = FallDetector(FallParams(confirm_s=args.confirm_s)) if args.fall else None
    banner_until = 0.0

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

        img = None if args.no_window else draw(frame, persons)
        if detector is not None:
            now = time.monotonic()
            h, w = frame.shape[:2]
            for e in detector.update(persons, now, (w, h)):
                print(f"CHUTE détectée : personne {e.track_id}, score {e.score}, immobile {e.immobile_s:.0f} s")
                banner_until = now + 6
            if img is not None:
                seen = bool(persons) and extract_sample(persons[0], now, (w, h), detector.prm) is not None
                cv2.putText(img, "corps visible" if seen else "corps incomplet : pas de jugement", (10, h - 12),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 0) if seen else (0, 165, 255), 2)
                if now < banner_until:
                    cv2.putText(img, "CHUTE DETECTEE", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
        if img is not None:
            cv2.imshow("Vigilis - pose (q pour quitter)", img)
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
