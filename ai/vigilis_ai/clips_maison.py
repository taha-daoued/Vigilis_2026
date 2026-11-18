"""Enregistre des clips vidéo COURTS de la webcam pour évaluer / affiner la violence sur vos propres scènes.

Les clips restent sur CET ordinateur (ai/data/clips_maison/<classe>/), ne sont jamais envoyés ni versionnés.
Les personnes filmées doivent avoir donné leur accord (voir docs/PROTOCOLE_VIDEOS_MAISON.md). Aucune violence réelle :
toute scène « violence » est JOUÉE, sans contact.

Usage (depuis ai/) :
  python -m vigilis_ai.clips_maison --classe violence --n 5 --seconds 6    # 5 clips de 6 s, compte à rebours avant chacun
  python -m vigilis_ai.clips_maison --classe normal --n 5 --seconds 6
  python -m vigilis_ai.clips_maison --classe violence --n 5 --split test   # clips de TEST, tournés à un autre moment
La webcam ne doit pas déjà être utilisée par `view` (fermez-la avec q avant).
"""
import argparse
import time
from pathlib import Path

import cv2

CLASSES = ("violence", "normal")


def next_name(folder: Path, prefix: str) -> Path:
    """clip_0001.mp4, clip_0002.mp4... sans jamais écraser un clip existant."""
    n = 1 + max([int(p.stem.rsplit("_", 1)[1]) for p in folder.glob(f"{prefix}_*.mp4") if p.stem.rsplit("_", 1)[1].isdigit()] or [0])
    return folder / f"{prefix}_{n:04d}.mp4"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--classe", required=True, choices=CLASSES)
    ap.add_argument("--n", type=int, default=5, help="nombre de clips à enregistrer")
    ap.add_argument("--seconds", type=float, default=6.0, help="durée d'un clip")
    ap.add_argument("--source", default="0")
    ap.add_argument("--countdown", type=int, default=3)
    ap.add_argument("--split", default="train", choices=("train", "test"),
                    help="test = clips tournés à part (autre moment, autres vêtements), JAMAIS utilisés pour entraîner")
    ap.add_argument("--out", default="data/clips_maison")
    args = ap.parse_args()

    cap = cv2.VideoCapture(int(args.source) if args.source.isdigit() else args.source)
    if not cap.isOpened():
        raise SystemExit("Impossible d'ouvrir la webcam (déjà utilisée par `view` ? fermez-la avec q).")
    folder = Path(args.out) / args.split / args.classe
    folder.mkdir(parents=True, exist_ok=True)
    fps = 15.0  # fréquence fixe : les clips ont tous la même cadence quelle que soit la webcam
    size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640, int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480)
    print(f"Classe « {args.classe} » : {args.n} clips de {args.seconds:g} s. Touche q pour arrêter.")
    for k in range(1, args.n + 1):
        t_end = time.time() + args.countdown
        while time.time() < t_end:                      # compte à rebours : on se place
            ok, f = cap.read()
            if not ok:
                raise SystemExit("La webcam ne renvoie plus d'image.")
            cv2.putText(f, f"clip {k}/{args.n} ({args.classe}) dans {int(t_end - time.time()) + 1}", (10, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 3)
            cv2.imshow("Vigilis - clips maison (q pour arreter)", f)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                return
        path = next_name(folder, args.classe)
        w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
        start, last, frames = time.time(), 0.0, 0
        while time.time() - start < args.seconds:
            ok, f = cap.read()
            if not ok:
                break
            if time.time() - last >= 1 / fps:           # écrit à 15 images/s réelles
                w.write(f)
                last = time.time()
                frames += 1
            shown = f.copy()
            cv2.circle(shown, (30, 30), 10, (0, 0, 255), -1)  # point rouge = enregistrement
            cv2.imshow("Vigilis - clips maison (q pour arreter)", shown)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                w.release()
                path.unlink(missing_ok=True)
                return
        w.release()
        print(f"enregistré : {path} ({frames} images)")
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
